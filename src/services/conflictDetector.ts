import * as cp from 'child_process';
import * as util from 'util';
import { SupportedLanguage } from '../types/types';

const execFile = util.promisify(cp.execFile);

export interface ConflictInfo {
  package: string;
  affectedDependency: string;
  message: string;
  language: SupportedLanguage;
  severity: string;
  recommendedFix: string;
  confidenceScore: number;
}

export class ConflictDetector {
  constructor(private workspacePath: string) {}

  public async detectConflicts(language: SupportedLanguage): Promise<{ conflicts: ConflictInfo[] }> {
    const conflicts: ConflictInfo[] = [];
    
    if (language === SupportedLanguage.Python) {
      try {
        const pipCmd = process.platform === 'win32' ? 'pip.exe' : 'pip';
        await execFile(pipCmd, ['check'], { cwd: this.workspacePath, timeout: 5000 });
      } catch (unknownErr: unknown) {
        const err = unknownErr as { stdout?: string };
        if (err.stdout) {
          const lines = err.stdout.split('\n');
          for (const line of lines) {
            const match = line.match(/^(\S+)\s+.*?\s+has requirement\s+([^,]+(?:,[^,]+)*),\s+but you have\s+(\S+)\s+(.*)\./);
            if (match) {
              const [, pkg, requirement, affectedPkg] = match;
              conflicts.push({
                package: pkg,
                affectedDependency: affectedPkg,
                message: line.trim(),
                language,
                severity: 'High',
                recommendedFix: `pip install "${requirement}"`,
                confidenceScore: 100
              });
            } else if (line.includes('conflict') || line.includes('has requirement')) {
              conflicts.push({
                package: 'Unknown',
                affectedDependency: 'Unknown',
                message: line.trim(),
                language,
                severity: 'High',
                recommendedFix: 'Review dependency versions.',
                confidenceScore: 80
              });
            }
          }
        }
      }
    } else if (language === SupportedLanguage.NodeJS) {
      try {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execFile(npmCmd, ['ls', '--json'], { cwd: this.workspacePath, timeout: 5000 });
      } catch (unknownErr: unknown) {
        const err = unknownErr as { stdout?: string };
        if (err.stdout) {
          try {
            const data = JSON.parse(err.stdout);
            if (data.error && data.error.code === 'ELSPROBLEMS') {
               const problems = data.error.summary ? data.error.summary.split('\n') : [];
               for (const problem of problems) {
                 if (problem.includes('peer dep missing:')) {
                   const match = problem.match(/peer dep missing:\s+([^@\s]+)(@[^\s]+)?,\s+required by\s+(.*)/);
                   if (match) {
                     conflicts.push({
                        package: match[3],
                        affectedDependency: match[1],
                        message: problem.trim(),
                        language,
                        severity: 'High',
                        recommendedFix: `npm install ${match[1]}${match[2] || ''}`,
                        confidenceScore: 100
                     });
                   } else {
                     conflicts.push({
                       package: 'Unknown',
                       affectedDependency: 'Unknown',
                       message: problem.trim(),
                       language,
                       severity: 'High',
                       recommendedFix: 'npm install to resolve peer dependencies.',
                       confidenceScore: 80
                     });
                   }
                 } else if (problem.includes('invalid:')) {
                   conflicts.push({
                     package: 'Unknown',
                     affectedDependency: 'Unknown',
                     message: problem.trim(),
                     language,
                     severity: 'High',
                     recommendedFix: 'npm install to resolve invalid dependency versions.',
                     confidenceScore: 80
                   });
                 }
               }
            } else if (data.problems) {
               for (const problem of data.problems) {
                 conflicts.push({
                   package: 'Unknown',
                   affectedDependency: 'Unknown',
                   message: problem,
                   language,
                   severity: 'High',
                   recommendedFix: 'npm audit fix',
                   confidenceScore: 90
                 });
               }
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