/**
 * Smart Dependency Assistant Extension
 * Main entry point that coordinates all modules
 */

import * as vscode from 'vscode';
import { ErrorAnalyzer } from './analyzer/errorAnalyzer';
import { DependencyScanner } from './analyzer/dependencyScanner';
import { EnvironmentManager } from './services/environmentManager';
import { ActivityTracker } from './services/activityTracker';
import { TerminalMonitor } from './terminal/terminalMonitor';
import { InstallCommandGenerator } from './commands/installCommandGenerator';
import { CommandRegistry } from './commands/commandRegistry';
import { WebviewProvider } from './ui/webviewProvider';
import { ActivityPanelProvider } from './ui/activityPanelProvider';
import { NotificationManager } from './ui/notificationManager';
import { SettingsManager } from './services/settingsManager';
import { InstallQueue } from './services/installQueue';
import { DependencyIssue, SupportedLanguage, IssueType, IssueSeverity, ActivityType, ActivitySeverity } from './types/types';

let errorAnalyzer: ErrorAnalyzer;
let dependencyScanner: DependencyScanner;
let environmentManager: EnvironmentManager;
let activityTracker: ActivityTracker;
let terminalMonitor: TerminalMonitor;
let commandGenerator: InstallCommandGenerator;
let commandRegistry: CommandRegistry;
let webviewProvider: WebviewProvider;
let activityPanelProvider: ActivityPanelProvider;
let notificationManager: NotificationManager;
let settingsManager: SettingsManager;
let installQueue: InstallQueue;
let scanTimeout: NodeJS.Timeout | undefined;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('✅ Smart Dependency Assistant activated');

  // Initialize modules
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  errorAnalyzer = new ErrorAnalyzer(workspacePath);
  dependencyScanner = new DependencyScanner(workspacePath);
  commandGenerator = new InstallCommandGenerator();
  settingsManager = new SettingsManager(context);
  environmentManager = new EnvironmentManager(workspacePath, commandGenerator, context, settingsManager);
  activityTracker = new ActivityTracker();
  commandRegistry = new CommandRegistry(context, commandGenerator);
  webviewProvider = new WebviewProvider(context, commandGenerator);
  activityPanelProvider = new ActivityPanelProvider(context, activityTracker);
  notificationManager = new NotificationManager(context);
  installQueue = new InstallQueue(commandRegistry, commandGenerator, activityTracker, notificationManager, settingsManager);
  terminalMonitor = new TerminalMonitor(errorAnalyzer);

  // Register commands
  commandRegistry.registerCommands();

  // Register webview providers
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'smartDependencyPanel',
      webviewProvider
    ),
    vscode.window.registerWebviewViewProvider(
      'smartActivityPanel',
      activityPanelProvider
    )
  );

  // Setup event listeners
  setupTerminalListener(context);
  setupWorkspaceListeners(context);
  setupCommandHandlers(context);
  setupWebviewHandlers(context);

  // Start monitoring
  terminalMonitor.startMonitoring();

  // Start initial workspace scan and environment preparation
  refreshHealthDashboard();
  void environmentManager.ensureProjectEnvironment();

  // Log initial activity
  activityTracker.logActivity(
    ActivityType.ScanCompleted,
    ActivitySeverity.Info,
    '🚀 Smart Dependency Assistant Ready',
    {
      description: 'Extension initialized and monitoring for dependency issues'
    }
  );

  console.log('✅ All modules initialized');
}

/**
 * Refresh the project's health dashboard from the current workspace state.
 */
async function refreshHealthDashboard(): Promise<void> {
  if (!dependencyScanner || !webviewProvider) {
    return;
  }

  try {
    const scan = await dependencyScanner.scanWorkspace(settingsManager?.supportedLanguages);
    const summary = dependencyScanner.createSummary(scan);
    webviewProvider.displayDashboard(summary);
    activityTracker.logScanCompleted(scan.scannedFiles, scan.missingPackages.size, scan.pythonPackages.size + scan.nodePackages.size);
  } catch (error) {
    console.error('[Extension] Failed to refresh health dashboard:', error);
  }
}

