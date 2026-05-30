/**
 * Environment Manager
 * Handles automatic creation and repair of Python and Node.js environments.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SupportedLanguage, DependencySummary, DependencyIssue } from '../types/types';
import { InstallCommandGenerator } from '../commands/installCommandGenerator';
import { DependencyScanner, DependencyScanResult } from '../analyzer/dependencyScanner';
import { normalizePackageName } from '../utils/helpers';
import { SettingsManager } from './settingsManager';
import { SafeCommandExecutor } from '../security/safeCommandExecutor';

export class EnvironmentManager {
  private workspacePath: string;
  private commandGenerator: InstallCommandGenerator;
  private context: vscode.ExtensionContext;
  private settingsManager: SettingsManager;
  private executor: SafeCommandExecutor;

  constructor(
    workspacePath: string,
    commandGenerator: InstallCommandGenerator,
    context: vscode.ExtensionContext,
    settingsManager: SettingsManager,
    executor: SafeCommandExecutor
  ) {
    this.workspacePath = workspacePath;
    this.commandGenerator = commandGenerator;
    this.context = context;
    this.settingsManager = settingsManager;
    this.executor = executor;
  }

  public async ensureProjectEnvironment(): Promise<DependencySummary | null> {
    const scanner = new DependencyScanner(this.workspacePath);
    const scanResult = await scanner.scanWorkspace();

    if (this.settingsManager.autoCreateEnv) {
      if (scanResult.languages.includes(SupportedLanguage.Python)) {
        await this.ensurePythonEnvironment(scanResult);
      }

      if (scanResult.languages.includes(SupportedLanguage.NodeJS)) {
        await this.ensureNodeEnvironment(scanResult);
      }
    }

    return scanner.createSummary(scanResult);
  }

  public async createRepairPlan(): Promise<string> {
    const scanner = new DependencyScanner(this.workspacePath);
    const scanResult = await scanner.scanWorkspace();
    const messages: string[] = [];

    if (scanResult.missingPackages.size > 0) {
      messages.push(`Missing packages: ${Array.from(scanResult.missingPackages).join(', ')}`);
    }

    if (scanResult.unusedPackages.size > 0) {
      messages.push(`Unused declared packages: ${Array.from(scanResult.unusedPackages).join(', ')}`);
    }

    if (scanResult.languages.includes(SupportedLanguage.Python)) {
      messages.push('Ensure the Python virtual environment is available and active.');
    }

    if (scanResult.languages.includes(SupportedLanguage.NodeJS)) {
      messages.push('Ensure `package.json` and `node_modules` are present.');
    }

    if (messages.length === 0) {
      return 'The project environment appears healthy. No repair actions are needed.';
    }

    return messages.join('\n\n');
  }

  public async installMissingDependencies(issue: DependencyIssue): Promise<boolean> {
    const command = this.commandGenerator.generateCommand(issue);
    return this.executeCommand(command.command);
  }

  public async checkAndPromptEnvironment(language: SupportedLanguage): Promise<'exists' | 'create' | 'manual' | 'cancel'> {
    let exists = false;
    let message = '';
    let options: string[] = ['Create Environment', 'Continue Manually', 'Cancel'];

    if (language === SupportedLanguage.Python) {
      const venvPath = path.join(this.workspacePath, '.venv');
      const venvPath2 = path.join(this.workspacePath, 'venv');
      exists = fs.existsSync(venvPath) || fs.existsSync(venvPath2) || !!process.env.VIRTUAL_ENV || !!process.env.CONDA_PREFIX;
      message = 'No Python Environment Found. Installing globally is not recommended.';
    } else if (language === SupportedLanguage.NodeJS) {
      const nodeModulesPath = path.join(this.workspacePath, 'node_modules');
      exists = fs.existsSync(nodeModulesPath);
      message = 'No node_modules found. Dependency may not be managed properly.';
      options = ['npm install', 'Continue Manually', 'Cancel'];
    } else {
      return 'exists';
    }

    if (exists) {
      return 'exists';
    }

    const choice = await vscode.window.showWarningMessage(`Dependify: ${message}`, ...options);
    
    if (choice === 'Create Environment') {
      await this.createVirtualEnvironment(path.join(this.workspacePath, '.venv'));
      return 'create';
    } else if (choice === 'npm install') {
      await this.executeCommand('npm install');
      return 'create';
    } else if (choice === 'Continue Manually') {
      return 'manual';
    }
    return 'cancel';
  }

  private async ensurePythonEnvironment(scanResult: DependencyScanResult): Promise<void> {
    const envPath = path.join(this.workspacePath, '.venv');
    const hasPythonUsage = scanResult.pythonPackages.size > 0;

    if (scanResult.missingPackages.size > 0) {
      await this.generateMinimalRequirements(scanResult);
    }

    if (!fs.existsSync(envPath) && hasPythonUsage) {
      await this.createVirtualEnvironment(envPath);
    }

    await this.updatePythonSettings(envPath);
  }

  private async ensureNodeEnvironment(scanResult: DependencyScanResult): Promise<void> {
    const packageJsonPath = path.join(this.workspacePath, 'package.json');
    const nodeModulesPath = path.join(this.workspacePath, 'node_modules');
    const packageJsonExists = fs.existsSync(packageJsonPath);

    if (!packageJsonExists && this.settingsManager.autoCreateEnv) {
      await this.createPackageJson(scanResult);
    }

    if (!fs.existsSync(nodeModulesPath) && this.settingsManager.autoCreateEnv) {
      await this.executeCommand('npm install');
    }
  }

  private async generateMinimalRequirements(scanResult: DependencyScanResult): Promise<void> {
    if (!this.settingsManager.autoCreateEnv) {
      return;
    }

    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
    const lines: string[] = [];

    for (const packageName of Array.from(scanResult.pythonPackages.keys()).sort()) {
      lines.push(normalizePackageName(packageName, SupportedLanguage.Python));
    }

    if (lines.length === 0) {
      return;
    }

    try {
      await fs.promises.writeFile(requirementsPath, lines.join('\n') + '\n', 'utf-8');
    } catch (error) {
      console.warn('[EnvironmentManager] Failed to write requirements.txt:', error);
    }
  }

  private async createPackageJson(scanResult: DependencyScanResult): Promise<void> {
    const packageJsonPath = path.join(this.workspacePath, 'package.json');
    const dependencies: Record<string, string> = {};

    for (const packageName of Array.from(scanResult.nodePackages.keys()).sort()) {
      dependencies[normalizePackageName(packageName, SupportedLanguage.NodeJS)] = '*';
    }

    const content = {
      name: path.basename(this.workspacePath).toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'smart-dependency-project',
      version: '0.1.0',
      private: true,
      main: 'index.js',
      license: 'MIT',
      dependencies,
    };

    try {
      await fs.promises.writeFile(packageJsonPath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
    } catch (error) {
      console.warn('[EnvironmentManager] Failed to create package.json:', error);
    }
  }

  private async createVirtualEnvironment(envPath: string): Promise<void> {
    const candidateCommands = [
      `python -m venv "${envPath}"`,
      `py -m venv "${envPath}"`,
    ];
    let created = false;

    for (const command of candidateCommands) {
      try {
        await this.executeCommand(command);
        created = true;
        break;
      } catch (_error) {
        // Try the next available command.
      }
    }

    if (!created) {
      console.warn('[EnvironmentManager] Unable to create Python virtual environment automatically.');
    }
  }

  private async updatePythonSettings(envPath: string): Promise<void> {
    const isWindows = process.platform === 'win32';
    const interpreter = isWindows
      ? path.join(envPath, 'Scripts', 'python.exe')
      : path.join(envPath, 'bin', 'python');

    try {
      const pythonConfig = vscode.workspace.getConfiguration('python');
      await pythonConfig.update('defaultInterpreterPath', interpreter, vscode.ConfigurationTarget.Workspace);
      await pythonConfig.update('pythonPath', interpreter, vscode.ConfigurationTarget.Workspace);
    } catch (error) {
      console.warn('[EnvironmentManager] Unable to update Python interpreter settings:', error);
    }
  }

  private async executeCommand(command: string): Promise<boolean> {
    try {
      const result = await this.executor.execute(command, 'Environment Setup', false);
      return result.success;
    } catch (error) {
      console.warn(`[EnvironmentManager] Command failed: ${command}`, error);
      return false;
    }
  }
}
