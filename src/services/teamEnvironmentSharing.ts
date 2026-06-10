/**
 * Team Environment Sharing
 * Export and import environment snapshots for team collaboration
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupportedLanguage } from '../types/types';

export interface EnvironmentSnapshot {
  id: string;
  name: string;
  createdAt: number;
  createdBy?: string;
  description?: string;
  environment: {
    python?: {
      version: string;
      packages: Record<string, string>;
    };
    node?: {
      version: string;
      packages: Record<string, string>;
    };
  };
  projectInfo: {
    name: string;
    type: 'python' | 'nodejs' | 'mixed';
  };
}

export class TeamEnvironmentSharing {
  private workspacePath: string;
  private snapshotsDir: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.snapshotsDir = path.join(workspacePath, '.dartx-snapshots');
    this.ensureSnapshotsDir();
  }

  /**
   * Export current environment as shareable snapshot
   */
  public async exportEnvironment(
    name: string,
    description?: string,
    createdBy?: string
  ): Promise<EnvironmentSnapshot> {
    const snapshot: EnvironmentSnapshot = {
      id: `snapshot-${Date.now()}`,
      name,
      createdAt: Date.now(),
      createdBy,
      description,
      environment: {},
      projectInfo: {
        name: path.basename(this.workspacePath),
        type: 'mixed',
      },
    };

    // Capture Python environment
    try {
      const pythonInfo = await this.capturePythonEnvironment();
      if (pythonInfo) {
        snapshot.environment.python = pythonInfo;
      }
    } catch (error) {
      console.warn('[TeamSharing] Failed to capture Python environment:', error);
    }

    // Capture Node.js environment
    try {
      const nodeInfo = await this.captureNodeEnvironment();
      if (nodeInfo) {
        snapshot.environment.node = nodeInfo;
      }
    } catch (error) {
      console.warn('[TeamSharing] Failed to capture Node.js environment:', error);
    }

    // Save snapshot
    this.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * Save snapshot to local storage
   */
  private saveSnapshot(snapshot: EnvironmentSnapshot): void {
    const filePath = path.join(this.snapshotsDir, `${snapshot.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[TeamSharing] Snapshot saved: ${filePath}`);
  }

  /**
   * Load snapshot from JSON file
   */
  public loadSnapshot(filePath: string): EnvironmentSnapshot | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[TeamSharing] Failed to load snapshot:', error);
      return null;
    }
  }

  /**
   * Get all local snapshots
   */
  public getSnapshots(): EnvironmentSnapshot[] {
    const snapshots: EnvironmentSnapshot[] = [];

    try {
      if (!fs.existsSync(this.snapshotsDir)) return snapshots;

      const files = fs.readdirSync(this.snapshotsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.snapshotsDir, file);
          const snapshot = this.loadSnapshot(filePath);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
      }
    } catch (error) {
      console.warn('[TeamSharing] Failed to read snapshots:', error);
    }

    return snapshots;
  }

  /**
   * Export snapshot as .json for sharing (via git, email, etc)
   */
  public exportSnapshotForSharing(snapshot: EnvironmentSnapshot): string {
    const fileName = `${snapshot.projectInfo.name}-env-${new Date(snapshot.createdAt).toISOString().split('T')[0]}.json`;
    const content = JSON.stringify(snapshot, null, 2);
    return content;
  }

  /**
   * Apply snapshot: restore environment from snapshot
   */
  public async applySnapshot(snapshot: EnvironmentSnapshot): Promise<string[]> {
    const steps: string[] = [];

    // Apply Python environment
    if (snapshot.environment.python) {
      try {
        steps.push(`📍 Python version requirement: ${snapshot.environment.python.version}`);
        steps.push('📦 Installing Python packages from snapshot...');

        // Create requirements from snapshot
        const requirements = Object.entries(snapshot.environment.python.packages)
          .map(([name, version]) => `${name}==${version}`)
          .join('\n');

        const requirementsPath = path.join(this.workspacePath, 'requirements-snapshot.txt');
        fs.writeFileSync(requirementsPath, requirements, 'utf-8');
        steps.push(`✅ Created ${requirementsPath}`);
        steps.push('Run: pip install -r requirements-snapshot.txt');
      } catch (error) {
        steps.push(`❌ Failed to apply Python snapshot: ${error}`);
      }
    }

    // Apply Node.js environment
    if (snapshot.environment.node) {
      try {
        steps.push(`📍 Node.js version requirement: ${snapshot.environment.node.version}`);
        steps.push('📦 Node.js packages from snapshot:');

        const packages = Object.entries(snapshot.environment.node.packages)
          .map(([name, version]) => `${name}@${version}`)
          .join(' ');

        steps.push(`Run: npm install ${packages}`);
      } catch (error) {
        steps.push(`❌ Failed to apply Node.js snapshot: ${error}`);
      }
    }

    return steps;
  }

  /**
   * Generate shareable environment.json for team
   */
  public generateTeamEnvironmentConfig(): Record<string, any> {
    return {
      python: process.env.PYTHON_VERSION || '3.11',
      node: process.env.NODE_VERSION || '20',
      dependencies: {
        note: 'Run Dependify to auto-detect and sync dependencies',
      },
    };
  }

  /**
   * Capture current Python environment
   */
  private async capturePythonEnvironment(): Promise<{ version: string; packages: Record<string, string> } | null> {
    try {
      // Get Python version
      const { execSync } = require('child_process');
      const version = execSync('python --version', { encoding: 'utf-8' }).trim();

      // Get installed packages
      const pipOutput = execSync('pip list --format=json', { encoding: 'utf-8' });
      const packages: Record<string, string> = {};

      const installed = JSON.parse(pipOutput);
      for (const pkg of installed) {
        packages[pkg.name] = pkg.version;
      }

      return { version, packages };
    } catch {
      return null;
    }
  }

  /**
   * Capture current Node.js environment
   */
  private async captureNodeEnvironment(): Promise<{ version: string; packages: Record<string, string> } | null> {
    try {
      // Get Node version
      const { execSync } = require('child_process');
      const version = execSync('node --version', { encoding: 'utf-8' }).trim();

      // Get packages from package.json
      const packageJsonPath = path.join(this.workspacePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const packages = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return { version, packages };
    } catch {
      return null;
    }
  }

  /**
   * Ensure snapshots directory exists
   */
  private ensureSnapshotsDir(): void {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }
}
