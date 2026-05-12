/**
 * Command Registry
 * Registers and manages all VS Code commands for the extension
 */

import * as vscode from 'vscode';
import { DependencyIssue } from '../types/types';
import { InstallCommandGenerator } from './installCommandGenerator';

export class CommandRegistry {
  private context: vscode.ExtensionContext;
  private commandGenerator: InstallCommandGenerator;
  private onInstallRequested: ((issue: DependencyIssue) => void) | null = null;
  private onCopyCommand: ((command: string, packageName: string) => void) | null = null;
  private onRefreshRequested: (() => void) | null = null;
  private onRepairRequested: (() => void) | null = null;
  private onCreateEnvironmentRequested: (() => void) | null = null;
  private onCleanupRequested: (() => void) | null = null;

  constructor(context: vscode.ExtensionContext, commandGenerator: InstallCommandGenerator) {
    this.context = context;
    this.commandGenerator = commandGenerator;
  }

  /**
   * Register all extension commands
   */
  public registerCommands(): void {
    // Open panel command
    const openPanelCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.openPanel',
      () => {
        vscode.window.showInformationMessage('Smart Dependency Assistant panel opened');
      }
    );

    // Install dependency command
    const installCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.installDependency',
      (issue: DependencyIssue) => {
        this.handleInstallCommand(issue);
      }
    );

    // Copy command command
    const copyCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.copyCommand',
      (command: string, packageName: string) => {
        this.handleCopyCommand(command, packageName);
      }
    );

    const refreshCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.refreshDependencies',
      () => {
        if (this.onRefreshRequested) {
          this.onRefreshRequested();
        }
      }
    );

    const repairCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.repairProject',
      () => {
        if (this.onRepairRequested) {
          this.onRepairRequested();
        }
      }
    );

    const createEnvironmentCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.createEnvironment',
      () => {
        if (this.onCreateEnvironmentRequested) {
          this.onCreateEnvironmentRequested();
        }
      }
    );

    const cleanupCommand = vscode.commands.registerCommand(
      'smartDependencyAssistant.cleanupEnvironment',
      () => {
        if (this.onCleanupRequested) {
          this.onCleanupRequested();
        }
      }
    );

    // Register all commands
    this.context.subscriptions.push(openPanelCommand);
    this.context.subscriptions.push(installCommand);
    this.context.subscriptions.push(copyCommand);
    this.context.subscriptions.push(refreshCommand);
    this.context.subscriptions.push(repairCommand);
    this.context.subscriptions.push(createEnvironmentCommand);
    this.context.subscriptions.push(cleanupCommand);

    console.log('[CommandRegistry] Registered all commands');
  }

  /**
   * Handle install command execution
   */
  private handleInstallCommand(issue: DependencyIssue): void {
    console.log(`[CommandRegistry] Installing ${issue.packageName}`);

    // Validate issue
    if (!issue || !issue.packageName) {
      vscode.window.showErrorMessage('Invalid issue data');
      return;
    }

    // Fire callback
    if (this.onInstallRequested) {
      this.onInstallRequested(issue);
    }
  }

  /**
   * Handle copy command to clipboard
   */
  private handleCopyCommand(command: string, packageName: string): void {
    if (!command) {
      vscode.window.showErrorMessage('No command to copy');
      return;
    }

    vscode.env.clipboard.writeText(command).then(() => {
      vscode.window.showInformationMessage(`Copied: ${command}`);
      console.log(`[CommandRegistry] Copied command to clipboard: ${command}`);

      // Fire callback
      if (this.onCopyCommand) {
        this.onCopyCommand(command, packageName);
      }
    });
  }

  /**
   * Register callback for install requests
   */
  public onInstall(callback: (issue: DependencyIssue) => void): void {
    this.onInstallRequested = callback;
  }

  /**
   * Register callback for copy requests
   */
  public onCopy(callback: (command: string, packageName: string) => void): void {
    this.onCopyCommand = callback;
  }

  /**
   * Register callback for refresh requests
   */
  public onRefresh(callback: () => void): void {
    this.onRefreshRequested = callback;
  }

  /**
   * Register callback for repair requests
   */
  public onRepair(callback: () => void): void {
    this.onRepairRequested = callback;
  }

  /**
   * Register callback for environment creation requests
   */
  public onCreateEnvironment(callback: () => void): void {
    this.onCreateEnvironmentRequested = callback;
  }

  /**
   * Register callback for cleanup requests
   */
  public onCleanup(callback: () => void): void {
    this.onCleanupRequested = callback;
  }

  /**
   * Show issue in quick pick
   */
  public async showIssueQuickPick(issue: DependencyIssue): Promise<string | undefined> {
    const command = this.commandGenerator.generateCommand(issue);
    const alternatives = this.commandGenerator.getAlternativeCommands(issue);

    const items: vscode.QuickPickItem[] = [
      {
        label: 'Primary Command',
        description: command.commandDisplay,
        detail: 'Recommended installation method',
      },
      {
        label: 'Copy Command',
        description: command.commandDisplay,
        detail: 'Copy to clipboard instead of running',
      },
      ...alternatives.map((alt, index) => ({
        label: `Alternative ${index + 1}`,
        description: alt,
        detail: 'Alternative installation method',
      })),
    ];

    const selected = await vscode.window.showQuickPick(items, {
      title: `Install ${issue.packageName}?`,
      canPickMany: false,
    });

    return selected?.description;
  }

  /**
   * Show confirmation dialog for installation
   */
  public async showInstallConfirmation(issue: DependencyIssue): Promise<boolean> {
    const command = this.commandGenerator.generateCommand(issue);

    const result = await vscode.window.showInformationMessage(
      `Install ${issue.packageName}?\nRun: ${command.commandDisplay}`,
      { modal: true },
      'Install',
      'Copy Command',
      'Cancel'
    );

    if (result === 'Install') {
      return true;
    } else if (result === 'Copy Command') {
      await vscode.env.clipboard.writeText(command.command);
      vscode.window.showInformationMessage('Command copied to clipboard');
      return false;
    }

    return false;
  }

  /**
   * Execute a shell command in terminal
   */
  public async executeInTerminal(command: string, showTerminal: boolean = true): Promise<boolean> {
    try {
      // Get or create terminal
      let terminal = vscode.window.activeTerminal;

      if (!terminal) {
        terminal = vscode.window.createTerminal('Smart Dependency Assistant');
      }

      if (showTerminal) {
        terminal.show();
      }

      // Send command to terminal with newline
      terminal.sendText(command, true);

      return true;
    } catch (error) {
      console.error('[CommandRegistry] Error executing command:', error);
      vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
      return false;
    }
  }

  /**
   * Get registered commands
   */
  public getRegisteredCommands(): string[] {
    return [
      'smartDependencyAssistant.openPanel',
      'smartDependencyAssistant.installDependency',
      'smartDependencyAssistant.copyCommand',
      'smartDependencyAssistant.refreshDependencies',
      'smartDependencyAssistant.repairProject',
      'smartDependencyAssistant.createEnvironment',
      'smartDependencyAssistant.cleanupEnvironment',
    ];
  }
}
