import { DependencyIssue } from '../types/types';
import { ActivityTracker } from './activityTracker';
import { InstallCommandGenerator } from '../commands/installCommandGenerator';
import { CommandRegistry } from '../commands/commandRegistry';
import { NotificationManager } from '../ui/notificationManager';
import { SettingsManager } from './settingsManager';
import { SafeCommandExecutor } from '../security/safeCommandExecutor';
import { delay } from '../utils/helpers';

export class InstallQueue {
  private commandRegistry: CommandRegistry;
  private activityTracker: ActivityTracker;
  private notificationManager: NotificationManager;
  private settingsManager: SettingsManager;
  private commandGenerator: InstallCommandGenerator;
  private executor: SafeCommandExecutor;
  private items: Array<{ issue: DependencyIssue; command: string }> = [];
  private processing = false;
  private attemptedPackages = new Set<string>();

  constructor(
    commandRegistry: CommandRegistry,
    commandGenerator: InstallCommandGenerator,
    activityTracker: ActivityTracker,
    notificationManager: NotificationManager,
    settingsManager: SettingsManager,
    executor: SafeCommandExecutor
  ) {
    this.commandRegistry = commandRegistry;
    this.commandGenerator = commandGenerator;
    this.activityTracker = activityTracker;
    this.notificationManager = notificationManager;
    this.settingsManager = settingsManager;
    this.executor = executor;
  }

  public enqueue(issue: DependencyIssue, command: string): void {
    const packageKey = issue.packageName.toLowerCase().trim();

    const cmdError = this.executor.validateCommand(command);
    if (cmdError) {
      this.notificationManager.appendLog(`Blocked unsafe install command: ${command} — ${cmdError}`);
      return;
    }

    const nameError = this.executor.validatePackageName(issue.packageName);
    if (nameError) {
      this.notificationManager.appendLog(`Blocked invalid package name: ${issue.packageName} — ${nameError}`);
      return;
    }

    if (this.attemptedPackages.has(packageKey)) {
      this.notificationManager.appendLog(`Skipped duplicate install request: ${issue.packageName}`);
      return;
    }

    this.attemptedPackages.add(packageKey);
    this.items.push({ issue, command });
    this.notificationManager.appendLog(`Queued install: ${issue.packageName}`);
    this.notificationManager.showStatusMessage(`Dependify: Queued ${issue.packageName}`);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.items.length === 0) {
      return;
    }
    this.processing = true;

    while (this.items.length > 0) {
      const next = this.items.shift();
      if (!next) { continue; }

      const { issue, command } = next;
      this.notificationManager.showStatusMessage(`Dependify: Installing ${issue.packageName}...`);
      this.notificationManager.appendLog(`Running install command: ${command}`);

      const success = await this.commandRegistry.executeInTerminal(command, issue.packageName, false);
      if (success) {
        this.activityTracker.logCommand(command, issue.packageName, true);
        this.activityTracker.logDependencyInstalled(issue.packageName);
        this.notificationManager.showInstallationStarted(issue.packageName);
      } else {
        this.activityTracker.logDependencyFailed(issue.packageName, `Failed to run: ${command}`);
        this.notificationManager.showInstallationError(issue.packageName, 'Unable to start install command');
      }

      await delay(1000);
    }

    this.processing = false;
    this.notificationManager.showStatusMessage('Dependify: Installation queue empty', 3000);
  }

  public reset(): void {
    this.items = [];
    this.attemptedPackages.clear();
    this.processing = false;
  }
}
