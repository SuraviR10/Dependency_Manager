/**
 * Dependify – Smart Dependency & Environment Manager
 * Main extension entry point
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
import { SafeCommandExecutor } from './security/safeCommandExecutor';
import { PackageValidator } from './security/packageValidator';
import { SnapshotManager } from './services/snapshot/snapshotManager';
import { ConflictDetector } from './services/conflictDetector';
import {
  DependencyIssue, SupportedLanguage, IssueType, IssueSeverity,
  ActivityType, ActivitySeverity,
} from './types/types';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

// Module-level singletons
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
let executor: SafeCommandExecutor;
let packageValidator: PackageValidator;
let snapshotManager: SnapshotManager;
let conflictDetector: ConflictDetector;
let scanTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log("[📦 Dependify] Activation Started");

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Core services
  settingsManager    = new SettingsManager(context);
  activityTracker    = new ActivityTracker();
  notificationManager = new NotificationManager(context);
  notificationManager.setNotificationLevel(settingsManager.notificationLevel);
  console.log("[📦 Dependify] Core Services Initialized");

  // Security layer
  executor           = new SafeCommandExecutor(activityTracker);
  packageValidator   = new PackageValidator();
  snapshotManager    = new SnapshotManager(workspacePath);
  conflictDetector   = new ConflictDetector(workspacePath);
  console.log("[📦 Dependify] Security Layer Initialized");

  // Analysis
  errorAnalyzer      = new ErrorAnalyzer(workspacePath);
  dependencyScanner  = new DependencyScanner(workspacePath);
  commandGenerator   = new InstallCommandGenerator();
  console.log("[📦 Dependify] Scanner Initialized");

  // Commands & environment
  commandRegistry    = new CommandRegistry(context, commandGenerator, executor);
  environmentManager = new EnvironmentManager(workspacePath, commandGenerator, context, settingsManager, executor);
  console.log("[📦 Dependify] Environment Manager Initialized");

  // UI
  webviewProvider       = new WebviewProvider(context, commandGenerator);
  activityPanelProvider = new ActivityPanelProvider(context, activityTracker);
  console.log("[📦 Dependify] Dashboard Ready");

  // Install queue (uses executor for safety)
  installQueue = new InstallQueue(
    commandRegistry, commandGenerator, activityTracker,
    notificationManager, settingsManager, executor
  );

  // Terminal monitor
  terminalMonitor = new TerminalMonitor(errorAnalyzer);

  // Keep notification level in sync
  settingsManager.onDidChange(() => {
    notificationManager.setNotificationLevel(settingsManager.notificationLevel);
  });

  // Register commands
  commandRegistry.registerCommands();

  // Register webview providers
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('smartDependencyPanel', webviewProvider),
    vscode.window.registerWebviewViewProvider('smartActivityPanel', activityPanelProvider)
  );

  // Wire up all listeners and handlers
  setupTerminalListener(context);
  setupWorkspaceListeners(context);
  setupCommandHandlers(context);
  setupWebviewHandlers(context);

  // Start terminal monitoring
  terminalMonitor.startMonitoring();

  // Initial scan
  if (settingsManager.scanOnStartup && settingsManager.healthCheck) {
    setTimeout(() => { void refreshHealthDashboard(); }, 1200);
  }

  // Auto environment setup (only if explicitly enabled)
  if (settingsManager.autoCreateEnv) {
    setTimeout(() => { void environmentManager.ensureProjectEnvironment(); }, 5000);
  }

  activityTracker.logActivity(
    ActivityType.ScanCompleted, ActivitySeverity.Info,
    '📦🚀 Dependify Ready',
    { description: 'Extension initialized and monitoring for dependency issues' }
  );

  console.log("[📦 Dependify] Activation Completed");
}

// ─── Health Dashboard ─────────────────────────────────────────────────────────

async function refreshHealthDashboard(): Promise<void> {
  if (!dependencyScanner || !webviewProvider) { return; }
  try {
    const scan = await dependencyScanner.scanWorkspace(settingsManager?.supportedLanguages);
    const summary = dependencyScanner.createSummary(scan);

    // Run conflict detection alongside scan
    const conflictReports = await Promise.all(
      scan.languages.map(lang => conflictDetector.detectConflicts(lang))
    );
    const allConflicts = conflictReports.flatMap(r => r.conflicts);

    // Inject conflict count into health score
    if (allConflicts.length > 0) {
      summary.healthScore = Math.max(0, summary.healthScore - allConflicts.length * 10);
      activityTracker.updateProjectHealth({ 
        versionConflicts: allConflicts.length,
        storageUsed: await calculateStorageUsage(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '')
      });
    }

    webviewProvider.displayDashboard(summary, allConflicts);
    activityTracker.logScanCompleted(
      scan.scannedFiles,
      scan.missingPackages.size,
      scan.pythonPackages.size + scan.nodePackages.size
    );
  } catch (error) {
    console.error('[Extension] Failed to refresh health dashboard:', error);
  }
}

/**
 * Calculates actual storage used by dependency folders (node_modules, .venv)
 */
