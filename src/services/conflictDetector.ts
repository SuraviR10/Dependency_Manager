import * as cp from 'child_process';
import * as util from 'util';
import { SupportedLanguage } from '../types/types';

const exec = util.promisify(cp.exec);

export class ConflictDetector {
  constructor(private workspacePath: string) {}

  public async detectConflicts(language: SupportedLanguage): Promise<{ conflicts: any[] }> {
    const conflicts: any[] = [];
    
    if (language === SupportedLanguage.Python) {
      try {
        const { stdout } = await exec('pip check', { cwd: this.workspacePath });
      } catch (err: any) {
        if (err.stdout) {
          const lines = err.stdout.split('\n');
          for (const line of lines) {
            if (line.includes('has requirement') || line.includes('conflict')) {
              conflicts.push({ message: line.trim(), language, severity: 'high' });
            }
          }
        }
      }
    } else if (language === SupportedLanguage.NodeJS) {
      try {
        await exec('npm ls --json', { cwd: this.workspacePath });
      } catch (err: any) {
        if (err.stdout) {
          try {
            const data = JSON.parse(err.stdout);
            if (data.error && data.error.code === 'ELSPROBLEMS') {
               conflicts.push({ 
                 message: 'npm peer dependency conflicts detected. Run npm audit or npm ls for details.', 
                 language,
                 severity: 'high'
               });
            }
          } catch (e) {
            // JSON parse failed, ignore
          }
        }
      }
    }
    return { conflicts };
  }
}