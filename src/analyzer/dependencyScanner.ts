/**
 * Dependency Scanner
 * Scans workspace files for Python and Node.js imports,
 * detects declared dependencies and generates optimization hints.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { SupportedLanguage, DependencySummary } from '../types/types';
import { normalizePackageName, isValidPackageName } from '../utils/helpers';
import { DependencyParser } from './dependencyParser';

export interface DependencyScanResult {
  languages: SupportedLanguage[];
  pythonPackages: Map<string, Set<string>>;
  nodePackages: Map<string, Set<string>>;
  declaredPackages: Map<string, string>;
  missingPackages: Set<string>;
  unusedPackages: Set<string>;
  scannedFiles: number;
}

export class DependencyScanner {
  private workspacePath: string;
  private parser: DependencyParser;
  private ignorePatterns = [
    '**/node_modules/**',
    '**/__pycache__/**',
    '**/.venv/**',
    '**/venv/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
  ];

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.parser = new DependencyParser(workspacePath);
  }

  public async scanWorkspace(languages?: SupportedLanguage[]): Promise<DependencyScanResult> {
    const filePaths = await this.findWorkspaceFiles();

    const allowedLanguages = languages && languages.length > 0 ? new Set(languages) : null;
    const pythonPackages = new Map<string, Set<string>>();
    const nodePackages = new Map<string, Set<string>>();
    const declaredPackages = new Map<string, string>();
    const detectedLanguages = new Set<SupportedLanguage>();
    let scannedFiles = 0;

    // Parse declared packages once up-front
    if (!allowedLanguages || allowedLanguages.has(SupportedLanguage.NodeJS)) {
      this.mergeDeclaredPackages(this.parser.parseDependencies(SupportedLanguage.NodeJS).direct, declaredPackages);
    }
    if (!allowedLanguages || allowedLanguages.has(SupportedLanguage.Python)) {
      this.mergeDeclaredPackages(this.parser.parseDependencies(SupportedLanguage.Python).direct, declaredPackages);
    }

    for (const filePath of filePaths) {
      const extension = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath).toLowerCase();
      scannedFiles += 1;

      // Skip config files — already parsed above
      if (['package.json', 'requirements.txt', 'pyproject.toml', 'pipfile'].includes(basename)) {
        if (basename === 'pyproject.toml' || basename === 'pipfile') {
          if (!allowedLanguages || allowedLanguages.has(SupportedLanguage.Python)) {
            detectedLanguages.add(SupportedLanguage.Python);
          }
        }
        continue;
      }

      if (extension === '.py') {
        if (!allowedLanguages || allowedLanguages.has(SupportedLanguage.Python)) {
          detectedLanguages.add(SupportedLanguage.Python);
          await this.collectImports(filePath, SupportedLanguage.Python, pythonPackages);
        }
      } else if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
        if (!allowedLanguages || allowedLanguages.has(SupportedLanguage.NodeJS)) {
          detectedLanguages.add(SupportedLanguage.NodeJS);
          await this.collectImports(filePath, SupportedLanguage.NodeJS, nodePackages);
        }
      }
    }

    const missingPackages = new Set<string>();
    const unusedPackages = new Set<string>();

    const allUsedPackages = new Set<string>([...pythonPackages.keys(), ...nodePackages.keys()]);

    for (const packageName of allUsedPackages) {
      if (!declaredPackages.has(packageName)) {
        missingPackages.add(packageName);
      }
    }

    for (const packageName of declaredPackages.keys()) {
      if (!allUsedPackages.has(packageName)) {
        unusedPackages.add(packageName);
      }
    }

    const languageList = Array.from(detectedLanguages);
    const result: DependencyScanResult = {
      languages: languageList.length > 0 ? languageList : [SupportedLanguage.Unknown],
      pythonPackages,
      nodePackages,
      declaredPackages,
      missingPackages,
      unusedPackages,
      scannedFiles,
    };

    return result;
  }

  private async findWorkspaceFiles(): Promise<string[]> {
    try {
      const matches = await glob('{**/*.py,**/*.js,**/*.ts,**/*.jsx,**/*.tsx,package.json,requirements.txt,pyproject.toml,Pipfile}', {
        cwd: this.workspacePath,
        absolute: true,
        nodir: true,
        ignore: this.ignorePatterns,
      });

      return matches || [];
    } catch (error) {
      console.warn('[DependencyScanner] Error while scanning workspace files:', error);
      return [];
    }
  }

  private async collectImports(
    filePath: string,
    language: SupportedLanguage,
    usedPackages: Map<string, Set<string>>
  ): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const packages = this.parseImports(content, language);

      for (const packageName of packages) {
        const normalized = normalizePackageName(packageName, language);
        if (!isValidPackageName(normalized)) {
          continue;
        }

        const fileSet = usedPackages.get(normalized) || new Set<string>();
        fileSet.add(path.relative(this.workspacePath, filePath));
        usedPackages.set(normalized, fileSet);
      }
    } catch (error) {
      // If a single file cannot be read, continue scanning others.
      console.warn(`[DependencyScanner] Failed to read ${filePath}:`, error);
    }
  }

  private parseImports(content: string, language: SupportedLanguage): Set<string> {
    const packages = new Set<string>();

    if (language === SupportedLanguage.Python) {
      const importRegex = /^(?:from\s+([a-zA-Z0-9_.-]+)\s+import|import\s+([a-zA-Z0-9_.-]+))/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content))) {
        const moduleName = match[1] || match[2];
        if (!moduleName) {
          continue;
        }

        const packageName = this.normalizePythonPackageName(moduleName);
        if (packageName) {
          packages.add(packageName);
        }
      }
    }

    if (language === SupportedLanguage.NodeJS) {
      const importRegex = /(?:import\s+(?:[^'"\n]+\s+from\s+)?|require\()(["'])([^"']+)\1/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content))) {
        const target = match[2];
        if (!target || this.isRelativePath(target)) {
          continue;
        }

        const packageName = this.normalizeNodePackageName(target);
        if (packageName) {
          packages.add(packageName);
        }
      }
    }

    return packages;
  }

  private normalizePythonPackageName(moduleName: string): string | null {
    if (!moduleName || moduleName.trim().length === 0) {
      return null;
    }

    const normalized = moduleName.split('.')[0].trim();
    const aliasMap: Record<string, string> = {
      cv2: 'opencv-python',
      sklearn: 'scikit-learn',
      pil: 'pillow',
      pillow: 'pillow',
      pandas: 'pandas',
      numpy: 'numpy',
      flask: 'flask',
      django: 'django',
      tensorflow: 'tensorflow',
      torch: 'torch',
      requests: 'requests',
    };

    return aliasMap[normalized] || normalized;
  }

  private normalizeNodePackageName(target: string): string | null {
    const normalized = target.trim();
    if (!normalized || this.isRelativePath(normalized)) {
      return null;
    }

    if (normalized.startsWith('@')) {
      const parts = normalized.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : normalized;
    }

    return normalized.split('/')[0];
  }

  private isRelativePath(target: string): boolean {
    return target.startsWith('.') || target.startsWith('/') || target.startsWith('..');
  }

  private mergeDeclaredPackages(source: Map<string, string>, target: Map<string, string>): void {
    for (const [pkg, version] of source) {
      target.set(pkg.toLowerCase(), version || '*');
    }
  }

  public createSummary(scanResult: DependencyScanResult): DependencySummary {
    const usedPackages = Array.from(new Set<string>([...scanResult.pythonPackages.keys(), ...scanResult.nodePackages.keys()])).sort();
    const declaredPackages = Array.from(scanResult.declaredPackages.keys()).sort();
    const missingPackages = Array.from(scanResult.missingPackages).sort();
    const unusedPackages = Array.from(scanResult.unusedPackages).sort();
    const languages = scanResult.languages;

    const healthScore = Math.max(
      20,
      100 - missingPackages.length * 18 - unusedPackages.length * 4 - Math.max(0, declaredPackages.length - usedPackages.length)
    );

    return {
      languages,
      usedPackages,
      declaredPackages,
      missingPackages,
      unusedPackages,
      healthScore,
      environmentStatus: languages.includes(SupportedLanguage.Python)
        ? 'Python environment detected'
        : languages.includes(SupportedLanguage.NodeJS)
        ? 'Node.js environment detected'
        : 'No language-specific environment detected',
      scannedFiles: scanResult.scannedFiles,
    };
  }
}