async function calculateStorageUsage(dirPath: string): Promise<number> {
  if (!dirPath) { return 0; }
  let totalBytes = 0;
  const targetDirs = ['node_modules', '.venv', 'venv'];
  const execFileAsync = util.promisify(cp.execFile);
  
  for (const target of targetDirs) {
    try {
      const targetPath = path.join(dirPath, target);
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        if (process.platform === 'win32') {
          const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `(Get-ChildItem '${targetPath}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`], { timeout: 10000 });
          const bytes = parseInt(stdout.trim(), 10);
          if (!isNaN(bytes)) { totalBytes += bytes; }
        } else {
          const { stdout } = await execFileAsync('du', ['-sm', targetPath], { timeout: 10000 });
          totalBytes += parseInt(stdout.toString().split('\t')[0], 10) * 1024 * 1024;
        }
      }
    } catch (e) {
      // Directory doesn't exist or inaccessible
    }
  }
  return Math.round(totalBytes / (1024 * 1024)); // returns size in MB
}

// ─── Workspace Listeners ──────────────────────────────────────────────────────

function setupWorkspaceListeners(context: vscode.ExtensionContext): void {
  const ignoredPattern = /(?:[\\/](?:node_modules|\.venv|venv|\.git|\.vscode|dist|build|out|__pycache__|\.vscode-test|target|coverage)[\\/])/i;

  const shouldRefresh = (doc: vscode.TextDocument): boolean => {
    if (doc.uri.scheme !== 'file') { return false; }
    if (ignoredPattern.test(doc.uri.fsPath)) { return false; }
    const lang = getLanguageFromDocument(doc);
    return !!lang && settingsManager.isLanguageSupported(lang);
  };

  const scheduleRefresh = () => {
    if (scanTimeout) { clearTimeout(scanTimeout); }
    scanTimeout = setTimeout(() => { void refreshHealthDashboard(); }, settingsManager.scanDelayMs);
  };

  if (settingsManager.scanOnSave) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(doc => { if (shouldRefresh(doc)) { scheduleRefresh(); } })
    );
  }

  if (settingsManager.scanOnOpen) {
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(doc => { if (shouldRefresh(doc)) { scheduleRefresh(); } })
    );
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(scheduleRefresh),
    vscode.workspace.onDidChangeTextDocument(e => { if (shouldRefresh(e.document)) { scheduleRefresh(); } })
  );
}

function getLanguageFromDocument(doc: vscode.TextDocument): SupportedLanguage | undefined {
  const id = doc.languageId.toLowerCase();
  if (id === 'python') { return SupportedLanguage.Python; }
  if (['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(id)) {
    return SupportedLanguage.NodeJS;
  }
  return undefined;
}

// ─── Terminal Listener ────────────────────────────────────────────────────────

function setupTerminalListener(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => { /* intentionally empty */ }),
    vscode.window.onDidOpenTerminal(() => { /* intentionally empty */ }),

    vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
      if (event.event === 'output') {
        void processTerminalOutput((event.body as Record<string, string>)?.output ?? '');
      }
    }),

    vscode.commands.registerCommand('smartDependencyAssistant.checkTerminal', () => {
      const active = vscode.window.activeTerminal;
      if (active) {
        void processTerminalOutput(terminalMonitor.getTerminalOutput(active));
      }
    }),

    vscode.languages.onDidChangeDiagnostics(event => {
      for (const uri of event.uris) {
        processDiagnostics(vscode.languages.getDiagnostics(uri));
      }
    })
  );

  terminalMonitor.onError(output => { void processTerminalOutput(output); });
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

