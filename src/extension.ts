/**
 * DARTX – Smart Dependency & Environment Manager
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
import { EnvironmentDoctor } from './services/environmentDoctor';
import { ProjectSetupWizard } from './services/projectSetupWizard';
import { DependencySync } from './services/dependencySync';
import { PackageRecommender } from './services/packageRecommender';
import { TeamEnvironmentSharing } from './services/teamEnvironmentSharing';
import { EnhancedConflictResolver } from './services/enhancedConflictResolver';
import { WorkspaceDashboard } from './services/workspaceDashboard';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

// Module-level singletons
import {
  DependencyIssue, SupportedLanguage, IssueType, IssueSeverity,
  ActivityType, ActivitySeverity,
} from './types/types';
let extensionContext: vscode.ExtensionContext;
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
let environmentDoctor: EnvironmentDoctor;
let projectSetupWizard: ProjectSetupWizard;
let dependencySync: DependencySync;
let packageRecommender: PackageRecommender;
let teamEnvironmentSharing: TeamEnvironmentSharing;
let enhancedConflictResolver: EnhancedConflictResolver;
let workspaceDashboard: WorkspaceDashboard;
let scanTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log("[DARTX] Activation Started");
  extensionContext = context;
  
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Core services
  settingsManager    = new SettingsManager(context);
  activityTracker    = new ActivityTracker();
  notificationManager = new NotificationManager(context);
  notificationManager.setNotificationLevel(settingsManager.notificationLevel);
  console.log("[DARTX] Core Services Initialized");

  // Security layer
  executor           = new SafeCommandExecutor(activityTracker);
  packageValidator   = new PackageValidator();
  snapshotManager    = new SnapshotManager(workspacePath);
  conflictDetector   = new ConflictDetector(workspacePath);
  console.log("[DARTX] Security Layer Initialized");

  // Analysis
  errorAnalyzer      = new ErrorAnalyzer(workspacePath);
  dependencyScanner  = new DependencyScanner(workspacePath);
  commandGenerator   = new InstallCommandGenerator();
  console.log("[DARTX] Scanner Initialized");

  // Commands & Environment
  commandRegistry    = new CommandRegistry(context, commandGenerator, executor);
  environmentManager = new EnvironmentManager(workspacePath, commandGenerator, context, settingsManager, executor);
  console.log("[DARTX] Environment Manager Initialized");

  // UI
  // Note: These are WebviewViewProviders, which are not truly "lazy" as VS Code might activate them on UI redraw,
  // but their content loading can be lazy.
  webviewProvider       = new WebviewProvider(context, commandGenerator);
  activityPanelProvider = new ActivityPanelProvider(context, activityTracker);
  console.log("[DARTX] Dashboard Ready");

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

  // Register webview providers for sidebar panels
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

  // Initial scan is now off by default to improve startup performance.
  if (settingsManager.scanOnStartup && settingsManager.healthCheck) {
    setTimeout(() => { void refreshHealthDashboard(); }, 1200);
  }

  // Auto environment setup (only if explicitly enabled)
  if (settingsManager.autoCreateEnv) {
    setTimeout(() => { void environmentManager.ensureProjectEnvironment(); }, 5000);
  }

  activityTracker.logActivity(
    ActivityType.ScanCompleted, ActivitySeverity.Info,
    'Extension Ready',
    { description: 'Extension initialized and monitoring for dependency issues' }
  );

  console.log("[DARTX] Activation Completed");
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
      vscode.workspace.onDidSaveTextDocument(doc => { 
        try {
          if (shouldRefresh(doc)) { 
            scheduleRefresh(); 
            processDiagnostics(vscode.languages.getDiagnostics(doc.uri));
          } 
        } catch (error) {
          console.error('[DARTX] Non-blocking error during save diagnostics:', error);
        }
      })
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
    })
  );

  terminalMonitor.onError(output => { void processTerminalOutput(output); });
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

const recentlyProcessedDiagnostics = new Set<string>();

function processDiagnostics(diagnostics: vscode.Diagnostic[]): void {
  try {
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
  
      // Filter out incomplete/single-character package names to prevent false positives while typing
      // Only process package names with at least 2 characters and that don't look like partial input
      if (packageName.length < 2 || /^[a-z]$/.test(packageName)) { continue; }
  
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
          'dotenv': 'python-dotenv',
          'jwt': 'PyJWT',
          'redis': 'redis',
          'requests': 'requests',
          'sqlalchemy': 'SQLAlchemy',
          'dateutil': 'python-dateutil'
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
  } catch (error) {
    console.error('[DARTX] Non-blocking error in diagnostic processing:', error);
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
  // Feature: Memory of previous fixes. Check if we have a known good fix.
  const fixHistory = extensionContext.globalState.get<Record<string, string>>('dartx.fixHistory', {});
  const issueKey = `${issue.language}:${issue.packageName}`;
  if (fixHistory[issueKey]) {
    issue.suggestedCommand = fixHistory[issueKey];
    issue.confidence = 100; // Previously successful fix, max confidence.
    issue.explanation += " A previously successful fix for this issue was found and will be used.";
  }

  let generatedCmd = commandGenerator.generateCommand(issue).command;
  issue.suggestedCommand = generatedCmd;

  // Improvement: Removed external AI call for explanations to improve performance and reliability.
  // Keep local explanations from errorAnalyzer.ts or provide a simple default.
  // try {
  //   const models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
  //   ...
  // } catch (e) {
  //   // Fallback to local regex explanation
  // }

  activityTracker.logErrorDetected('Missing Dependency', issue.packageName);

  // UX Change: Silent-first design. Use notifications, not automatic panel opening.
  const hasBeenPrompted = extensionContext.globalState.get('dartx.promptedForAutoInstall', false);

  // 1. Auto-install silently if enabled and confidence is high
  if (settingsManager.shouldAutoInstall() && issue.confidence >= 80) {
    await performAutoInstall(issue);
    return;
  }

  // 2. First-time user experience: Prompt to enable auto-install
  if (!settingsManager.shouldAutoInstall() && !hasBeenPrompted) {
    await extensionContext.globalState.update('dartx.promptedForAutoInstall', true);
    const choice = await notificationManager.showWithActions(
      `DARTX: Detected missing package '${issue.packageName}'. Enable automatic installation for trusted packages?`,
      ['Enable Auto-Install', 'Install Once', 'View Details']
    );

    if (choice === 'Enable Auto-Install') {
      // FIX: settingsManager.update does not exist. Call vscode config API directly.
      await vscode.workspace.getConfiguration('dartx').update('autoInstall', true, vscode.ConfigurationTarget.Global);
      notificationManager.showStatusMessage('DARTX: Auto-install enabled. Installing...', 3000);
      await performAutoInstall(issue);
    } else if (choice === 'Install Once') {
      await performManualInstall(issue);
    } else if (choice === 'View Details') {
      webviewProvider.displayIssue(issue);
    }
  } else {
    // 3. Standard notification for returning users or those with auto-install disabled
    const choice = await notificationManager.showWithActions(
      `DARTX: Detected missing package '${issue.packageName}'.`,
      ['Install', 'View Details']
    );
    if (choice === 'Install') {
      await performManualInstall(issue);
    } else if (choice === 'View Details') {
      webviewProvider.displayIssue(issue);
    }
  }
}

async function performAutoInstall(issue: DependencyIssue): Promise<void> {
  // Enqueue for installation without user confirmation, as they've opted in.
  installQueue.enqueue(issue, issue.suggestedCommand);
}

async function performManualInstall(issue: DependencyIssue): Promise<void> {
  const canInstall = !settingsManager.shouldConfirmBeforeInstall() || await commandRegistry.showInstallConfirmation(issue);
  if (canInstall) { // User confirmed, now enqueue for installation
    // The InstallQueue will handle validation, snapshotting, and execution
    installQueue.enqueue(issue, issue.suggestedCommand);
  }
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

  // New Feature Commands
  _context.subscriptions.push(
      vscode.commands.registerCommand('dartx.runEnvironmentDoctor', async () => {
          await handleEnvironmentDoctorCommand();
      }),
      vscode.commands.registerCommand('dartx.setupProject', async () => {
          await handleProjectSetupCommand();
      }),
      vscode.commands.registerCommand('dartx.syncDependencies', async () => {
          await handleDependencySyncCommand();
      }),
      vscode.commands.registerCommand('dartx.exportEnvironment', async () => {
          await handleExportEnvironmentCommand();
      }),
      vscode.commands.registerCommand('dartx.showDashboard', async () => {
          await handleShowDashboardCommand();
      }),
      // Legacy command IDs for compatibility, can be removed in a future version
      vscode.commands.registerCommand('smartDependencyAssistant.runEnvironmentDoctor', handleEnvironmentDoctorCommand),
      vscode.commands.registerCommand('smartDependencyAssistant.setupProject', handleProjectSetupCommand),
      vscode.commands.registerCommand('smartDependencyAssistant.syncDependencies', handleDependencySyncCommand),
      vscode.commands.registerCommand('smartDependencyAssistant.exportEnvironment', handleExportEnvironmentCommand),
      vscode.commands.registerCommand('smartDependencyAssistant.showDashboard', handleShowDashboardCommand),
      vscode.commands.registerCommand('smartDependencyAssistant.checkTerminal', () => {
        const active = vscode.window.activeTerminal;
        if (active) {
          void processTerminalOutput(terminalMonitor.getTerminalOutput(active));
        }
      }),
      // Placeholder handlers for future features or until they are fully implemented
      vscode.commands.registerCommand('dartx.impactAnalysis', () => {
        notificationManager.showInfo('DARTX: Impact Analysis feature is not yet implemented.');
      }),
      vscode.commands.registerCommand('dartx.upgradeAdvisor', () => {
        notificationManager.showInfo('DARTX: Smart Upgrade Advisor feature is not yet implemented.');
      }),
      vscode.commands.registerCommand('dartx.knowledgeGraph', () => {
        notificationManager.showInfo('DARTX: Dependency Knowledge Graph feature is not yet implemented.');
      }),
      vscode.commands.registerCommand('dartx.openPanel', () => {
        if (webviewProvider) {
          vscode.commands.executeCommand('workbench.view.extension.dartx'); // Opens the DARTX activity bar view
        }
      })
  );
}

async function handleInstallCommand(issue: DependencyIssue): Promise<void> {
  webviewProvider.updateInstallationStatus('installing');
  notificationManager.showInstallationStarted(issue.packageName);

  // The Installation Queue already handles pre-install validation, snapshotting
  try {
    const envStatus = await environmentManager.checkAndPromptEnvironment(issue.language);
    if (envStatus === 'cancel') {
      webviewProvider.updateInstallationStatus('error', 'Installation cancelled by user due to missing environment.');
      return;
    }

    let commandToExecute = issue.suggestedCommand;
    if (!commandToExecute) {
      commandToExecute = commandGenerator.generateCommand(issue).command;
    }

    // Pre-install registry verification
    if (settingsManager.verifyPackagesBeforeInstall) {
      const validation = await packageValidator.verify(issue.packageName, issue.language);
      if (!validation.exists) {
        webviewProvider.updateInstallationStatus('error', `Package "${issue.packageName}" not found in registry`);
        notificationManager.showWarning(
          `DARTX: Package "${issue.packageName}" was not found in the registry. Installation cancelled.`
        );
        return;
      }
    }

    // Snapshot before mutating
    await snapshotManager.capture(`Before install ${issue.packageName}`);

    const success = await commandRegistry.executeInTerminal(commandToExecute, issue.packageName, false);

    if (success) {
      webviewProvider.updateInstallationStatus('success');

      // Feature: Memory of previous fixes. Store the successful fix.
      const fixHistory = extensionContext.globalState.get<Record<string, string>>('dartx.fixHistory', {});
      const issueKey = `${issue.language}:${issue.packageName}`;
      fixHistory[issueKey] = commandToExecute;
      await extensionContext.globalState.update('dartx.fixHistory', fixHistory);

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
    'Environment Repair Initiated',
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

// ─── New Feature Handlers ─────────────────────────────────────────────────────

async function handleEnvironmentDoctorCommand(): Promise<void> {
  notificationManager.showStatusMessage('Running Environment Doctor...', 3000);
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Lazy loading of the service
  if (!environmentDoctor) {
    environmentDoctor = new EnvironmentDoctor(workspacePath);
  }
  
  try {
    const report = await environmentDoctor.diagnose();    const output = vscode.window.createOutputChannel('DARTX: Environment Doctor');
    output.clear();
    output.show();

    output.appendLine('===================================================');
    output.appendLine(' 🩺 DARTX ENVIRONMENT DOCTOR REPORT');
    output.appendLine('===================================================\n');
    output.appendLine(`Health Score: ${report.healthScore}/100`);
    output.appendLine(`Summary: ${report.summary}\n`);

    // Python
    if (report.python.installed) {
      output.appendLine(`[OK] Python ${report.python.version} installed`);
    } else {
      output.appendLine(`[ERROR] Python not installed`);
    }

    // Node.js
    if (report.node.installed) {
      output.appendLine(`[OK] Node.js ${report.node.version} installed`);
    }

    // Virtual Environment
    if (report.venv.exists) {
      output.appendLine(`[OK] Virtual environment found: ${report.venv.path}`);
      output.appendLine(`   Status: ${report.venv.active ? 'ACTIVE' : 'INACTIVE'}`);
    } else {
      output.appendLine(`[WARNING] No virtual environment found`);
    }

    // Interpreter
    if (report.interpreter.correct) {
      output.appendLine(`[OK] Python interpreter configured: ${report.interpreter.selected}`);
    } else {
      output.appendLine(`[ERROR] Python interpreter not configured or invalid`);
    }

    // Issues
    if (report.issues.length > 0) {
      output.appendLine('\n===================================================\n');
      output.appendLine('DETECTED ISSUES:\n');
      
      for (const issue of report.issues) {
        output.appendLine(`[${issue.severity.toUpperCase()}] ${issue.title}`);
        output.appendLine(`Description: ${issue.description}`);
        if (issue.currentValue) output.appendLine(`Current: ${issue.currentValue}`);
        if (issue.expectedValue) output.appendLine(`Expected: ${issue.expectedValue}`);
        output.appendLine(`Fix: ${issue.suggestedFix}`);
        output.appendLine('');
      }
    } else {
      output.appendLine('\n[OK] No issues detected!');
    }

    activityTracker.logActivity(
      ActivityType.EnvironmentChecked, ActivitySeverity.Info,
      'Environment Doctor Completed',
      { description: `Health score: ${report.healthScore}/100, Issues: ${report.issues.length}` }
    );
  } catch (error) {
    notificationManager.showError(`Environment Doctor failed: ${error}`);
  }
}

async function handleProjectSetupCommand(): Promise<void> {
  notificationManager.showStatusMessage('Analyzing project...', 3000);
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Lazy loading of the service
  if (!projectSetupWizard) {
    projectSetupWizard = new ProjectSetupWizard(workspacePath, environmentManager, dependencyScanner);
  }

  try {
    const projectInfo = await projectSetupWizard.analyzeProject();
    
    const message = `${projectInfo.type.toUpperCase()} project detected (${projectInfo.pythonFiles} Python files, ${projectInfo.nodeFiles} Node files).`;
    
    if (projectInfo.setupSteps.length === 0) {
      vscode.window.showInformationMessage(`${message} No setup needed!`);
      return;
    }

    const proceed = await vscode.window.showQuickPick(
      ['Yes', 'Cancel'],
      { placeHolder: `${message} Start one-click setup?` }
    );

    if (proceed === 'Yes') {
      notificationManager.showStatusMessage('Starting project setup...', 2000);
      const results = await projectSetupWizard.executeSetup(projectInfo);
      
      activityTracker.logActivity(
        ActivityType.ProjectSetup, ActivitySeverity.Info,
        'Project Setup Completed',
        { description: `Completed ${results.length} setup steps` }
      );
    }
  } catch (error) {
    notificationManager.showError(`Project setup failed: ${error}`);
  }
}

async function handleDependencySyncCommand(): Promise<void> {
  notificationManager.showStatusMessage('Syncing dependencies...', 2000);
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Lazy loading of the service
  if (!dependencySync) {
    dependencySync = new DependencySync(workspacePath);
  }

  try {
    const [pythonResult, nodeResult] = await Promise.all([
      dependencySync.syncPythonDependencies(),
      dependencySync.syncNodeDependencies(),
    ]);

    const output = vscode.window.createOutputChannel('DARTX: Dependency Sync');
    output.clear();
    output.show();

    output.appendLine('===================================================');
    output.appendLine(' 🔄 DARTX DEPENDENCY SYNC REPORT');
    output.appendLine('===================================================\n');

    output.appendLine(`Python: ${pythonResult.summary}`);
    output.appendLine(`Node.js: ${nodeResult.summary}`);

    if (pythonResult.errors.length > 0 || nodeResult.errors.length > 0) {
      output.appendLine('\nWarnings/Errors:');
      [...pythonResult.errors, ...nodeResult.errors].forEach(e => output.appendLine(`  - ${e}`));
    }

    activityTracker.logActivity(
      ActivityType.DependenciesSynced, ActivitySeverity.Info,
      'Dependencies Synced',
      { description: 'Installed packages synchronized with manifest files' }
    );

    notificationManager.showInfo('Dependencies synced successfully!');
  } catch (error) {
    notificationManager.showError(`Dependency sync failed: ${error}`);
  }
}

async function handleExportEnvironmentCommand(): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter environment snapshot name:',
    value: `env-${new Date().toISOString().split('T')[0]}`,
  });

  if (!name) return;

  const description = await vscode.window.showInputBox({
    prompt: 'Add a description (optional):',
  });

  // FIX: Lazy load the service to prevent "used before being assigned" error.
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  if (!teamEnvironmentSharing) {
    teamEnvironmentSharing = new TeamEnvironmentSharing(workspacePath);
  }

  try {
    notificationManager.showStatusMessage('Exporting environment...', 2000);
    const snapshot = await teamEnvironmentSharing.exportEnvironment(name, description);
    
    notificationManager.showInfo(
      `Environment exported: ${snapshot.id}. You can share the .dartx-snapshots folder with your team.`
    );

    activityTracker.logActivity(
      ActivityType.EnvironmentExported, ActivitySeverity.Info,
      'Environment Snapshot Created',
      { description: `Snapshot: ${name}` }
    );
  } catch (error) {
    notificationManager.showError(`Export failed: ${error}`);
  }
}

async function handleShowDashboardCommand(): Promise<void> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Lazy loading of the service
  if (!workspaceDashboard) {
    workspaceDashboard = new WorkspaceDashboard(workspacePath, dependencyScanner);
  }

  try {
    const scan = await dependencyScanner.scanWorkspace(settingsManager?.supportedLanguages);
    const conflicts = await conflictDetector.detectConflicts(SupportedLanguage.Python);
    
    const dashboard = await workspaceDashboard.buildDashboard(scan, conflicts.conflicts.length);
    const html = workspaceDashboard.generateHTML(dashboard);

    const panel = vscode.window.createWebviewPanel(
      'dartxDashboard',
      'Dependency Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = html;

    activityTracker.logActivity(
      ActivityType.DashboardViewed, ActivitySeverity.Info,
      'Dashboard Viewed',
      { description: `Health Score: ${dashboard.overallScore}/100` }
    );
  } catch (error) {
    notificationManager.showError(`Dashboard failed: ${error}`);
  }
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
