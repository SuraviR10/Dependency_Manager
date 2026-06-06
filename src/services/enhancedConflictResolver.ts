/**
 * Enhanced Conflict Resolver
 * Provides intelligent conflict detection and resolution suggestions
 */

import * as cp from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { SupportedLanguage } from '../types/types';

const execFile = util.promisify(cp.execFile);

export interface ConflictResolution {
  conflictPackage: string;
  requiredBy: string;
  currentVersion: string;
  requiredVersion: string;
  compatibility: 'compatible' | 'incompatible' | 'unknown';
  suggestedActions: ResolutionAction[];
}

export interface ResolutionAction {
  action: string;
  command: string;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}

export class EnhancedConflictResolver {
  private workspacePath: string;
  private execAsync = util.promisify(cp.exec);

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Analyze and provide intelligent resolution for Python conflicts
   */
  public async resolvePythonConflicts(): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    try {
      const pipCmd = process.platform === 'win32' ? 'pip.exe' : 'pip';
      await execFile(pipCmd, ['check'], { cwd: this.workspacePath, timeout: 5000 });
    } catch (error: any) {
      if (error.stdout) {
        const lines = error.stdout.split('\n');
        
        for (const line of lines) {
          // Parse: "Package X has requirement Y>=Z, but you have W"
          const match = line.match(/^(\S+)\s+has requirement\s+([^,]+),\s+but you have\s+(\S+)\s+(.*)\./);
          
          if (match) {
            const [, conflictPkg, requirement, currentVersion] = match;
            const requiredVersion = requirement.split(/[><=!]/).filter((v: string) => v.trim())[0];

            const resolution: ConflictResolution = {
              conflictPackage: conflictPkg,
              requiredBy: 'Unknown',
              currentVersion,
              requiredVersion: requiredVersion || 'not specified',
              compatibility: this.checkCompatibility(currentVersion, requiredVersion),
              suggestedActions: this.generatePythonActions(conflictPkg, requirement, currentVersion),
            };

            resolutions.push(resolution);
          }
        }
      }
    }

