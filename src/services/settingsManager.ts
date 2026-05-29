import * as vscode from 'vscode';
import { SupportedLanguage } from '../types/types';

export class SettingsManager {
  private context: vscode.ExtensionContext;
  private listeners: Array<() => void> = [];

  public autoInstall = false;
  public confirmBeforeInstall = true;
  public supportedLanguages: SupportedLanguage[] = [SupportedLanguage.Python, SupportedLanguage.NodeJS];
  public autoCreateEnv = false;
  public autoReload = false;
  public notificationLevel: 'minimal' | 'detailed' | 'silent' = 'detailed';
  public safeMode = true;
  public healthCheck = true;
  public scanDelayMs = 1200;
  public statusBarEnabled = true;
  public outputLogsEnabled = true;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadSettings();
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('dependify')) {
          this.loadSettings();
          this.listeners.forEach((listener) => listener());
        }
      })
    );
  }

  private loadSettings(): void {
    const config = vscode.workspace.getConfiguration('dependify');

    this.autoInstall = config.get<boolean>('autoInstall', false);
    this.confirmBeforeInstall = config.get<boolean>('confirmBeforeInstall', true);
    this.autoCreateEnv = config.get<boolean>('autoCreateEnv', false);
    this.autoReload = config.get<boolean>('autoReload', false);
    this.notificationLevel = config.get<'minimal' | 'detailed' | 'silent'>('notifications', 'detailed');
    this.safeMode = config.get<boolean>('safeMode', true);
    this.healthCheck = config.get<boolean>('healthCheck', true);
    this.scanDelayMs = config.get<number>('scanDelayMs', 1200);
    this.statusBarEnabled = config.get<boolean>('statusBarEnabled', true);
    this.outputLogsEnabled = config.get<boolean>('outputLogsEnabled', true);

    const languages = config.get<Array<string>>('languages', ['python', 'javascript']);
    this.supportedLanguages = languages
      .map((language) => this.toSupportedLanguage(language))
      .filter((value): value is SupportedLanguage => value !== undefined);

    if (this.supportedLanguages.length === 0) {
      this.supportedLanguages = [SupportedLanguage.Python, SupportedLanguage.NodeJS];
    }
  }

  private toSupportedLanguage(language: string): SupportedLanguage | undefined {
    const normalized = language.toString().trim().toLowerCase();
    if (normalized === 'python') {
      return SupportedLanguage.Python;
    }
    if (normalized === 'javascript' || normalized === 'nodejs' || normalized === 'node') {
      return SupportedLanguage.NodeJS;
    }
    return undefined;
  }

  public isLanguageSupported(language: SupportedLanguage): boolean {
    return this.supportedLanguages.includes(language);
  }

  public shouldAutoInstall(): boolean {
    return this.autoInstall;
  }

  public shouldConfirmBeforeInstall(): boolean {
    return this.confirmBeforeInstall;
  }

  public onDidChange(listener: () => void): void {
    this.listeners.push(listener);
  }
}
