/**
 * Notification Manager
 * Handles user notifications and alerts
 */

import * as vscode from 'vscode';
import { DependencyIssue } from '../types/types';

export class NotificationManager {
  /**
   * Show info notification
   */
  public showInfo(message: string): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message);
  }

  /**
   * Show warning notification
   */
  public showWarning(message: string): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message);
  }

  /**
   * Show error notification
   */
  public showError(message: string): Thenable<string | undefined> {
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
    vscode.window.setStatusBarMessage(message, duration);
  }

  /**
   * Clear status bar message
   */
  public clearStatusMessage(): void {
    vscode.window.setStatusBarMessage('');
  }
}
