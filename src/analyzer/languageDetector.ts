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

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Detect project language with confidence scoring.
   * Prefers Python config files over package.json to avoid misidentifying
   * Python projects that also have a package.json for tooling.
   * Result is NOT cached so workspace changes are reflected.
   */
  public detectLanguage(): LanguageDetectionResult {
    // Python config files take priority
    if (this.checkFileExists('requirements.txt')) {
      return { language: SupportedLanguage.Python, confidence: 95, detectionMethod: 'config-file' };
    }
    if (this.checkFileExists('setup.py')) {
      return { language: SupportedLanguage.Python, confidence: 90, detectionMethod: 'config-file' };
    }
    if (this.checkFileExists('pyproject.toml')) {
      return { language: SupportedLanguage.Python, confidence: 90, detectionMethod: 'config-file' };
    }
    if (this.checkFileExists('Pipfile')) {
      return { language: SupportedLanguage.Python, confidence: 85, detectionMethod: 'config-file' };
    }
    // Node.js config file
    if (this.checkFileExists('package.json')) {
      return { language: SupportedLanguage.NodeJS, confidence: 95, detectionMethod: 'config-file' };
    }
    return this.detectByFileExtension();
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
        return { language: SupportedLanguage.Python, confidence: 70, detectionMethod: 'file-extension' };
      }

      if (nodeCount > pythonCount && nodeCount > 0) {
        return { language: SupportedLanguage.NodeJS, confidence: 70, detectionMethod: 'file-extension' };
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

}
