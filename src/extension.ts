/**
 * Smart Dependency Assistant Extension
 * Main entry point that coordinates all modules
 */

import * as vscode from 'vscode';
import { ErrorAnalyzer } from './analyzer/errorAnalyzer';
import { DependencyScanner } from './analyzer/dependencyScanner';
import { EnvironmentManager } from './services/environmentManager';
import { TerminalMonitor } from './terminal/terminalMonitor';
import { InstallCommandGenerator } from './commands/installCommandGenerator';
import { CommandRegistry } from './commands/commandRegistry';
import { WebviewProvider } from './ui/webviewProvider';
import { NotificationManager } from './ui/notificationManager';
import { DependencyIssue } from './types/types';

let errorAnalyzer: ErrorAnalyzer;
let dependencyScanner: DependencyScanner;
let environmentManager: EnvironmentManager;
let terminalMonitor: TerminalMonitor;
let commandGenerator: InstallCommandGenerator;
let commandRegistry: CommandRegistry;
let webviewProvider: WebviewProvider;
let notificationManager: NotificationManager;

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
  environmentManager = new EnvironmentManager(workspacePath, commandGenerator, context);
  commandRegistry = new CommandRegistry(context, commandGenerator);
  webviewProvider = new WebviewProvider(context, commandGenerator);
  notificationManager = new NotificationManager();
  terminalMonitor = new TerminalMonitor(errorAnalyzer);

  // Register commands
  commandRegistry.registerCommands();

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'smartDependencyPanel',
      webviewProvider
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
    const scan = await dependencyScanner.scanWorkspace();
    const summary = dependencyScanner.createSummary(scan);
    webviewProvider.displayDashboard(summary);
  } catch (error) {
    console.error('[Extension] Failed to refresh health dashboard:', error);
  }
}

/**
 * Register workspace watchers and reactive listeners.
 */
function setupWorkspaceListeners(context: vscode.ExtensionContext): void {
  const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
    void refreshHealthDashboard();
  });

  const openListener = vscode.workspace.onDidOpenTextDocument(() => {
    void refreshHealthDashboard();
  });

  const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    void refreshHealthDashboard();
  });

  context.subscriptions.push(saveListener, openListener, workspaceListener);
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
      // Fallback from active editor file extension if available
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

    const command = language === 'python'
      ? `pip install ${packageName}`
      : `npm install ${packageName}`;

    console.log(`[Extension] Auto-installing ${packageName} as ${language}`);
    commandRegistry.executeInTerminal(command, false);
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

/**
 * Automatically install a detected dependency (silent)
 */
async function autoInstallDependency(issue: DependencyIssue): Promise<void> {
  // Skip auto-install if running in test environment
  if (process.env.VSCODE_CWD?.includes('.vscode-test')) {
    return;
  }

  try {
    const command = commandGenerator.generateCommand(issue);

    // Validate command safety
    if (!commandGenerator.isCommandSafe(command.command)) {
      return;
    }

    console.log(`[Extension] Auto-installing ${issue.packageName}`);

    // Execute in terminal silently (don't show terminal)
    await commandRegistry.executeInTerminal(command.command, false);
  } catch (error) {
    console.error(`[Extension] Auto-install error for ${issue.packageName}:`, error);
  }
}

/**
 * Process terminal output and detect issues (auto-install silently)
 */
async function processTerminalOutput(output: string): Promise<void> {
  if (!output || output.length === 0) {
    return;
  }

  const result = errorAnalyzer.analyzeError(output);

  if (result.detected && result.issue) {
    const issue = result.issue;
    console.log(`[Extension] Dependency issue detected: ${issue.packageName}`);
    webviewProvider.displayIssue(issue);
    await autoInstallDependency(issue);
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
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Extension] Installation error:', error);

    webviewProvider.updateInstallationStatus('error', errorMessage);
    notificationManager.showInstallationError(issue.packageName, errorMessage);
  }
}

async function handleRefreshCommand(): Promise<void> {
  await refreshHealthDashboard();
  notificationManager.showStatusMessage('Dependency dashboard updated', 3000);
}

async function handleRepairCommand(): Promise<void> {
  if (!environmentManager) {
    return;
  }

  const plan = await environmentManager.createRepairPlan();
  vscode.window.showInformationMessage(plan, { modal: false });
}

async function handleCreateEnvironmentCommand(): Promise<void> {
  if (!environmentManager) {
    return;
  }

  const summary = await environmentManager.ensureProjectEnvironment();
  if (summary) {
    webviewProvider.displayDashboard(summary);
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
