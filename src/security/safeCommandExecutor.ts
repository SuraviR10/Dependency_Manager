/**
 * SafeCommandExecutor
 * Centralized security layer. Every install/environment command MUST pass through here.
 * Responsibilities: package name validation, command allowlist, injection prevention,
 * workspace trust enforcement, audit logging, user confirmation gate.
 */

import * as vscode from 'vscode';
import { ActivityTracker } from '../services/activityTracker';
import { ActivityType, ActivitySeverity } from '../types/types';

export interface ExecutionResult {
  success: boolean;
  blocked: boolean;
  reason?: string;
}

/** Strict allowlist: letters, digits, hyphens, underscores, dots, optional @scope prefix */
const SAFE_PACKAGE_NAME = /^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/** Characters that enable shell injection */
const INJECTION_CHARS = [';', '|', '&', '`', '$', '\n', '\r', '>', '<', '(', ')', '{', '}', '!'];

/** Only known package-manager operations are permitted */
const ALLOWED_PREFIXES: readonly string[] = [
  'pip install ',
  'pip3 install ',
  'pip uninstall ',
  'python -m pip install ',
  'python3 -m pip install ',
  'py -m pip install ',
  'python -m venv ',
  'py -m venv ',
  'npm install',
  'npm install ',
  'npm uninstall ',
  'yarn add ',
  'yarn remove ',
  'pnpm add ',
  'pnpm remove ',
  'conda install ',
  'conda create ',
];

export class SafeCommandExecutor {
  private activityTracker: ActivityTracker;
  private terminal: vscode.Terminal | null = null;

  constructor(activityTracker: ActivityTracker) {
    this.activityTracker = activityTracker;
  }

  /** Returns an error string if the package name is invalid, null if valid. */
  public validatePackageName(name: string): string | null {
    if (!name || name.trim().length === 0) {
      return 'Package name cannot be empty.';
    }
    const trimmed = name.trim();
    if (trimmed.length > 214) {
      return `Package name is too long (${trimmed.length} chars).`;
    }
    // Explicitly block path traversal
    if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/') || trimmed.startsWith('.')) {
      return `Package name contains unsafe path characters.`;
    }
    if (!SAFE_PACKAGE_NAME.test(trimmed)) {
      return `Package name "${trimmed}" contains invalid characters. Only letters, numbers, hyphens, underscores, and dots are allowed.`;
    }
    return null;
  }

  /** Returns an error string if the command is unsafe, null if valid. */
  public validateCommand(command: string): string | null {
    if (!command || command.trim().length === 0) {
      return 'Command cannot be empty.';
    }
    for (const char of INJECTION_CHARS) {
      if (command.includes(char)) {
        return `Command contains unsafe character "${char}". Execution blocked.`;
      }
    }
    if (command.includes('..')) {
      return `Command contains path traversal characters. Execution blocked.`;
    }
    const trimmed = command.trim();
    const allowed = ALLOWED_PREFIXES.some(prefix => trimmed.startsWith(prefix));
    if (!allowed) {
      return `Command does not match any allowed package manager operation.`;
    }
    return null;
  }

  /** Returns false and shows a warning if the workspace is not trusted. */
  public isWorkspaceTrusted(): boolean {
    const trusted = vscode.workspace.isTrusted;
    if (!trusted) {
      void vscode.window.showWarningMessage(
        'Dependify: Automation is disabled until this workspace is trusted.',
        'Trust Workspace'
      ).then(choice => {
        if (choice === 'Trust Workspace') {
          void vscode.commands.executeCommand('workbench.action.manageTrust');
        }
      });
    }
    return trusted;
  }

  /**
   * The ONLY method that calls terminal.sendText().
   * Validates, optionally confirms, then executes.
   */
  public async execute(
    command: string,
    packageName: string,
    requireConfirmation = false
  ): Promise<ExecutionResult> {
    if (!this.isWorkspaceTrusted()) {
      this.audit('BLOCKED_UNTRUSTED', command, packageName);
      return { success: false, blocked: true, reason: 'Workspace not trusted.' };
    }

    const nameError = this.validatePackageName(packageName);
    if (nameError) {
      this.audit('BLOCKED_INVALID_NAME', command, packageName);
      void vscode.window.showErrorMessage(`Dependify Security: ${nameError}`);
      return { success: false, blocked: true, reason: nameError };
    }

    const cmdError = this.validateCommand(command);
    if (cmdError) {
      this.audit('BLOCKED_INVALID_CMD', command, packageName);
      void vscode.window.showErrorMessage(`Dependify Security: ${cmdError}`);
      return { success: false, blocked: true, reason: cmdError };
    }

    if (requireConfirmation) {
      const confirmed = await this.showConfirmation(packageName, command);
      if (!confirmed) {
        this.audit('CANCELLED_BY_USER', command, packageName);
        return { success: false, blocked: false, reason: 'Cancelled by user.' };
      }
    }

    try {
      const terminal = this.getOrCreateTerminal();
      terminal.show(true);
      terminal.sendText(command, true);
      this.audit('EXECUTED', command, packageName);
      return { success: true, blocked: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.audit('EXECUTION_ERROR', command, packageName);
      return { success: false, blocked: false, reason: msg };
    }
  }

  private async showConfirmation(packageName: string, command: string): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      `Install "${packageName}"?\n\nCommand: ${command}`,
      { modal: true },
      'Install',
      'Copy Command',
      'Cancel'
    );
    if (result === 'Copy Command') {
      await vscode.env.clipboard.writeText(command);
      void vscode.window.showInformationMessage('Command copied to clipboard.');
    }
    return result === 'Install';
  }

  private getOrCreateTerminal(): vscode.Terminal {
    if (this.terminal && vscode.window.terminals.some(t => t === this.terminal)) {
      return this.terminal;
    }
    const existing = vscode.window.terminals.find(t => t.name === 'Dependify');
    if (existing) {
      this.terminal = existing;
      return existing;
    }
    this.terminal = vscode.window.createTerminal({ name: 'Dependify', hideFromUser: false });
    return this.terminal;
  }

  private audit(event: string, command: string, packageName: string): void {
    const isBlocked = event.startsWith('BLOCKED') || event.startsWith('CANCELLED');
    this.activityTracker.logActivity(
      ActivityType.CommandExecuted,
      isBlocked ? ActivitySeverity.Warning : ActivitySeverity.Info,
      `[Security] ${event}: ${packageName}`,
      { description: command.substring(0, 120) }
    );
  }
}