const recentlyProcessedDiagnostics = new Set<string>();

function processDiagnostics(diagnostics: vscode.Diagnostic[]): void {
  for (const diag of diagnostics) {
    const msg = diag.message.toLowerCase();

    // Explicitly check for Pylance diagnostic codes
    let isPylanceMissing = false;
    if (diag.source === 'Pylance' && diag.code) {
      const codeValue = typeof diag.code === 'object' ? diag.code.value : diag.code;
      if (codeValue === 'reportMissingImports' || codeValue === 'reportMissingModuleSource') {
        isPylanceMissing = true;
      }
    }

    const isMissingImport = isPylanceMissing || (
      msg.includes('import') &&
      (msg.includes('could not be resolved') || msg.includes('no module') || msg.includes('cannot find'))
    );

    if (!isMissingImport) { continue; }

    const match = diag.message.match(/["']([a-zA-Z0-9_.-]+)['"]/);
    if (!match?.[1]) { continue; }

    let packageName = match[1];
    let lang = issueLanguageFromDiagnostic(diag);
    if (!lang) {
      const ext = vscode.window.activeTextEditor?.document.uri.fsPath.split('.').pop();
      if (ext === 'py') { lang = 'python'; }
      else if (['js', 'ts', 'jsx', 'tsx'].includes(ext ?? '')) { lang = 'nodejs'; }
    }
    if (!lang) { continue; }

    // Map common import names to correct PyPI package names
    if (lang === 'python') {
      const packageMap: Record<string, string> = {
        'cv2': 'opencv-python',
        'sklearn': 'scikit-learn',
        'bs4': 'beautifulsoup4',
        'PIL': 'Pillow',
        'yaml': 'PyYAML',
        'dotenv': 'python-dotenv'
      };
      if (packageMap[packageName]) {
        packageName = packageMap[packageName];
      }
    }

    // Prevent rapid notification spam for the same package
    const issueKey = `${lang}:${packageName}`;
    if (recentlyProcessedDiagnostics.has(issueKey)) { continue; }
    recentlyProcessedDiagnostics.add(issueKey);
    setTimeout(() => recentlyProcessedDiagnostics.delete(issueKey), 30000);

    const issue: DependencyIssue = {
      id: `${Date.now()}-${packageName}`,
      type: IssueType.MissingDependency,
      language: lang === 'python' ? SupportedLanguage.Python : SupportedLanguage.NodeJS,
      packageName,
      originalError: diag.message,
      explanation: `The import "${packageName}" could not be resolved. The package is likely missing from your environment.`,
      severity: IssueSeverity.High,
      confidence: 80,
      suggestedCommand: lang === 'python' ? `pip install ${packageName}` : `npm install ${packageName}`,
      timestamp: Date.now(),
    };

    activityTracker.logErrorDetected('Missing Import', packageName);
    void handleDependencyIssue(issue);
  }
}

function issueLanguageFromDiagnostic(diag: vscode.Diagnostic): 'python' | 'nodejs' | undefined {
  const src = diag.source?.toLowerCase() ?? '';
  if (src.includes('python') || src.includes('pylance')) { return 'python'; }
  if (src.includes('javascript') || src.includes('typescript') || src.includes('eslint')) { return 'nodejs'; }
  return undefined;
}

// ─── Issue Handling ───────────────────────────────────────────────────────────

