import { SupportedLanguage } from '../types/types';

export enum ErrorLevel {
  Level1_MissingDependency = 'Missing Dependency',
  Level2_VersionConflict = 'Version Conflict',
  Level3_EnvironmentIssue = 'Environment Issue',
  Level4_ConfigurationIssue = 'Configuration Issue',
  Level5_UnknownRuntime = 'Unknown Runtime Error'
}

export interface ClassifiedError {
  level: ErrorLevel;
  confidence: number;
  metadata: Record<string, any>;
}

export class AdvancedErrorClassifier {
  /**
   * Classifies a runtime error into a specific DART Error Level taxonomy.
   */
  public classify(errorText: string, language: SupportedLanguage): ClassifiedError {
    // Level 4: Configuration Issue
    if (this.isConfigurationIssue(errorText)) {
      return { level: ErrorLevel.Level4_ConfigurationIssue, confidence: 95, metadata: {} };
    }
    
    // Level 3: Environment Issue
    if (this.isEnvironmentIssue(errorText)) {
      return { level: ErrorLevel.Level3_EnvironmentIssue, confidence: 90, metadata: {} };
    }

    // Level 2: Version Conflict
    if (this.isVersionConflict(errorText)) {
      return { level: ErrorLevel.Level2_VersionConflict, confidence: 85, metadata: {} };
    }

    // Level 1: Missing Dependency
    if (this.isMissingDependency(errorText)) {
      return { level: ErrorLevel.Level1_MissingDependency, confidence: 90, metadata: {} };
    }

    return { level: ErrorLevel.Level5_UnknownRuntime, confidence: 100, metadata: {} };
  }

  private isMissingDependency(errorText: string): boolean {
    return /ModuleNotFoundError|Cannot find module|ImportError: No module named/i.test(errorText);
  }

  private isVersionConflict(errorText: string): boolean {
    // Catches pip conflicts and npm ERESOLVE issues
    return /requires|conflicts with|ERESOLVE|incompatible with/i.test(errorText);
  }

  private isEnvironmentIssue(errorText: string): boolean {
    // Catches missing interpreters or broken global npm installs
    return /interpreter not found|npm ERR! code ENOENT|python: command not found/i.test(errorText);
  }

  private isConfigurationIssue(errorText: string): boolean {
    // Catches missing manifest files
    return /package\.json missing|no requirements\.txt found/i.test(errorText);
  }
}