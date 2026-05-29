/**
 * Activity Tracker Service
 * Logs and tracks all commands, dependencies, and environment changes
 */

import { Activity, ActivityType, ActivitySeverity, ActivitySummary, ProjectHealth } from '../types/types';

export class ActivityTracker {
  private activities: Activity[] = [];
  private onActivityChange: ((activity: Activity) => void) | null = null;
  private projectHealth: ProjectHealth = {
    status: 'healthy',
    dependenciesInstalled: 0,
    unusedDependencies: 0,
    versionConflicts: 0,
    storageUsed: 0,
    lastScanned: Date.now()
  };

  constructor() {
    console.log('[ActivityTracker] Initialized');
  }

  /**
   * Log a new activity
   */
  public logActivity(
    type: ActivityType,
    severity: ActivitySeverity,
    title: string,
    details?: {
      description?: string;
      command?: string;
      packageName?: string;
      details?: Record<string, string | number | boolean>;
    }
  ): Activity {
    const activity: Activity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      description: details?.description,
      timestamp: Date.now(),
      command: details?.command,
      packageName: details?.packageName,
      details: details?.details
    };

    this.activities.push(activity);
    console.log(`[ActivityTracker] Activity logged: ${title}`);

    // Notify listeners
    if (this.onActivityChange) {
      this.onActivityChange(activity);
    }