async function handleDependencyIssue(issue: DependencyIssue): Promise<void> {
  if (!issue?.packageName) { return; }

  // Security: validate package name before doing anything
  const nameError = executor.validatePackageName(issue.packageName);
  if (nameError) {
    notificationManager.appendLog(`[Security] Rejected invalid package name: ${issue.packageName}`);
    return;
  }

  let generatedCmd = commandGenerator.generateCommand(issue).command;
  // Ensure virtual environment is activated before installing Python packages
  if (issue.language === SupportedLanguage.Python) {
    const isWindows = process.platform === 'win32';
    const activateCmd = isWindows ? '.\\.venv\\Scripts\\activate' : 'source .venv/bin/activate';
    const separator = isWindows ? ' ; ' : ' && ';
    generatedCmd = `${activateCmd}${separator}${generatedCmd}`;
  }
  issue.suggestedCommand = generatedCmd;

  // Hybrid AI Explanation integration
  try {
    const models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
    if (models && models.length > 0) {
      const messages = [vscode.LanguageModelChatMessage.User(`Explain this dependency error simply to a beginner: ${issue.originalError}`)];
      const chatResponse = await models[0].sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
      let aiText = '';
      for await (const fragment of chatResponse.text) {
        aiText += fragment;
      }
      if (aiText) {
        issue.explanation = aiText;
      }
    }
  } catch (e) {
    // Fallback to local regex explanation
  }

  webviewProvider.displayIssue(issue);
  activityTracker.logErrorDetected('Dependency Issue', issue.packageName);
  notificationManager.showStatusMessage(`📦 Dependify: Detected missing package "${issue.packageName}"`, 4500);

  if (!settingsManager.shouldAutoInstall()) {
    notificationManager.showInfo(
      `Missing dependency: "${issue.packageName}". Run: ${issue.suggestedCommand}`
    );
    return;
  }

  // Pre-install: verify package exists in registry
  if (settingsManager.verifyPackagesBeforeInstall) {
    const validation = await packageValidator.verify(issue.packageName, issue.language);
    if (!validation.exists) {
      void vscode.window.showWarningMessage(
        `📦 Dependify: Package "${issue.packageName}" was not found in the registry. Installation cancelled.`
      );
      return;
    }
  }

  const canInstall = !settingsManager.shouldConfirmBeforeInstall() ||
    await commandRegistry.showInstallConfirmation(issue);
  if (!canInstall) { return; }

  // Snapshot before install for rollback
  await snapshotManager.capture(`Before install ${issue.packageName}`);

  installQueue.enqueue(issue, issue.suggestedCommand);
}