/**
 * Register workspace watchers and reactive listeners.
 */
function setupWorkspaceListeners(context: vscode.ExtensionContext): void {
  const refreshHandler = () => {
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = undefined;
    }
    scanTimeout = setTimeout(() => {
      void refreshHealthDashboard();
    }, settingsManager?.scanDelayMs || 1200);
  };

  const saveListener = vscode.workspace.onDidSaveTextDocument(refreshHandler);
  const openListener = vscode.workspace.onDidOpenTextDocument(refreshHandler);
  const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(refreshHandler);
  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    const language = getLanguageFromDocument(event.document);
    if (!language || !settingsManager.isLanguageSupported(language)) {
      return;
    }
    refreshHandler();
  });

  context.subscriptions.push(saveListener, openListener, workspaceListener, changeListener);
}

function getLanguageFromDocument(document: vscode.TextDocument): SupportedLanguage | undefined {
  const text = document.languageId.toLowerCase();
  if (text === 'python') {
    return SupportedLanguage.Python;
  }
  if (['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(text)) {
    return SupportedLanguage.NodeJS;
  }
  return undefined;
}

/**
 * Setup terminal output listener
 */
function setupTerminalListener(context: vscode.ExtensionContext): void {
  // Listen for terminal text events (when user runs commands)
  const terminalChangeListener = vscode.window.onDidChangeActiveTerminal((terminal) => {
    if (terminal) {
      console.log(`[Extension] Active terminal changed: ${terminal.name}`);
    }
  });

  context.subscriptions.push(terminalChangeListener);

  // Listen for errors from debug console
  const debugListener = vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
    if (event.event === 'output') {
      const output = event.body?.output || '';
      processTerminalOutput(output);
    }
  });

  context.subscriptions.push(debugListener);

  // Listen for terminal state changes
  const terminalStateListener = vscode.window.onDidOpenTerminal((terminal) => {
    console.log(`[Extension] Terminal opened: ${terminal.name}`);
  });

  context.subscriptions.push(terminalStateListener);

  // Register a command to manually process output (useful for testing)
  const manualCheckCommand = vscode.commands.registerCommand(
    'smartDependencyAssistant.checkTerminal',
    () => {
      const activeTerminal = vscode.window.activeTerminal;
      if (activeTerminal) {
        const output = terminalMonitor.getTerminalOutput(activeTerminal);
        processTerminalOutput(output);
      }
    }
  );

  context.subscriptions.push(manualCheckCommand);

  // Setup error callback for terminal monitor
  terminalMonitor.onError((output) => {
    processTerminalOutput(output);
  });

  // Setup diagnostic listener for language server errors (e.g., missing imports in editor)
  const diagnosticListener = vscode.languages.onDidChangeDiagnostics((event) => {
    for (const uri of event.uris) {
      const diagnostics = vscode.languages.getDiagnostics(uri);
      processDiagnostics(diagnostics);
    }
  });

  context.subscriptions.push(diagnosticListener);
}

/**
 * Process language server diagnostics for missing imports
 */
