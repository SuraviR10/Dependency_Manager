import * as fs from 'fs/promises';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

interface Snapshot {
  id: string;
  description: string;
  files: Record<string, string>;
  targetPackage?: string;
}

export class SnapshotManager {
  private snapshots: Snapshot[] = [];
  
  constructor(private workspacePath: string) {}

  public async capture(description: string, targetPackage?: string): Promise<void> {
    const snapshot: Snapshot = { id: Date.now().toString(), description, files: {}, targetPackage };
    
    try {
      const pkgPath = path.join(this.workspacePath, 'package.json');
      snapshot.files['package.json'] = await fs.readFile(pkgPath, 'utf-8');
    } catch {}

    try {
      const reqPath = path.join(this.workspacePath, 'requirements.txt');
      snapshot.files['requirements.txt'] = await fs.readFile(reqPath, 'utf-8');
    } catch {}

    this.snapshots.push(snapshot);
  }

  public async restoreLatest(): Promise<void> {
    const snapshot = this.snapshots.pop();
    if (!snapshot) return;

    // 1. Restore config state
    for (const [file, content] of Object.entries(snapshot.files)) {
      await fs.writeFile(path.join(this.workspacePath, file), content, 'utf-8');
    }

    // 2. Erase the corrupted physical package state
    if (snapshot.targetPackage) {
      try {
        await exec(`npm uninstall ${snapshot.targetPackage}`, { cwd: this.workspacePath });
        await exec(`pip uninstall -y ${snapshot.targetPackage}`, { cwd: this.workspacePath });
      } catch (e) { /* Ignore if it wasn't installed */ }
    }
  }
}