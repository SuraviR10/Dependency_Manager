/**
 * Dependency Sync
 * Automatically detects and syncs installed packages with requirements files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

export interface DependencyDiff {
  installedNotRecorded: Map<string, string>; // name -> version
  recordedNotInstalled: Set<string>; // names
  versionMismatches: Map<string, { installed: string; recorded: string }>;
}

export interface SyncResult {
  pythonSynced: boolean;
  nodeSynced: boolean;
  errors: string[];
  summary: string;
}

export class DependencySync {
  private workspacePath: string;
  private execAsync = util.promisify(cp.exec);

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Detect differences between installed and recorded dependencies
   */
  public async detectDifferences(): Promise<DependencyDiff> {
    const diff: DependencyDiff = {
      installedNotRecorded: new Map(),
      recordedNotInstalled: new Set(),
      versionMismatches: new Map(),
    };

    try {
      const installed = await this.getInstalledPackages();
      const recorded = await this.getRecordedDependencies();

      // Find installed but not recorded
      for (const [name, version] of installed) {
        if (!recorded.has(name)) {
          diff.installedNotRecorded.set(name, version);
        } else {
          const recordedVersion = recorded.get(name);
          if (recordedVersion && recordedVersion !== version) {
            diff.versionMismatches.set(name, {
              installed: version,
              recorded: recordedVersion,
            });
          }
        }
      }

      // Find recorded but not installed
      for (const name of recorded.keys()) {
        if (!installed.has(name)) {
          diff.recordedNotInstalled.add(name);
        }
      }
    } catch (error) {
      console.error('[DependencySync] Detection failed:', error);
    }

    return diff;
  }

  /**
   * Auto-sync dependencies: add installed packages to requirements.txt
   */
  public async syncPythonDependencies(): Promise<SyncResult> {
    const result: SyncResult = {
      pythonSynced: false,
      nodeSynced: false,
      errors: [],
      summary: '',
    };

    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
    const pyprojectPath = path.join(this.workspacePath, 'pyproject.toml');

    // Check if we have a Python project
    if (!fs.existsSync(requirementsPath) && !fs.existsSync(pyprojectPath)) {
      result.summary = 'No Python dependency files found.';
      return result;
    }

    try {
      const diff = await this.detectDifferences();

      if (diff.installedNotRecorded.size === 0 && diff.versionMismatches.size === 0) {
        result.pythonSynced = true;
        result.summary = 'Python dependencies are already synchronized.';
        return result;
      }

      // Read current requirements
      let content = '';
      if (fs.existsSync(requirementsPath)) {
        content = fs.readFileSync(requirementsPath, 'utf-8');
      }

      // Add missing packages
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      const recorded = new Set(lines.map(line => line.split('==')[0].trim().toLowerCase()));

      for (const [name, version] of diff.installedNotRecorded) {
        if (!recorded.has(name.toLowerCase())) {
          lines.push(`${name}==${version}`);
        }
      }

      // Update version mismatches
      for (const [name, versions] of diff.versionMismatches) {
        const idx = lines.findIndex(line => line.toLowerCase().startsWith(name.toLowerCase()));
        if (idx >= 0) {
          lines[idx] = `${name}==${versions.installed}`;
        }
      }

      // Sort and write back
      lines.sort();
      const updated = lines.join('\n') + '\n';

      if (fs.existsSync(requirementsPath)) {
        fs.writeFileSync(requirementsPath, updated, 'utf-8');
      } else {
        fs.writeFileSync(requirementsPath, updated, 'utf-8');
      }

      result.pythonSynced = true;
      result.summary = `✅ Synced ${diff.installedNotRecorded.size} new packages and updated ${diff.versionMismatches.size} versions.`;
    } catch (error) {
      result.errors.push(`Python sync failed: ${error}`);
      result.summary = 'Python sync failed.';
    }

    return result;
  }

  /**
   * Auto-sync Node.js dependencies: update package.json
   */
  public async syncNodeDependencies(): Promise<SyncResult> {
    const result: SyncResult = {
      pythonSynced: false,
      nodeSynced: false,
      errors: [],
      summary: '',
    };

    const packageJsonPath = path.join(this.workspacePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      result.summary = 'No package.json found.';
      return result;
    }

    try {
      // Get installed packages from node_modules
      const nodeModulesPath = path.join(this.workspacePath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        result.summary = 'No node_modules found.';
        return result;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const installedPackages = this.getNodeModuleVersions(nodeModulesPath);

      // Check for missing packages
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      let updated = false;

      for (const [name, version] of installedPackages) {
        if (!allDeps[name]) {
          if (!packageJson.dependencies) packageJson.dependencies = {};
          packageJson.dependencies[name] = `^${version}`;
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
        result.nodeSynced = true;
        result.summary = `✅ Synced ${installedPackages.size} packages to package.json`;
      } else {
        result.nodeSynced = true;
        result.summary = 'Node.js dependencies are already synchronized.';
      }
    } catch (error) {
      result.errors.push(`Node sync failed: ${error}`);
      result.summary = 'Node.js sync failed.';
    }

    return result;
  }

  /**
   * Get installed Python packages
   */
  private async getInstalledPackages(): Promise<Map<string, string>> {
    const packages = new Map<string, string>();

    try {
      const { stdout } = await this.execAsync('pip list --format=json', { timeout: 30000 });
      const installed = JSON.parse(stdout);

      for (const pkg of installed) {
        packages.set(pkg.name.toLowerCase(), pkg.version);
      }
    } catch (error) {
      console.error('[DependencySync] Failed to get installed packages:', error);
    }

    return packages;
  }

  /**
   * Get recorded dependencies from requirements.txt
   */
  private async getRecordedDependencies(): Promise<Map<string, string>> {
    const deps = new Map<string, string>();

    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      const content = fs.readFileSync(requirementsPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Parse "name==version" or "name>=version" etc
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(==|>=|<=|>|<|~=)?(.+)?$/);
        if (match) {
          const name = match[1].toLowerCase();
          const version = match[3] || 'unknown';
          deps.set(name, version);
        }
      }
    }

    return deps;
  }

  /**
   * Get Node module versions from node_modules
   */
  private getNodeModuleVersions(nodeModulesPath: string): Map<string, string> {
    const versions = new Map<string, string>();

    try {
      const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          try {
            const packageJsonPath = path.join(nodeModulesPath, entry.name, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
              versions.set(entry.name, pkg.version);
            }
          } catch {
            // Skip packages with invalid package.json
          }
        }
      }
    } catch {
      // Failed to read node_modules
    }

    return versions;
  }
}