    return resolutions;
  }

  /**
   * Analyze and provide intelligent resolution for Node.js conflicts
   */
  public async resolveNodeConflicts(): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      await execFile(npmCmd, ['ls', '--json'], { cwd: this.workspacePath, timeout: 5000 });
    } catch (error: any) {
      if (error.stdout) {
        try {
          const data = JSON.parse(error.stdout);
          
          if (data.problems) {
            for (const problem of data.problems) {
              const resolution: ConflictResolution = {
                conflictPackage: this.extractPackageName(problem),
                requiredBy: this.extractRequiredBy(problem),
                currentVersion: this.extractCurrentVersion(problem),
                requiredVersion: this.extractRequiredVersion(problem),
                compatibility: 'unknown',
                suggestedActions: this.generateNodeActions(problem),
              };

              resolutions.push(resolution);
            }
          }
        } catch {
          // JSON parse failed
        }
      }
    }

    return resolutions;
  }

  /**
   * Generate Python-specific resolution actions
   */
  private generatePythonActions(
    pkg: string,
    requirement: string,
    currentVersion: string
  ): ResolutionAction[] {
    const actions: ResolutionAction[] = [];

    // Action 1: Upgrade package
    actions.push({
      action: 'Upgrade Package',
      command: `pip install --upgrade "${pkg}"`,
      riskLevel: 'medium',
      explanation: `Upgrade ${pkg} to the latest version that satisfies the dependency requirements.`,
    });

    // Action 2: Install specific version
    const versionMatch = requirement.match(/([0-9.]+)/);
    if (versionMatch) {
      actions.push({
        action: 'Install Specific Version',
        command: `pip install "${pkg}==${versionMatch[1]}"`,
        riskLevel: 'low',
        explanation: `Install the exact version required: ${versionMatch[1]}`,
      });
    }

    // Action 3: Downgrade dependent package
    actions.push({
      action: 'Update Requirements',
      command: `# Review requirements.txt and update version constraints`,
      riskLevel: 'high',
      explanation: 'Manually review and update your requirements.txt to use compatible versions.',
    });

    // Action 4: Use flexible version pinning
    const flexibleVersion = currentVersion.split('.')[0] + '.*';
    actions.push({
      action: 'Use Flexible Versioning',
      command: `pip install "${pkg}${flexibleVersion}"`,
      riskLevel: 'low',
      explanation: `Allow compatible versions: ${flexibleVersion}`,
    });

    return actions;
  }

  /**
   * Generate Node.js-specific resolution actions
   */
  private generateNodeActions(problem: string): ResolutionAction[] {
    const actions: ResolutionAction[] = [];

    actions.push({
      action: 'Reinstall Dependencies',
      command: 'npm install',
      riskLevel: 'low',
      explanation: 'Clean reinstall of all dependencies to resolve version conflicts.',
    });

    actions.push({
      action: 'Update Lock File',
      command: 'npm install --save',
      riskLevel: 'medium',
      explanation: 'Update package-lock.json to resolve peer dependency issues.',
    });

    actions.push({
      action: 'Install with Legacy Peer Deps',
      command: 'npm install --legacy-peer-deps',
      riskLevel: 'medium',
      explanation: 'Install while ignoring peer dependency conflicts (use cautiously).',
    });

    actions.push({
      action: 'Check npm Audit',
      command: 'npm audit fix',
      riskLevel: 'medium',
      explanation: 'Fix security vulnerabilities which may resolve conflicts.',
    });

    return actions;
  }

  /**
   * Check version compatibility
   */
  private checkCompatibility(current: string, required: string): 'compatible' | 'incompatible' | 'unknown' {
    try {
      const currentParts = current.split('.').map(Number);
      const requiredParts = required.split('.').map(Number);

      // Simple heuristic: major version must match
      if (currentParts[0] !== requiredParts[0]) {
        return 'incompatible';
      }

      // Minor version at least as high
      if (currentParts[1] && requiredParts[1] && currentParts[1] < requiredParts[1]) {
        return 'incompatible';
      }

      return 'compatible';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract package name from problem string
   */
  private extractPackageName(problem: string): string {
    const match = problem.match(/(\S+)\s+/);
    return match?.[1] || 'unknown';
  }

  /**
   * Extract required by from problem string
   */
  private extractRequiredBy(problem: string): string {
    const match = problem.match(/required by\s+(\S+)/);
    return match?.[1] || 'unknown';
  }

  /**
   * Extract current version from problem
   */
  private extractCurrentVersion(problem: string): string {
    const match = problem.match(/current:\s+(\S+)/);
    return match?.[1] || 'unknown';
  }

  /**
   * Extract required version from problem
   */
  private extractRequiredVersion(problem: string): string {
    const match = problem.match(/required:\s+(\S+)/);
    return match?.[1] || 'unknown';
  }

  /**
   * Auto-attempt to resolve conflicts
   */
  public async autoResolve(language: SupportedLanguage): Promise<boolean> {
    try {
      if (language === SupportedLanguage.Python) {
        // Try upgrading all packages
        await this.execAsync('pip install --upgrade pip', { cwd: this.workspacePath, timeout: 60000 });
        await this.execAsync('pip install --upgrade -r requirements.txt', { cwd: this.workspacePath, timeout: 120000 });
        return true;
      } else if (language === SupportedLanguage.NodeJS) {
        // Try npm audit fix
        await this.execAsync('npm install', { cwd: this.workspacePath, timeout: 120000 });
        await this.execAsync('npm audit fix', { cwd: this.workspacePath, timeout: 120000 });
        return true;
      }
    } catch (error) {
      console.error('[ConflictResolver] Auto-resolve failed:', error);
      return false;
    }

    return false;
  }
}
