/**
 * CommandRegistry
 * Registers VS Code commands and delegates all execution to SafeCommandExecutor.
 * No direct terminal.sendText() calls exist here.
 */

import * as vscode from 'vscode';
import { DependencyIssue } from '../types/types';
import { InstallCommandGenerator } from './installCommandGenerator';
import { SafeCommandExecutor } from '../security/safeCommandExecutor';

export class CommandRegistry {
  private context: vscode.ExtensionContext;
  private commandGenerator: InstallCommandGenerator;
  private executor: SafeCommandExecutor;

  private onInstallRequested: ((issue: DependencyIssue) => void) | null = null;
  private onCopyCommand: ((command: string, packageName: string) => void) | null = null;
  private onRefreshRequested: (() => void) | null = null;
  private onRepairRequested: (() => void) | null = null;
  private onCreateEnvironmentRequested: (() => void) | null = null;
  private onCleanupRequested: (() => void) | null = null;

  constructor(
    context: vscode.ExtensionContext,
    commandGenerator: InstallCommandGenerator,
    executor: SafeCommandExecutor
  ) {
    this.context = context;
    this.commandGenerator = commandGenerator;
    this.executor = executor;
  }

  public registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('smartDependencyAssistant.openPanel', () => {
        void vscode.commands.executeCommand('smartDependencyPanel.focus');
      }),

      vscode.commands.registerCommand('smartDependencyAssistant.installDependency',
        (issue: DependencyIssue) => { this.handleInstallCommand(issue); }),

      vscode.commands.registerCommand('smartDependencyAssistant.copyCommand',
        (command: string, packageName: string) => { this.handleCopyCommand(command, packageName); }),

      vscode.commands.registerCommand('smartDependencyAssistant.refreshDependencies', () => {
        this.onRefreshRequested?.();
      }),

      vscode.commands.registerCommand('smartDependencyAssistant.repairProject', () => {
        this.onRepairRequested?.();
      }),

      vscode.commands.registerCommand('smartDependencyAssistant.createEnvironment', () => {
        this.onCreateEnvironmentRequested?.();
      }),

      vscode.commands.registerCommand('smartDependencyAssistant.cleanupEnvironment', () => {
        this.onCleanupRequested?.();
      })
    );
  }

  private handleInstallCommand(issue: DependencyIssue): void {
    if (!issue?.packageName) {
      void vscode.window.showErrorMessage('Dependify: Invalid issue data.');
      return;
    }
    this.onInstallRequested?.(issue);
  }

  private handleCopyCommand(command: string, packageName: string): void {
    if (!command) {
      void vscode.window.showErrorMessage('Dependify: No command to copy.');
      return;
    }
    void vscode.env.clipboard.writeText(command).then(() => {
      void vscode.window.showInformationMessage(`Copied: ${command}`);
      this.onCopyCommand?.(command, packageName);
    });
  }

  // ─── Callbacks ────────────────────────────────────────────────────────────

  public onInstall(cb: (issue: DependencyIssue) => void): void { this.onInstallRequested = cb; }
  public onCopy(cb: (command: string, packageName: string) => void): void { this.onCopyCommand = cb; }
  public onRefresh(cb: () => void): void { this.onRefreshRequested = cb; }
  public onRepair(cb: () => void): void { this.onRepairRequested = cb; }
  public onCreateEnvironment(cb: () => void): void { this.onCreateEnvironmentRequested = cb; }
  public onCleanup(cb: () => void): void { this.onCleanupRequested = cb; }

  // ─── Execution (delegates to SafeCommandExecutor) ─────────────────────────

  public async executeInTerminal(
    command: string,
    packageName: string,
    requireConfirmation = false
  ): Promise<boolean> {
    const result = await this.executor.execute(command, packageName, requireConfirmation);
    return result.success;
  }

  public async showInstallConfirmation(issue: DependencyIssue): Promise<boolean> {
    const command = this.commandGenerator.generateCommand(issue);
    const result = await this.executor.execute(
      command.command,
      issue.packageName,
      true // always show confirmation dialog
    );
    return result.success;
  }

  public async showIssueQuickPick(issue: DependencyIssue): Promise<string | undefined> {
    const command = this.commandGenerator.generateCommand(issue);
    const alternatives = this.commandGenerator.getAlternativeCommands(issue);

    const items: vscode.QuickPickItem[] = [
      { label: '$(cloud-download) Install', description: command.commandDisplay, detail: 'Run in Dependify terminal' },
      { label: '$(copy) Copy Command', description: command.commandDisplay, detail: 'Copy to clipboard' },
      ...alternatives.map((alt, i) => ({
        label: `$(lightbulb) Alternative ${i + 1}`,
        description: alt,
        detail: 'Alternative installation method',
      })),
    ];

    const selected = await vscode.window.showQuickPick(items, {
      title: `Install "${issue.packageName}"?`,
      canPickMany: false,
    });
    return selected?.description;
  }
}
