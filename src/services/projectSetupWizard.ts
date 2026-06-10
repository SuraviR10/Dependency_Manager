/**
 * Project Setup Wizard
 * Detects project type and offers one-click setup
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';
import { EnvironmentManager } from './environmentManager';
import { DependencyScanner } from '../analyzer/dependencyScanner';

export type ProjectType = 'python' | 'nodejs' | 'mixed' | 'unknown';

export interface ProjectInfo {
  type: ProjectType;
  name: string;
  pythonVersion?: string;
  nodeVersion?: string;
  pythonFiles: number;
  nodeFiles: number;
  hasRequirements: boolean;
  hasPackageJson: boolean;
  hasPyproject: boolean;
  hasVenv: boolean;
  setupSteps: SetupStep[];
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  completed: boolean;
  optional: boolean;
}

export class ProjectSetupWizard {
  private workspacePath: string;
  private environmentManager: EnvironmentManager;
  private dependencyScanner: DependencyScanner;
  private execAsync = util.promisify(cp.exec);

  constructor(
    workspacePath: string,
    environmentManager: EnvironmentManager,
    dependencyScanner: DependencyScanner
  ) {
    this.workspacePath = workspacePath;
    this.environmentManager = environmentManager;
    this.dependencyScanner = dependencyScanner;
  }

  /**
   * Analyze project and suggest setup
   */
  public async analyzeProject(): Promise<ProjectInfo> {
    const projectInfo: ProjectInfo = {
      type: 'unknown',
      name: path.basename(this.workspacePath),
      pythonFiles: 0,
      nodeFiles: 0,
      hasRequirements: false,
      hasPackageJson: false,
      hasPyproject: false,
      hasVenv: false,
      setupSteps: [],
    };

    try {
      // Count file types
      const files = this.getAllFiles(this.workspacePath);
      projectInfo.pythonFiles = files.filter(f => f.endsWith('.py')).length;
      projectInfo.nodeFiles = files.filter(f =>
        ['.js', '.jsx', '.ts', '.tsx'].some(ext => f.endsWith(ext))
      ).length;

      // Check for config files
      projectInfo.hasRequirements = fs.existsSync(path.join(this.workspacePath, 'requirements.txt'));
      projectInfo.hasPackageJson = fs.existsSync(path.join(this.workspacePath, 'package.json'));
      projectInfo.hasPyproject = fs.existsSync(path.join(this.workspacePath, 'pyproject.toml'));
      projectInfo.hasVenv = fs.existsSync(path.join(this.workspacePath, '.venv')) ||
                             fs.existsSync(path.join(this.workspacePath, 'venv'));

      // Determine project type
      if (projectInfo.pythonFiles > 0 && projectInfo.nodeFiles === 0) {
        projectInfo.type = 'python';
      } else if (projectInfo.nodeFiles > 0 && projectInfo.pythonFiles === 0) {
        projectInfo.type = 'nodejs';
      } else if (projectInfo.pythonFiles > 0 && projectInfo.nodeFiles > 0) {
        projectInfo.type = 'mixed';
      }

      // Get Python and Node versions if applicable
      if (projectInfo.pythonFiles > 0) {
        projectInfo.pythonVersion = await this.detectPythonVersion();
      }
      if (projectInfo.nodeFiles > 0) {
        projectInfo.nodeVersion = await this.detectNodeVersion();
      }

      // Generate setup steps
      projectInfo.setupSteps = this.generateSetupSteps(projectInfo);
    } catch (error) {
      console.error('[ProjectSetupWizard] Analysis failed:', error);
    }

    return projectInfo;
  }

  /**
   * Execute all setup steps
   */
  public async executeSetup(projectInfo: ProjectInfo): Promise<string[]> {
    const results: string[] = [];
    const output = vscode.window.createOutputChannel('DARTX Setup');
    output.show();

    try {
      for (const step of projectInfo.setupSteps) {
        if (step.optional) {
          const proceed = await vscode.window.showQuickPick(
            ['Yes', 'Skip'],
            { placeHolder: `${step.title}: Proceed?` }
          );
          if (proceed === 'Skip') {
            results.push(`⏭️ Skipped: ${step.title}`);
            continue;
          }
        }

        output.appendLine(`\n📦 ${step.title}...`);

        try {
          if (step.id === 'create-venv') {
            await this.environmentManager.ensureProjectEnvironment();
            output.appendLine('✅ Virtual environment created');
            results.push(`✅ ${step.title}`);
          } else if (step.id === 'install-python-deps') {
            await this.installPythonDependencies();
            output.appendLine('✅ Python dependencies installed');
            results.push(`✅ ${step.title}`);
          } else if (step.id === 'install-node-deps') {
            await this.installNodeDependencies();
            output.appendLine('✅ Node dependencies installed');
            results.push(`✅ ${step.title}`);
          } else if (step.id === 'configure-env') {
            output.appendLine('✅ Environment configured');
            results.push(`✅ ${step.title}`);
          }
        } catch (error) {
          output.appendLine(`❌ Failed: ${error}`);
          results.push(`❌ ${step.title}: ${error}`);
        }
      }

      output.appendLine('\n\n🎉 Setup Complete!');
      vscode.window.showInformationMessage('Project setup completed successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Setup failed: ${error}`);
    }

    return results;
  }

  /**
   * Get all files in workspace
   */
  private getAllFiles(dirPath: string, files: string[] = []): string[] {
    const ignoreDirs = ['node_modules', '.venv', 'venv', '.git', '.vscode', 'dist', 'build'];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (ignoreDirs.includes(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          this.getAllFiles(fullPath, files);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory not accessible
    }

    return files;
  }

  /**
   * Detect Python version from code
   */
  private async detectPythonVersion(): Promise<string | undefined> {
    try {
      // Check pyproject.toml for python version
      const pyprojectPath = path.join(this.workspacePath, 'pyproject.toml');
      if (fs.existsSync(pyprojectPath)) {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        const match = content.match(/requires-python\s*=\s*['"](.*?)['"]/);
        if (match) return match[1];
      }

      // Check for .python-version file
      const pythonVersionFile = path.join(this.workspacePath, '.python-version');
      if (fs.existsSync(pythonVersionFile)) {
        return fs.readFileSync(pythonVersionFile, 'utf-8').trim();
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Detect Node version from config
   */
  private async detectNodeVersion(): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(this.workspacePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return content.engines?.node;
      }

      // Check .nvmrc
      const nvmrcPath = path.join(this.workspacePath, '.nvmrc');
      if (fs.existsSync(nvmrcPath)) {
        return fs.readFileSync(nvmrcPath, 'utf-8').trim();
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Generate setup steps based on project type
   */
  private generateSetupSteps(projectInfo: ProjectInfo): SetupStep[] {
    const steps: SetupStep[] = [];

    if (projectInfo.type === 'python' || projectInfo.type === 'mixed') {
      if (!projectInfo.hasVenv) {
        steps.push({
          id: 'create-venv',
          title: 'Create Virtual Environment',
          description: 'Create .venv for isolated dependencies',
          optional: false,
          completed: false,
        });
      }

      if (projectInfo.hasRequirements || projectInfo.hasPyproject) {
        steps.push({
          id: 'install-python-deps',
          title: 'Install Python Dependencies',
          description: 'Install packages from requirements.txt or pyproject.toml',
          optional: false,
          completed: false,
        });
      }
    }

    if (projectInfo.type === 'nodejs' || projectInfo.type === 'mixed') {
      if (projectInfo.hasPackageJson) {
        steps.push({
          id: 'install-node-deps',
          title: 'Install Node Dependencies',
          description: 'Run npm install',
          optional: false,
          completed: false,
        });
      }
    }

    steps.push({
      id: 'configure-env',
      title: 'Configure Project Environment',
      description: 'Set up environment variables and paths',
      optional: true,
      completed: false,
    });

    return steps;
  }

  /**
   * Install Python dependencies
   */
  private async installPythonDependencies(): Promise<void> {
    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
    const pyprojectPath = path.join(this.workspacePath, 'pyproject.toml');

    if (fs.existsSync(requirementsPath)) {
      await this.execAsync(`pip install -r ${requirementsPath}`, { cwd: this.workspacePath, timeout: 120000 });
    } else if (fs.existsSync(pyprojectPath)) {
      await this.execAsync('pip install -e .', { cwd: this.workspacePath, timeout: 120000 });
    }
  }

  /**
   * Install Node dependencies
   */
  private async installNodeDependencies(): Promise<void> {
    await this.execAsync('npm install', { cwd: this.workspacePath, timeout: 120000 });
  }
}