    return activity;
  }

  /**
   * Log command execution
   */
  public logCommand(command: string, packageName?: string, success: boolean = true): Activity {
    return this.logActivity(
      ActivityType.CommandExecuted,
      success ? ActivitySeverity.Success : ActivitySeverity.Error,
      success ? `Command Executed` : `Command Failed`,
      {
        description: command,
        command,
        packageName,
        details: {
          success,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log dependency installation
   */
  public logDependencyInstalled(packageName: string, version?: string): Activity {
    const activity = this.logActivity(
      ActivityType.DependencyInstalled,
      ActivitySeverity.Success,
      `✔ ${packageName}${version ? ` (${version})` : ''} Installed`,
      {
        description: `Successfully installed ${packageName}`,
        packageName,
        details: {
          version: version || 'latest',
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );

    // Update project health
    this.projectHealth.dependenciesInstalled++;

    return activity;
  }

  /**
   * Log dependency removal
   */
  public logDependencyRemoved(packageName: string): Activity {
    return this.logActivity(
      ActivityType.DependencyRemoved,
      ActivitySeverity.Info,
      `✔ ${packageName} Removed`,
      {
        description: `Successfully removed ${packageName}`,
        packageName,
        details: {
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log dependency upgrade
   */
  public logDependencyUpgraded(packageName: string, oldVersion: string, newVersion: string): Activity {
    return this.logActivity(
      ActivityType.DependencyUpgraded,
      ActivitySeverity.Success,
      `✔ ${packageName} Upgraded`,
      {
        description: `Upgraded ${packageName} from ${oldVersion} to ${newVersion}`,
        packageName,
        details: {
          oldVersion,
          newVersion,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log failed dependency installation
   */
  public logDependencyFailed(packageName: string, error: string): Activity {
    return this.logActivity(
      ActivityType.DependencyFailed,
      ActivitySeverity.Error,
      `✗ ${packageName} Installation Failed`,
      {
        description: error,
        packageName,
        details: {
          error,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log environment creation
   */
  public logEnvironmentCreated(environmentType: string, details: Record<string, string>): Activity {
    return this.logActivity(
      ActivityType.EnvironmentCreated,
      ActivitySeverity.Success,
      `🟢 ${environmentType} Environment Created`,
      {
        description: `Virtual environment created successfully`,
        details: {
          environmentType,
          ...details,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log environment modification
   */
  public logEnvironmentModified(change: string, details?: Record<string, string>): Activity {
    return this.logActivity(
      ActivityType.EnvironmentModified,
      ActivitySeverity.Info,
      `⚙️ Environment Modified`,
      {
        description: change,
        details: {
          ...details,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log error detection
   */
  public logErrorDetected(errorType: string, packageName: string): Activity {
    return this.logActivity(
      ActivityType.ErrorDetected,
      ActivitySeverity.Warning,
      `🚨 ${errorType} Detected: ${packageName}`,
      {
        description: `Detected ${errorType} for ${packageName}`,
        packageName,
        details: {
          errorType,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log error resolution
   */
  public logErrorFixed(errorType: string, packageName: string, solution: string): Activity {
    return this.logActivity(
      ActivityType.ErrorFixed,
      ActivitySeverity.Success,
      `🟢 ${errorType} Resolved`,
      {
        description: solution,
        packageName,
        details: {
          errorType,
          solution,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Log scan completion
   */
  public logScanCompleted(
    filesScanned: number,
    issuesFound: number,
    dependenciesDetected: number
  ): Activity {
    return this.logActivity(
      ActivityType.ScanCompleted,
      ActivitySeverity.Info,
      `📊 Scan Completed`,
      {
        description: `Scanned ${filesScanned} files, found ${issuesFound} issues, detected ${dependenciesDetected} dependencies`,
        details: {
          filesScanned,
          issuesFound,
          dependenciesDetected,
          timestamp: new Date().toLocaleTimeString()
        }
      }
    );
  }

  /**
   * Get all activities
   */
  public getActivities(): Activity[] {
    return [...this.activities];
  }

  /**
   * Get recent activities (last N)
   */
  public getRecentActivities(count: number = 10): Activity[] {
    return this.activities.slice(-count).reverse();
  }

  /**
   * Get activity summary
   */
  public getActivitySummary(): ActivitySummary {
    const summary: ActivitySummary = {
      commandsExecuted: 0,
      dependenciesInstalled: 0,
      dependenciesRemoved: 0,
      errorsDetected: 0,
      errorsFixed: 0,
      lastActivity: this.activities[this.activities.length - 1] || null
    };

    for (const activity of this.activities) {
      switch (activity.type) {
        case ActivityType.CommandExecuted:
          summary.commandsExecuted++;
          break;
        case ActivityType.DependencyInstalled:
          summary.dependenciesInstalled++;
          break;
        case ActivityType.DependencyRemoved:
          summary.dependenciesRemoved++;
          break;
        case ActivityType.ErrorDetected:
          summary.errorsDetected++;
          break;
        case ActivityType.ErrorFixed:
          summary.errorsFixed++;
          break;
      }
    }

    return summary;
  }

  /**
   * Update project health
   */
  public updateProjectHealth(health: Partial<ProjectHealth>): void {
    this.projectHealth = {
      ...this.projectHealth,
      ...health,
      lastScanned: Date.now()
    };

    // Determine health status
    if (this.projectHealth.versionConflicts > 0) {
      this.projectHealth.status = 'critical';
    } else if (this.projectHealth.unusedDependencies > 0) {
      this.projectHealth.status = 'warning';
    } else {
      this.projectHealth.status = 'healthy';
    }

    console.log('[ActivityTracker] Project health updated:', this.projectHealth);
  }

  /**
   * Get project health
   */
  public getProjectHealth(): ProjectHealth {
    return { ...this.projectHealth };
  }

  /**
   * Clear all activities
   */
  public clearActivities(): void {
    this.activities = [];
    console.log('[ActivityTracker] Activities cleared');
  }

  /**
   * Set callback for activity changes
   */
  public onActivityAdded(callback: (activity: Activity) => void): void {
    this.onActivityChange = callback;
  }

  /**
   * Get storage used estimate (simplified)
   */
  public getStorageUsed(): number {
    return this.projectHealth.storageUsed;
  }

  /**
   * Update storage used
   */
  public setStorageUsed(sizeInMB: number): void {
    this.projectHealth.storageUsed = sizeInMB;
  }
}
