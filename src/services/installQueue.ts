import { DependencyIssue } from '../types/types';
import { ActivityTracker } from './activityTracker';
import { InstallCommandGenerator } from '../commands/installCommandGenerator';
import { CommandRegistry } from '../commands/commandRegistry';
import { NotificationManager } from '../ui/notificationManager';
import { SettingsManager } from './settingsManager';
import { delay } from '../utils/helpers';

export class InstallQueue {
  private commandRegistry: CommandRegistry;
  private activityTracker: ActivityTracker;
  private notificationManager: NotificationManager;
  private settingsManager: SettingsManager;
  private commandGenerator: InstallCommandGenerator;
  private items: Array<{ issue: DependencyIssue; command: string }> = [];
  private processing = false;
  private attemptedPackages = new Set<string>();

  constructor(
    commandRegistry: CommandRegistry,
    commandGenerator: InstallCommandGenerator,
    activityTracker: ActivityTracker,
    notificationManager: NotificationManager,
    settingsManager: SettingsManager
  ) {
    this.commandRegistry = commandRegistry;
    this.commandGenerator = commandGenerator;
    this.activityTracker = activityTracker;
    this.notificationManager = notificationManager;
    this.settingsManager = settingsManager;
  }

  public enqueue(issue: DependencyIssue, command: string): void {
    const packageKey = issue.packageName.toLowerCase().trim();

    if (!command || !this.commandGenerator.isCommandSafe(command)) {
      this.notificationManager.appendLog(`Blocked unsafe install command: ${command}`);
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
      if (!next) {
        continue;
      }

      const { issue, command } = next;
      this.notificationManager.showStatusMessage(`Dependify: Installing ${issue.packageName}...`);
      this.notificationManager.appendLog(`Running install command: ${command}`);

      const success = await this.commandRegistry.executeInTerminal(command, true);
      if (success) {
        this.activityTracker.logCommand(command, issue.packageName, true);
        this.activityTracker.logDependencyInstalled(issue.packageName);
        this.notificationManager.appendLog(`Install started for ${issue.packageName}`);
        this.notificationManager.showInstallationStarted(issue.packageName);
      } else {
        this.activityTracker.logDependencyFailed(issue.packageName, `Failed to run command: ${command}`);
        this.notificationManager.appendLog(`Failed to start install: ${command}`);
        this.notificationManager.showInstallationError(issue.packageName, `Unable to start install command`);
      }

      // Wait briefly before starting the next queued install.
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
