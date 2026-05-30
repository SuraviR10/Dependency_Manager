import * as fs from 'fs/promises';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

const execFile = util.promisify(cp.execFile);

interface Snapshot {
  id: string;
  description: string;
  files: Record<string, string>;
  targetPackage?: string;
  createdEnvPaths?: string[];
}

export class SnapshotManager {
  private snapshots: Snapshot[] = [];
  
  constructor(private workspacePath: string) {}

  public async capture(description: string, targetPackage?: string, createdEnvPaths?: string[]): Promise<void> {
    const snapshot: Snapshot = { id: Date.now().toString(), description, files: {}, targetPackage, createdEnvPaths };
    
    const filesToBackup = ['package.json', 'package-lock.json', 'requirements.txt', 'pyproject.toml', 'Pipfile'];
    
    for (const file of filesToBackup) {
      try {
        const filePath = path.join(this.workspacePath, file);
        snapshot.files[file] = await fs.readFile(filePath, 'utf-8');
      } catch { /* ignore */ }
    }

    this.snapshots.push(snapshot);
  }

  public async restoreLatest(): Promise<void> {
    const snapshot = this.snapshots.pop();
    if (!snapshot) { return; }

    // 1. Restore config state
    for (const [file, content] of Object.entries(snapshot.files)) {
      await fs.writeFile(path.join(this.workspacePath, file), content, 'utf-8');
    }

    // 2. Erase the corrupted physical package state
    if (snapshot.targetPackage) {
      try {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execFile(npmCmd, ['uninstall', snapshot.targetPackage], { cwd: this.workspacePath, timeout: 5000 });
      } catch (e) { /* ignore */ }
      try {
        const pipCmd = process.platform === 'win32' ? 'pip.exe' : 'pip';
        await execFile(pipCmd, ['uninstall', '-y', snapshot.targetPackage], { cwd: this.workspacePath, timeout: 5000 });
      } catch (e) { /* Ignore if it wasn't installed */ }
    }

    // 3. Remove partially created environments
    if (snapshot.createdEnvPaths) {
      for (const envPath of snapshot.createdEnvPaths) {
        try {
          await fs.rm(envPath, { recursive: true, force: true });
        } catch (e) { /* ignore */ }
      }
    }
  }
}