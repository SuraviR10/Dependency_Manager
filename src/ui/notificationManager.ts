/**
 * Notification Manager
 * Handles user notifications and alerts
 */

import * as vscode from 'vscode';
import { DependencyIssue } from '../types/types';

export class NotificationManager {
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private statusTimer: NodeJS.Timeout | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Dependify Logs');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = 'Dependify: Ready';
    this.statusBarItem.show();

    context.subscriptions.push(this.outputChannel, this.statusBarItem);
  }

  public appendLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  public showOutput(): void {
    this.outputChannel.show(true);
  }

  /**
   * Show info notification
   */
  public showInfo(message: string): Thenable<string | undefined> {
    this.appendLog(`INFO: ${message}`);
    return vscode.window.showInformationMessage(message);
  }

  /**
   * Show warning notification
   */
  public showWarning(message: string): Thenable<string | undefined> {
    this.appendLog(`WARN: ${message}`);
    return vscode.window.showWarningMessage(message);
  }

  /**
   * Show error notification
   */
  public showError(message: string): Thenable<string | undefined> {
    this.appendLog(`ERROR: ${message}`);
    return vscode.window.showErrorMessage(message);
  }

  /**
   * Show notification with actions
   */
  public showWithActions(
    message: string,
    actions: string[],
    type: 'info' | 'warning' | 'error' = 'info'
  ): Thenable<string | undefined> {
    switch (type) {
      case 'warning':
        return vscode.window.showWarningMessage(message, ...actions);
      case 'error':
        return vscode.window.showErrorMessage(message, ...actions);
      default:
        return vscode.window.showInformationMessage(message, ...actions);
    }
  }

  /**
   * Show dependency issue notification
   */
  public showDependencyIssue(issue: DependencyIssue): Thenable<string | undefined> {
    const message = `Dependency Issue: Missing package '${issue.packageName}'`;
    return this.showWarning(message);
  }

  /**
   * Show installation started notification
   */
  public showInstallationStarted(packageName: string): Thenable<string | undefined> {
    return this.showInfo(`Installing ${packageName}...`);
  }

  /**
   * Show installation success
   */
  public showInstallationSuccess(packageName: string): Thenable<string | undefined> {
    return this.showInfo(`✓ Successfully installed ${packageName}`);
  }

  /**
   * Show installation error
   */
  public showInstallationError(packageName: string, error: string): Thenable<string | undefined> {
    return this.showError(`Failed to install ${packageName}: ${error}`);
  }

  /**
   * Show progress notification
   */
  public async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
  ): Promise<T> {
    this.appendLog(`PROGRESS: ${title}`);
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task
    );
  }

  /**
   * Show status bar message
   */
  public showStatusMessage(message: string, duration: number = 5000): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    this.statusBarItem.text = `${message}`;
    this.statusBarItem.show();

    if (duration > 0) {
      this.statusTimer = setTimeout(() => {
        this.statusBarItem.text = 'Dependify: Ready';
      }, duration);
    }
  }

  /**
   * Clear status bar message
   */
  public clearStatusMessage(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.statusBarItem.text = 'Dependify: Ready';
  }
}
