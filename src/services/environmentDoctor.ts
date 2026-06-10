/**
 * Environment Doctor
 * Diagnoses environment issues: Python version, Node version, venv status,
 * interpreter selection, environment variables, and PATH configuration.
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

export interface EnvironmentIssue {
  id: string;
  category: 'python' | 'node' | 'venv' | 'interpreter' | 'path' | 'variables';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  currentValue?: string;
  expectedValue?: string;
  suggestedFix: string;
  fixCommand?: string;
}

export interface EnvironmentReport {
  timestamp: number;
  python: {
    installed: boolean;
    version?: string;
    path?: string;
    issue?: EnvironmentIssue;
  };
  node: {
    installed: boolean;
    version?: string;
    path?: string;
    issue?: EnvironmentIssue;
  };
  venv: {
    exists: boolean;
    active: boolean;
    path?: string;
    python?: string;
    issue?: EnvironmentIssue;
  };
  interpreter: {
    selected?: string;
    correct: boolean;
    issue?: EnvironmentIssue;
  };
  pathVariables: {
    valid: boolean;
    issues: EnvironmentIssue[];
  };
  issues: EnvironmentIssue[];
  healthScore: number; // 0-100
  summary: string;
}

export class EnvironmentDoctor {
  private workspacePath: string;
  private execAsync = util.promisify(cp.exec);

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Run a comprehensive environment diagnosis
   */
  public async diagnose(): Promise<EnvironmentReport> {
    const report: EnvironmentReport = {
      timestamp: Date.now(),
      python: { installed: false },
      node: { installed: false },
      venv: { exists: false, active: false },
      interpreter: { correct: false },
      pathVariables: { valid: true, issues: [] },
      issues: [],
      healthScore: 100,
      summary: '',
    };

    try {
      // Run checks in parallel
      await Promise.all([
        this.checkPython(report),
        this.checkNode(report),
        this.checkVenv(report),
        this.checkInterpreter(report),
        this.checkPathVariables(report),
      ]);

      // Calculate overall health score
      report.healthScore = Math.max(0, 100 - report.issues.length * 15);
      report.summary = this.generateSummary(report);
    } catch (error) {
      console.error('[EnvironmentDoctor] Diagnosis failed:', error);
    }

    return report;
  }

  /**
   * Check Python installation and version
   */
  private async checkPython(report: EnvironmentReport): Promise<void> {
    try {
      const { stdout } = await this.execAsync('python --version', { timeout: 5000 });
      const versionMatch = stdout.match(/Python (\d+\.\d+\.\d+)/);

      if (versionMatch) {
        report.python.installed = true;
        report.python.version = versionMatch[1];
        const major = parseInt(versionMatch[1].split('.')[0], 10);
        const minor = parseInt(versionMatch[1].split('.')[1], 10);

        // Check if version is reasonable (3.8 or higher)
        if (major < 3 || (major === 3 && minor < 8)) {
          const issue: EnvironmentIssue = {
            id: 'python-version-old',
            category: 'python',
            severity: 'warning',
            title: 'Python Version Outdated',
            description: `Python ${versionMatch[1]} is outdated. Modern packages require Python 3.8+.`,
            currentValue: versionMatch[1],
            expectedValue: '3.11+',
            suggestedFix: 'Update Python to version 3.11 or higher for better package compatibility.',
          };
          report.python.issue = issue;
          report.issues.push(issue);
        }
      }
    } catch {
      const issue: EnvironmentIssue = {
        id: 'python-not-found',
        category: 'python',
        severity: 'error',
        title: 'Python Not Found',
        description: 'Python is not installed or not in PATH.',
        suggestedFix: 'Install Python 3.11+ from python.org or your package manager.',
        fixCommand: 'python --version',
      };
      report.python.issue = issue;
      report.issues.push(issue);
    }
  }

  /**
   * Check Node.js installation and version
   */
  private async checkNode(report: EnvironmentReport): Promise<void> {
    try {
      const { stdout } = await this.execAsync('node --version', { timeout: 5000 });
      const versionMatch = stdout.match(/v(\d+\.\d+\.\d+)/);

      if (versionMatch) {
        report.node.installed = true;
        report.node.version = versionMatch[1];
        const major = parseInt(versionMatch[1].split('.')[0], 10);

        // Check if version is reasonable (16+)
        if (major < 16) {
          const issue: EnvironmentIssue = {
            id: 'node-version-old',
            category: 'node',
            severity: 'warning',
            title: 'Node.js Version Outdated',
            description: `Node.js ${versionMatch[1]} is older than LTS. Update to 20+.`,
            currentValue: versionMatch[1],
            expectedValue: '20+',
            suggestedFix: 'Update Node.js to version 20 LTS or newer.',
          };
          report.node.issue = issue;
          report.issues.push(issue);
        }
      }
    } catch {
      // Node not installed is usually OK (Python projects don't need it)
      report.node.installed = false;
    }
  }

  /**
   * Check virtual environment status
   */
  private async checkVenv(report: EnvironmentReport): Promise<void> {
    const venvDirs = ['.venv', 'venv', 'env'];
    let foundVenv = false;

    for (const dir of venvDirs) {
      const venvPath = path.join(this.workspacePath, dir);
      if (fs.existsSync(venvPath)) {
        report.venv.exists = true;
        report.venv.path = venvPath;
        foundVenv = true;

        // Check if venv is activated (heuristic: check if VIRTUAL_ENV is set)
        const isActive = process.env.VIRTUAL_ENV === venvPath;
        report.venv.active = isActive;

        if (!isActive) {
          const activateScript = process.platform === 'win32'
            ? `${venvPath}\\Scripts\\activate`
            : `source ${venvPath}/bin/activate`;

          const issue: EnvironmentIssue = {
            id: 'venv-not-active',
            category: 'venv',
            severity: 'warning',
            title: 'Virtual Environment Not Activated',
            description: `Virtual environment exists at ${venvPath} but is not active.`,
            suggestedFix: `Activate the environment: ${activateScript}`,
          };
          report.venv.issue = issue;
          report.issues.push(issue);
        }
        break;
      }
    }

    if (!foundVenv) {
      const issue: EnvironmentIssue = {
        id: 'venv-missing',
        category: 'venv',
        severity: 'warning',
        title: 'No Virtual Environment',
        description: 'No virtual environment found in workspace.',
        suggestedFix: 'Create one with: python -m venv .venv',
        fixCommand: 'python -m venv .venv',
      };
      report.venv.issue = issue;
      report.issues.push(issue);
    }
  }

  /**
   * Check selected Python interpreter
   */
  private async checkInterpreter(report: EnvironmentReport): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('python');
      const pythonPath = config.get<string>('defaultInterpreterPath');

      if (pythonPath) {
        report.interpreter.selected = pythonPath;

        // Check if it's valid
        if (!fs.existsSync(pythonPath)) {
          const issue: EnvironmentIssue = {
            id: 'interpreter-invalid',
            category: 'interpreter',
            severity: 'error',
            title: 'Invalid Interpreter Path',
            description: `Selected Python interpreter not found: ${pythonPath}`,
            suggestedFix: 'Select a valid Python interpreter in VS Code settings.',
          };
          report.interpreter.issue = issue;
          report.interpreter.correct = false;
          report.issues.push(issue);
          return;
        }

        report.interpreter.correct = true;
      } else {
        const issue: EnvironmentIssue = {
          id: 'interpreter-not-selected',
          category: 'interpreter',
          severity: 'warning',
          title: 'No Python Interpreter Selected',
          description: 'No default Python interpreter is configured.',
          suggestedFix: 'Select a Python interpreter: Cmd+Shift+P → Python: Select Interpreter',
        };
        report.interpreter.issue = issue;
        report.interpreter.correct = false;
        report.issues.push(issue);
      }
    } catch {
      // Error checking interpreter
    }
  }

  /**
   * Check PATH variables and environment configuration
   */
  private async checkPathVariables(report: EnvironmentReport): Promise<void> {
    const pathVar = process.env.PATH || '';
    const pathDirs = pathVar.split(process.platform === 'win32' ? ';' : ':');

    // Check if Python is in PATH
    if (report.python.installed) {
      const pythonInPath = pathDirs.some(dir => {
        try {
          return fs.readdirSync(dir).some(file =>
            file.toLowerCase().startsWith('python')
          );
        } catch {
          return false;
        }
      });

      if (!pythonInPath) {
        const issue: EnvironmentIssue = {
          id: 'python-not-in-path',
          category: 'path',
          severity: 'warning',
          title: 'Python Not in PATH',
          description: 'Python is installed but not accessible from command line.',
          suggestedFix: 'Add Python installation directory to your system PATH.',
        };
        report.pathVariables.issues.push(issue);
        report.pathVariables.valid = false;
        report.issues.push(issue);
      }
    }

    // Check for common environment variables
    const requiredEnvVars = ['HOME', 'USER'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
      const issue: EnvironmentIssue = {
        id: 'missing-env-vars',
        category: 'variables',
        severity: 'info',
        title: 'Missing Environment Variables',
        description: `Missing: ${missingVars.join(', ')}`,
        suggestedFix: 'These variables may be needed for certain tools.',
      };
      report.pathVariables.issues.push(issue);
      report.issues.push(issue);
    }
  }

  /**
   * Generate a human-readable summary
   */
  private generateSummary(report: EnvironmentReport): string {
    const errorCount = report.issues.filter(i => i.severity === 'error').length;
    const warningCount = report.issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      return `Critical: Environment has ${errorCount} critical issue(s) and ${warningCount} warning(s). Your project may not work correctly.`;
    }
    if (warningCount > 0) {
      return `Warning: Environment has ${warningCount} warning(s). Consider updating your setup.`;
    }
    return 'Healthy: Environment is healthy! All checks passed.';
  }
}