async function processTerminalOutput(output: string): Promise<void> {
  if (!output) { return; }
  const result = errorAnalyzer.analyzeError(output);
  if (result.detected && result.issue) {
    await handleDependencyIssue(result.issue);
  }
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

function setupCommandHandlers(_context: vscode.ExtensionContext): void {
  commandRegistry.onInstall(async issue => { await handleInstallCommand(issue); });

  commandRegistry.onCopy((_command, _packageName) => {
    notificationManager.showStatusMessage(`Copied to clipboard`, 3000);
  });

  commandRegistry.onRefresh(async () => { await handleRefreshCommand(); });
  commandRegistry.onRepair(async () => { await handleRepairCommand(); });
  commandRegistry.onCreateEnvironment(async () => { await handleCreateEnvironmentCommand(); });
  commandRegistry.onCleanup(async () => { await handleCleanupCommand(); });
}

async function handleInstallCommand(issue: DependencyIssue): Promise<void> {
  webviewProvider.updateInstallationStatus('installing');
  notificationManager.showInstallationStarted(issue.packageName);

  try {
    const envStatus = await environmentManager.checkAndPromptEnvironment(issue.language);
    if (envStatus === 'cancel') {
      webviewProvider.updateInstallationStatus('error', 'Installation cancelled by user due to missing environment.');
      return;
    }

    let commandToExecute = issue.suggestedCommand;
    if (!commandToExecute) {
      commandToExecute = commandGenerator.generateCommand(issue).command;
      if (issue.language === SupportedLanguage.Python && !commandToExecute.includes('activate')) {
        const isWindows = process.platform === 'win32';
        commandToExecute = isWindows ? `.\\.venv\\Scripts\\activate ; ${commandToExecute}` : `source .venv/bin/activate && ${commandToExecute}`;
      }
    }

    // Pre-install registry verification
    if (settingsManager.verifyPackagesBeforeInstall) {
      const validation = await packageValidator.verify(issue.packageName, issue.language);
      if (!validation.exists) {
        webviewProvider.updateInstallationStatus('error', `Package "${issue.packageName}" not found in registry`);
        void vscode.window.showWarningMessage(
          `📦 Dependify: Package "${issue.packageName}" was not found in the registry. Installation cancelled.`
        );
        return;
      }
    }

    // Snapshot before mutating
    await snapshotManager.capture(`Before install ${issue.packageName}`);

    const success = await commandRegistry.executeInTerminal(commandToExecute, issue.packageName, false);

    if (success) {
      webviewProvider.updateInstallationStatus('success');
      notificationManager.showInstallationSuccess(issue.packageName);
      activityTracker.logDependencyInstalled(issue.packageName);
      activityTracker.logCommand(commandToExecute, issue.packageName, true);

      const response = await notificationManager.showWithActions(
        `✓ "${issue.packageName}" installation started. Check the terminal for progress.`,
        ['Open Terminal', 'Rollback']
      );
      if (response === 'Open Terminal') {
        vscode.window.activeTerminal?.show();
      } else if (response === 'Rollback') {
        await snapshotManager.restoreLatest();
      }
    } else {
      webviewProvider.updateInstallationStatus('error', 'Failed to open terminal');
      activityTracker.logDependencyFailed(issue.packageName, 'Failed to open terminal');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    webviewProvider.updateInstallationStatus('error', msg);
    notificationManager.showInstallationError(issue.packageName, msg);
    activityTracker.logDependencyFailed(issue.packageName, msg);
  }
}

async function handleRefreshCommand(): Promise<void> {
  await refreshHealthDashboard();
  notificationManager.showStatusMessage('Dependency dashboard updated', 3000);
}

async function handleRepairCommand(): Promise<void> {
  if (!environmentManager) { return; }
  const plan = await environmentManager.createRepairPlan();
  activityTracker.logActivity(
    ActivityType.EnvironmentModified, ActivitySeverity.Info,
    '🔧 Environment Repair Initiated',
    { description: 'Repair plan generated for project environment' }
  );
  void vscode.window.showInformationMessage(plan, { modal: false });
}

async function handleCreateEnvironmentCommand(): Promise<void> {
  if (!environmentManager) { return; }
  await snapshotManager.capture('Before environment creation');
  const summary = await environmentManager.ensureProjectEnvironment();
  if (summary) {
    webviewProvider.displayDashboard(summary, []);
    activityTracker.logEnvironmentCreated('Project', {
      language: summary.languages.join(', '),
      dependenciesDetected: String(summary.usedPackages.length),
    });
    void vscode.window.showInformationMessage('Project environment setup completed.');
  }
}

async function handleCleanupCommand(): Promise<void> {
  const scan = await dependencyScanner.scanWorkspace();
  const unused = Array.from(scan.unusedPackages);

  if (unused.length === 0) {
    void vscode.window.showInformationMessage('No unused dependencies detected.');
    return;
  }

  await snapshotManager.capture(`Before cleanup (${unused.length} packages)`);

  for (const dep of unused) {
    activityTracker.logDependencyRemoved(dep);
  }

  void vscode.window.showWarningMessage(
    `Unused dependencies: ${unused.join(', ')}. Consider removing them from your manifest.`,
    'Rollback'
  ).then(choice => {
    if (choice === 'Rollback') { void snapshotManager.restoreLatest(); }
  });
}

// ─── Webview Handlers ─────────────────────────────────────────────────────────

function setupWebviewHandlers(_context: vscode.ExtensionContext): void {
  webviewProvider.onInstall(issue => { void handleInstallCommand(issue); });

  webviewProvider.onCopy(command => {
    void vscode.env.clipboard.writeText(command).then(() => {
      notificationManager.showStatusMessage(`Copied: ${command}`, 2000);
    });
  });

  webviewProvider.onDismissIssue(issueId => {
    const active = vscode.window.activeTerminal;
    if (active) { terminalMonitor.clearTerminalBuffer(active); }
    notificationManager.appendLog(`Issue dismissed: ${issueId}`);
  });

  webviewProvider.onPanelAction(async action => {
    switch (action) {
      case 'refresh':           await handleRefreshCommand(); break;
      case 'repair':            await handleRepairCommand(); break;
      case 'createEnvironment': await handleCreateEnvironmentCommand(); break;
      case 'cleanup':           await handleCleanupCommand(); break;
    }
  });
}

// ─── Deactivation ─────────────────────────────────────────────────────────────

export function deactivate(): void {
  if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = undefined; }
  terminalMonitor?.stopMonitoring();
  activityTracker?.dispose();
  packageValidator?.clearCache();
}