function processDiagnostics(diagnostics: vscode.Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const message = diagnostic.message.toLowerCase();
    const isMissingImport = message.includes('import') &&
                           (message.includes('could not be resolved') ||
                            message.includes('no module') ||
                            message.includes('cannot find'));

    if (!isMissingImport) {
      continue;
    }

    const matches = diagnostic.message.match(/["']([a-zA-Z0-9_.-]+)["']/);
    if (!matches || !matches[1]) {
      continue;
    }

    const packageName = matches[1];
    let language = issueLanguageFromDiagnostic(diagnostic);

    if (!language) {
      const activeEditor = vscode.window.activeTextEditor;
      const fileExt = activeEditor?.document.uri.fsPath.split('.').pop();
      if (fileExt === 'py') {
        language = 'python';
      } else if (fileExt === 'js' || fileExt === 'ts' || fileExt === 'jsx' || fileExt === 'tsx') {
        language = 'nodejs';
      }
    }

    if (!language) {
      continue;
    }

    const issue: DependencyIssue = {
      id: `${Date.now()}-${packageName}`,
      type: IssueType.MissingDependency,
      language: language === 'python' ? SupportedLanguage.Python : SupportedLanguage.NodeJS,
      packageName,
      originalError: diagnostic.message,
      explanation: `The import ${packageName} could not be resolved. This usually means the package is missing from the current environment.`,
      severity: IssueSeverity.High,
      confidence: 80,
      suggestedCommand: language === 'python' ? `pip install ${packageName}` : `npm install ${packageName}`,
      timestamp: Date.now(),
    };

    activityTracker.logErrorDetected('Missing Import', packageName);
    void handleDependencyIssue(issue);
  }
}

function issueLanguageFromDiagnostic(diagnostic: vscode.Diagnostic): 'python' | 'nodejs' | undefined {
  const source = diagnostic.source?.toLowerCase();
  if (source?.includes('python') || source?.includes('pylance')) {
    return 'python';
  }
  if (source?.includes('javascript') || source?.includes('typescript') || source?.includes('eslint')) {
    return 'nodejs';
  }
  return undefined;
}

async function handleDependencyIssue(issue: DependencyIssue): Promise<void> {
  if (!issue || !issue.packageName) {
    return;
  }

  issue.suggestedCommand = commandGenerator.generateCommand(issue).command;
  webviewProvider.displayIssue(issue);
  activityTracker.logErrorDetected('Dependency Issue', issue.packageName);
  notificationManager.showStatusMessage(`Dependify: Detected ${issue.packageName}`, 4500);

  if (!settingsManager.shouldAutoInstall()) {
    notificationManager.showInfo(`Missing dependency detected: ${issue.packageName}. ${issue.suggestedCommand}`);
    return;
  }

  const canInstall = !settingsManager.shouldConfirmBeforeInstall() || await commandRegistry.showInstallConfirmation(issue);
  if (!canInstall) {
    return;
  }

  installQueue.enqueue(issue, issue.suggestedCommand);
}

/**
 * Process terminal output and detect issues
 */
async function processTerminalOutput(output: string): Promise<void> {
  if (!output || output.length === 0) {
    return;
  }

  const result = errorAnalyzer.analyzeError(output);

  if (result.detected && result.issue) {
    const issue = result.issue;
    console.log(`[Extension] Dependency issue detected: ${issue.packageName}`);
    await handleDependencyIssue(issue);
  }
}

/**
 * Setup command handlers
 */
function setupCommandHandlers(_context: vscode.ExtensionContext): void {
  // Handle install command from command registry
  commandRegistry.onInstall(async (issue: DependencyIssue) => {
    await handleInstallCommand(issue);
  });

  // Handle copy command from command registry
  commandRegistry.onCopy(async (command: string, _packageName: string) => {
    console.log(`[Extension] Copy command: ${command}`);
    notificationManager.showStatusMessage(`Copied: ${command}`, 3000);
  });

  commandRegistry.onRefresh(async () => {
    await handleRefreshCommand();
  });

  commandRegistry.onRepair(async () => {
    await handleRepairCommand();
  });

  commandRegistry.onCreateEnvironment(async () => {
    await handleCreateEnvironmentCommand();
  });

  commandRegistry.onCleanup(async () => {
    await handleCleanupCommand();
  });
}

/**
 * Handle install command execution
 */
async function handleInstallCommand(issue: DependencyIssue): Promise<void> {
  console.log(`[Extension] Installing ${issue.packageName}...`);

  webviewProvider.updateInstallationStatus('installing');
  notificationManager.showInstallationStarted(issue.packageName);

  try {
    const command = commandGenerator.generateCommand(issue);

    // Validate command safety
      if (!commandGenerator.isCommandSafe(command.command)) {
      throw new Error('Command validation failed');
    }

    // Execute in terminal
    const success = await commandRegistry.executeInTerminal(command.command, true);

    if (success) {
      webviewProvider.updateInstallationStatus('success');
      notificationManager.showInstallationSuccess(issue.packageName);

      // Log to activity tracker
      activityTracker.logDependencyInstalled(issue.packageName);
      activityTracker.logCommand(command.command, issue.packageName, true);

      // Show completion message
      const response = await notificationManager.showWithActions(
        `✓ ${issue.packageName} installation initiated. Check the terminal for progress.`,
        ['Open Terminal']
      );

      if (response === 'Open Terminal') {
        const activeTerminal = vscode.window.activeTerminal;
        if (activeTerminal) {
          activeTerminal.show();
        }
      }
    } else {
      webviewProvider.updateInstallationStatus('error', 'Failed to open terminal');
      activityTracker.logDependencyFailed(issue.packageName, 'Failed to open terminal');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Extension] Installation error:', error);

    webviewProvider.updateInstallationStatus('error', errorMessage);
    notificationManager.showInstallationError(issue.packageName, errorMessage);
    activityTracker.logDependencyFailed(issue.packageName, errorMessage);
  }
}

async function handleRefreshCommand(): Promise<void> {
  await refreshHealthDashboard();
  activityTracker.logScanCompleted(0, 0, 0);
  notificationManager.showStatusMessage('Dependency dashboard updated', 3000);
}

async function handleRepairCommand(): Promise<void> {
  if (!environmentManager) {
    return;
  }

  const plan = await environmentManager.createRepairPlan();
  activityTracker.logActivity(
    ActivityType.EnvironmentModified,
    ActivitySeverity.Info,
    '🔧 Environment Repair Initiated',
    {
      description: 'Repair plan generated for project environment'
    }
  );
  vscode.window.showInformationMessage(plan, { modal: false });
}

async function handleCreateEnvironmentCommand(): Promise<void> {
  if (!environmentManager) {
    return;
  }

  const summary = await environmentManager.ensureProjectEnvironment();
  if (summary) {
    webviewProvider.displayDashboard(summary);
    activityTracker.logEnvironmentCreated('Project', {
      language: summary.languages.join(', '),
      dependenciesDetected: String(summary.usedPackages.length)
    });
    vscode.window.showInformationMessage('Project environment setup completed or updated.');
  }
}

async function handleCleanupCommand(): Promise<void> {
  const scan = await dependencyScanner.scanWorkspace();
  const unused = Array.from(scan.unusedPackages);

  if (unused.length === 0) {
    vscode.window.showInformationMessage('No unused dependencies detected.');
    return;
  }

  for (const dep of unused) {
    activityTracker.logDependencyRemoved(dep);
  }

  vscode.window.showWarningMessage(
    `Unused dependencies: ${unused.join(', ')}. Consider removing them from package.json or requirements.txt.`
  );
}

/**
 * Setup webview message handlers
 */
function setupWebviewHandlers(_context: vscode.ExtensionContext): void {
  // Handle install click from webview
  webviewProvider.onInstall((issue: DependencyIssue) => {
    handleInstallCommand(issue);
  });

  // Handle copy command from webview
  webviewProvider.onCopy((command: string) => {
    vscode.env.clipboard.writeText(command).then(() => {
      notificationManager.showStatusMessage(`Copied: ${command}`, 2000);
    });
  });

  // Handle dismiss from webview
  webviewProvider.onDismissIssue((issueId: string) => {
    console.log(`[Extension] Issue dismissed: ${issueId}`);
    terminalMonitor.clearTerminalBuffer(vscode.window.activeTerminal!);
  });

  // Handle panel actions
  webviewProvider.onPanelAction(async (action: 'refresh' | 'repair' | 'createEnvironment' | 'cleanup') => {
    switch (action) {
      case 'refresh':
        await handleRefreshCommand();
        break;
      case 'repair':
        await handleRepairCommand();
        break;
      case 'createEnvironment':
        await handleCreateEnvironmentCommand();
        break;
      case 'cleanup':
        await handleCleanupCommand();
        break;
    }
  });
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('✅ Smart Dependency Assistant deactivated');

  if (terminalMonitor) {
    terminalMonitor.stopMonitoring();
  }
}

/**
 * Set global error handler for uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error('[Extension] Uncaught error:', error);
});
