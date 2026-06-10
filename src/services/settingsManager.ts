import * as vscode from 'vscode';
import { SupportedLanguage } from '../types/types';

export class SettingsManager {
  private context: vscode.ExtensionContext;
  private listeners: Array<() => void> = [];

  // Automation
  public autoInstall = false;
  public confirmBeforeInstall = true;
  public autoCreateEnv = false;
  public autoActivateEnv = false;
  public autoReload = false;
  public autoFixDependencyIssues = false;

  // Notifications
  public notificationLevel: 'minimal' | 'detailed' | 'silent' = 'detailed';
  public showSuccessNotifications = true;
  public showWarningNotifications = true;
  public showErrorNotifications = true;
  public showCommandExecutionNotifications = false;

  // Scanning
  public healthCheck = true;
  public scanOnStartup = true;
  public scanOnSave = true;
  public scanOnOpen = false;
  public scanDelayMs = 1200;

  // Security
  public safeMode = true;
  public verifyPackagesBeforeInstall = true;

  // UI
  public statusBarEnabled = true;
  public outputLogsEnabled = true;

  // Languages
  public supportedLanguages: SupportedLanguage[] = [SupportedLanguage.Python, SupportedLanguage.NodeJS];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadSettings();
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('dartx')) {
          this.loadSettings();
          this.listeners.forEach(l => l());
        }
      })
    );
  }

  private loadSettings(): void {
    const c = vscode.workspace.getConfiguration('dartx');

    // Automation
    this.autoInstall = c.get<boolean>('autoInstall', false);
    this.confirmBeforeInstall = c.get<boolean>('confirmBeforeInstall', true);
    this.autoCreateEnv = c.get<boolean>('autoCreateEnv', false);
    this.autoActivateEnv = c.get<boolean>('autoActivateEnv', false);
    this.autoReload = c.get<boolean>('autoReload', false);
    this.autoFixDependencyIssues = c.get<boolean>('autoFixDependencyIssues', false);

    // Notifications
    this.notificationLevel = c.get<'minimal' | 'detailed' | 'silent'>('notifications', 'detailed');
    this.showSuccessNotifications = c.get<boolean>('showSuccessNotifications', true);
    this.showWarningNotifications = c.get<boolean>('showWarningNotifications', true);
    this.showErrorNotifications = c.get<boolean>('showErrorNotifications', true);
    this.showCommandExecutionNotifications = c.get<boolean>('showCommandExecutionNotifications', false);

    // Scanning
    this.healthCheck = c.get<boolean>('healthCheck', true);
    this.scanOnStartup = c.get<boolean>('scanOnStartup', true);
    this.scanOnSave = c.get<boolean>('scanOnSave', true);
    this.scanOnOpen = c.get<boolean>('scanOnOpen', false);
    this.scanDelayMs = Math.max(300, Math.min(10000, c.get<number>('scanDelayMs', 1200)));

    // Security
    this.safeMode = c.get<boolean>('safeMode', true);
    this.verifyPackagesBeforeInstall = c.get<boolean>('verifyPackagesBeforeInstall', true);

    // UI
    this.statusBarEnabled = c.get<boolean>('statusBarEnabled', true);
    this.outputLogsEnabled = c.get<boolean>('outputLogsEnabled', true);

    // Languages
    const langs = c.get<string[]>('languages', ['python', 'javascript']);
    const mapped = langs
      .map(l => this.toSupportedLanguage(l))
      .filter((v): v is SupportedLanguage => v !== undefined);
    this.supportedLanguages = mapped.length > 0
      ? mapped
      : [SupportedLanguage.Python, SupportedLanguage.NodeJS];
  }

  private toSupportedLanguage(language: string): SupportedLanguage | undefined {
    const n = language.trim().toLowerCase();
    if (n === 'python') { return SupportedLanguage.Python; }
    if (n === 'javascript' || n === 'typescript' || n === 'nodejs' || n === 'node') {
      return SupportedLanguage.NodeJS;
    }
    return undefined;
  }

  public isLanguageSupported(language: SupportedLanguage): boolean {
    return this.supportedLanguages.includes(language);
  }

  public shouldAutoInstall(): boolean { return this.autoInstall; }
  public shouldConfirmBeforeInstall(): boolean { return this.confirmBeforeInstall; }

  public onDidChange(listener: () => void): void {
    this.listeners.push(listener);
  }
}
