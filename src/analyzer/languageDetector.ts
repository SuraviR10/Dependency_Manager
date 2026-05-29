/**
 * Language Detector
 * Detects the programming language of the current project
 * Supports Python and Node.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupportedLanguage, LanguageDetectionResult } from '../types/types';

export class LanguageDetector {
  private workspacePath: string;
  private cachedResult: LanguageDetectionResult | null = null;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Detect project language with confidence scoring
   */
  public detectLanguage(): LanguageDetectionResult {
    // Return cached result if available
    if (this.cachedResult !== null) {
      return this.cachedResult;
    }

    // Check for package.json (Node.js)
    const hasPackageJson = this.checkFileExists('package.json');
    if (hasPackageJson) {
      this.cachedResult = {
        language: SupportedLanguage.NodeJS,
        confidence: 95,
        detectionMethod: 'config-file',
      };
      return this.cachedResult;
    }

    // Check for requirements.txt (Python)
    const hasRequirementsTxt = this.checkFileExists('requirements.txt');
    if (hasRequirementsTxt) {
      this.cachedResult = {
        language: SupportedLanguage.Python,
        confidence: 95,
        detectionMethod: 'config-file',
      };
      return this.cachedResult;
    }

    // Check for setup.py (Python)
    const hasSetupPy = this.checkFileExists('setup.py');
    if (hasSetupPy) {
      this.cachedResult = {
        language: SupportedLanguage.Python,
        confidence: 90,
        detectionMethod: 'config-file',
      };
      return this.cachedResult;
    }

    // Check for pyproject.toml (Python)
    const hasPyprojectToml = this.checkFileExists('pyproject.toml');
    if (hasPyprojectToml) {
      this.cachedResult = {
        language: SupportedLanguage.Python,
        confidence: 90,
        detectionMethod: 'config-file',
      };
      return this.cachedResult;
    }

    // Check for Pipfile (Python with pipenv)
    const hasPipfile = this.checkFileExists('Pipfile');
    if (hasPipfile) {
      this.cachedResult = {
        language: SupportedLanguage.Python,
        confidence: 85,
        detectionMethod: 'config-file',
      };
      return this.cachedResult;
    }

    // Fallback to unknown rather than expensive directory traversal.
    this.cachedResult = {
      language: SupportedLanguage.Unknown,
      confidence: 0,
      detectionMethod: 'config-file',
    };
    return this.cachedResult;
  }

  /**
   * Detect language by examining source file extensions in workspace
   */
  private detectByFileExtension(): LanguageDetectionResult {
    try {
      const files = this.getFilesInWorkspace(this.workspacePath, 3);

      let pythonCount = 0;
      let nodeCount = 0;

      for (const file of files) {
        if (file.endsWith('.py')) {
          pythonCount++;
        } else if (file.endsWith('.js') || file.endsWith('.ts')) {
          nodeCount++;
        } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
          nodeCount++;
        }
      }

      if (pythonCount > nodeCount && pythonCount > 0) {
        this.cachedResult = {
          language: SupportedLanguage.Python,
          confidence: 70,
          detectionMethod: 'file-extension',
        };
        return this.cachedResult;
      }

      if (nodeCount > pythonCount && nodeCount > 0) {
        this.cachedResult = {
          language: SupportedLanguage.NodeJS,
          confidence: 70,
          detectionMethod: 'file-extension',
        };
        return this.cachedResult;
      }
    } catch (error) {
      // Silently fail and return unknown
    }

    return {
      language: SupportedLanguage.Unknown,
      confidence: 0,
      detectionMethod: 'file-extension',
    };
  }

  /**
   * Check if a file exists in workspace
   */
  private checkFileExists(filename: string): boolean {
    const filePath = path.join(this.workspacePath, filename);
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all files in workspace up to specified depth
   */
  private getFilesInWorkspace(dirPath: string, maxDepth: number, currentDepth = 0): string[] {
    const files: string[] = [];

    if (currentDepth >= maxDepth) {
      return files;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip common non-source directories
        if (this.shouldSkipDirectory(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.getFilesInWorkspace(fullPath, maxDepth, currentDepth + 1));
        } else {
          files.push(entry.name);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }

    return files;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = [
      'node_modules',
      '__pycache__',
      '.venv',
      'venv',
      '.git',
      '.vs',
      'dist',
      'build',
      'out',
      '.env',
      '.vscode',
    ];
    return skipDirs.includes(name);
  }

  /**
   * Clear cached language (useful for testing or when workspace changes)
   */
  public clearCache(): void {
    this.cachedResult = null;
  }
}
