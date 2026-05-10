/**
 * Dependency Parser
 * Parses project dependencies from configuration files
 * Supports package.json and requirements.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupportedLanguage } from '../types/types';

export interface ParsedDependencies {
  direct: Map<string, string>; // package name -> version
  dev?: Map<string, string>;   // dev dependencies (Node.js)
}

export class DependencyParser {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Parse dependencies based on project type
   */
  public parseDependencies(language: SupportedLanguage): ParsedDependencies {
    switch (language) {
      case SupportedLanguage.NodeJS:
        return this.parseNodeJsDependencies();
      case SupportedLanguage.Python:
        return this.parsePythonDependencies();
      default:
        return { direct: new Map() };
    }
  }

  /**
   * Parse Node.js dependencies from package.json
   */
  private parseNodeJsDependencies(): ParsedDependencies {
    const packageJsonPath = path.join(this.workspacePath, 'package.json');

    try {
      if (!fs.existsSync(packageJsonPath)) {
        return { direct: new Map() };
      }

      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      const dependencies = new Map<string, string>();
      const devDependencies = new Map<string, string>();

      // Parse dependencies
      if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
        for (const [pkg, version] of Object.entries(packageJson.dependencies)) {
          dependencies.set(pkg, String(version));
        }
      }

      // Parse devDependencies
      if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
        for (const [pkg, version] of Object.entries(packageJson.devDependencies)) {
          devDependencies.set(pkg, String(version));
        }
      }

      return {
        direct: dependencies,
        dev: devDependencies.size > 0 ? devDependencies : undefined,
      };
    } catch (error) {
      console.error('Error parsing package.json:', error);
      return { direct: new Map() };
    }
  }

  /**
   * Parse Python dependencies from requirements.txt
   */
  private parsePythonDependencies(): ParsedDependencies {
    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');

    try {
      if (!fs.existsSync(requirementsPath)) {
        return { direct: new Map() };
      }

      const content = fs.readFileSync(requirementsPath, 'utf-8');
      const dependencies = new Map<string, string>();

      const lines = content.split('\n');
      for (const line of lines) {
        // Skip comments and empty lines
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Parse dependency line (e.g., "numpy==1.21.0" or "requests>=2.25.0")
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)(.*)/);
        if (match) {
          const packageName = match[1].toLowerCase();
          const versionSpec = match[2] || '';
          dependencies.set(packageName, versionSpec);
        }
      }

      return { direct: dependencies };
    } catch (error) {
      console.error('Error parsing requirements.txt:', error);
      return { direct: new Map() };
    }
  }

  /**
   * Check if a package is installed
   */
  public isPackageInstalled(packageName: string, language: SupportedLanguage): boolean {
    const dependencies = this.parseDependencies(language);
    const normalizedName = packageName.toLowerCase();

    // Check direct dependencies
    for (const [name] of dependencies.direct) {
      if (name.toLowerCase() === normalizedName) {
        return true;
      }
    }

    // Check dev dependencies if available
    if (dependencies.dev) {
      for (const [name] of dependencies.dev) {
        if (name.toLowerCase() === normalizedName) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get package version from parsed dependencies
   */
  public getPackageVersion(packageName: string, language: SupportedLanguage): string | null {
    const dependencies = this.parseDependencies(language);
    const normalizedName = packageName.toLowerCase();

    // Check direct dependencies
    for (const [name, version] of dependencies.direct) {
      if (name.toLowerCase() === normalizedName) {
        return version;
      }
    }

    // Check dev dependencies
    if (dependencies.dev) {
      for (const [name, version] of dependencies.dev) {
        if (name.toLowerCase() === normalizedName) {
          return version;
        }
      }
    }

    return null;
  }

  /**
   * Get count of installed packages
   */
  public getInstalledPackageCount(language: SupportedLanguage): number {
    const dependencies = this.parseDependencies(language);
    let count = dependencies.direct.size;

    if (dependencies.dev) {
      count += dependencies.dev.size;
    }

    return count;
  }
}
