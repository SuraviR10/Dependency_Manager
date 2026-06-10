import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SupportedLanguage } from '../types/types';

export interface EnvironmentSnapshot {
  id: string;
  timestamp: number;
  manifestFiles: Record<string, string>;
}

export class RollbackManager {
  private snapshots: Map<string, EnvironmentSnapshot> = new Map();

  /**
   * Creates a snapshot of dependency manifest files before a mutation operation.
   */
  public createSnapshot(workspacePath: string, language: SupportedLanguage): string {
    const id = `snapshot_${Date.now()}`;
    const filesToSnapshot = this.getManifestFiles(language);
    const manifestFiles: Record<string, string> = {};

    for (const file of filesToSnapshot) {
      const fullPath = path.join(workspacePath, file);
      if (fs.existsSync(fullPath)) {
        manifestFiles[file] = fs.readFileSync(fullPath, 'utf8');
      }
    }

    this.snapshots.set(id, { id, timestamp: Date.now(), manifestFiles });
    return id;
  }

  /**
   * Restores the environment to a previous snapshot if an installation fails.
   */
  public async rollback(workspacePath: string, snapshotId: string, language: SupportedLanguage): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }

    try {
      // 1. Restore manifest files
      for (const [file, content] of Object.entries(snapshot.manifestFiles)) {
        const fullPath = path.join(workspacePath, file);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      
      // 2. Trigger a sync to clean up the actual node_modules/venv
      // This would ideally integrate with your existing DependencySync service
      // e.g., await dependencySync.syncEnvironment(workspacePath, language);
      
      return true;
    } catch (error) {
      console.error('DARTX Rollback failed:', error);
      return false;
    }
  }

  private getManifestFiles(language: SupportedLanguage): string[] {
    if (language === SupportedLanguage.NodeJS) {
      return ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    } else if (language === SupportedLanguage.Python) {
      return ['requirements.txt', 'Pipfile', 'Pipfile.lock', 'pyproject.toml'];
    }
    return [];
  }
}