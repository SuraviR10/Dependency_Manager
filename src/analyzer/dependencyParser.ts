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
   * Parse Python dependencies from requirements.txt, pyproject.toml, or Pipfile
   */
  private parsePythonDependencies(): ParsedDependencies {
    const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      return this.parseRequirementsTxt(requirementsPath);
    }
    const pyprojectPath = path.join(this.workspacePath, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      return this.parsePyprojectToml(pyprojectPath);
    }
    const pipfilePath = path.join(this.workspacePath, 'Pipfile');
    if (fs.existsSync(pipfilePath)) {
      return this.parsePipfile(pipfilePath);
    }
    return { direct: new Map() };
  }

  private parseRequirementsTxt(filePath: string): ParsedDependencies {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = new Map<string, string>();
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
          continue;
        }
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)(.*)/);
        if (match) {
          dependencies.set(match[1].toLowerCase(), match[2] || '');
        }
      }
      return { direct: dependencies };
    } catch {
      return { direct: new Map() };
    }
  }

  private parsePyprojectToml(filePath: string): ParsedDependencies {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = new Map<string, string>();
      // Extract from [project] dependencies = [...] or [tool.poetry.dependencies]
      const depBlockRegex = /\[(?:project|tool\.poetry)\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/g;
      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = depBlockRegex.exec(content)) !== null) {
        const block = blockMatch[1];
        const lineRegex = /["']([a-zA-Z0-9_.-]+)[^"']*["']/g;
        let lineMatch: RegExpExecArray | null;
        while ((lineMatch = lineRegex.exec(block)) !== null) {
          dependencies.set(lineMatch[1].toLowerCase(), '*');
        }
      }
      // Also handle [tool.poetry.dependencies] key = "version" style
      const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/);
      if (poetrySection) {
        const kvRegex = /^([a-zA-Z0-9_.-]+)\s*=/gm;
        let kv: RegExpExecArray | null;
        while ((kv = kvRegex.exec(poetrySection[1])) !== null) {
          const name = kv[1].toLowerCase();
          if (name !== 'python') {
            dependencies.set(name, '*');
          }
        }
      }
      return { direct: dependencies };
    } catch {
      return { direct: new Map() };
    }
  }

  private parsePipfile(filePath: string): ParsedDependencies {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = new Map<string, string>();
      let inPackages = false;
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '[packages]' || trimmed === '[dev-packages]') {
          inPackages = true;
          continue;
        }
        if (trimmed.startsWith('[')) {
          inPackages = false;
          continue;
        }
        if (inPackages && trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const pkgName = trimmed.substring(0, eqIdx).trim().toLowerCase();
            if (pkgName) {
              dependencies.set(pkgName, trimmed.substring(eqIdx + 1).trim());
            }
          }
        }
      }
      return { direct: dependencies };
    } catch {
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
