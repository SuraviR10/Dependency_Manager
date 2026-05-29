/**
 * Activity Panel Provider
 * Manages the sidebar webview for displaying activity timeline and project health
 */

import * as vscode from 'vscode';
import { ActivityTracker } from '../services/activityTracker';
import { Activity, ActivitySeverity, ActivityType } from '../types/types';

export class ActivityPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activityTracker: ActivityTracker;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, activityTracker: ActivityTracker) {
    this.context = context;
    this.activityTracker = activityTracker;

    // Listen for activity changes
    this.activityTracker.onActivityAdded(() => {
      this.updateView();
    });
  }

  /**
   * Resolve webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Initial content
    webviewView.webview.html = this.getHtml();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      this.handleWebviewMessage(message);
    });

    console.log('[ActivityPanelProvider] View resolved');
  }

  /**
   * Update view content
   */
  private updateView(): void {
    if (this.view) {
      this.view.webview.html = this.getHtml();
    }
  }

  /**
   * Handle messages from webview
   */
  private handleWebviewMessage(message: unknown): void {
    if (typeof message === 'object' && message !== null) {
      console.log('[ActivityPanelProvider] Message received:', message);
    }
  }

  /**
   * Get HTML content
   */
  private getHtml(): string {
    const recentActivities = this.activityTracker.getRecentActivities(15);
    const summary = this.activityTracker.getActivitySummary();
    const health = this.activityTracker.getProjectHealth();
    const storageUsed = this.activityTracker.getStorageUsed();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Activity</title>
  <style>
    :root {
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --error-color: #ef4444;
      --info-color: #3b82f6;
      --bg-primary: #1e1e1e;
      --bg-secondary: #2d2d2d;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0a0;
      --border-color: #404040;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-size: 12px;
      line-height: 1.5;
    }

    .container {
      padding: 12px;
      height: 100%;
      overflow-y: auto;
    }

    /* Section styles */
    .section {
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }

    .section:last-child {
      border-bottom: none;
    }

    .section-title {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    /* Stats cards */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }

    .stat-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .stat-card:hover {
      border-color: var(--info-color);
      transform: translateY(-2px);
    }

    .stat-number {
      font-size: 16px;
      font-weight: bold;
      color: var(--info-color);
    }

    .stat-label {
      font-size: 10px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    /* Health status */
    .health-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background-color: var(--bg-secondary);
      border-radius: 4px;
      border-left: 4px solid var(--success-color);
    }

    .health-indicator.warning {
      border-left-color: var(--warning-color);
    }

    .health-indicator.critical {
      border-left-color: var(--error-color);
    }

    .health-status {
      flex: 1;
    }

    .health-status-text {
      font-weight: 600;
      font-size: 13px;
    }

    .health-status-details {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--success-color);
      animation: pulse 2s infinite;
    }

    .health-dot.warning {
      background-color: var(--warning-color);
    }

    .health-dot.critical {
      background-color: var(--error-color);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Timeline */
    .timeline {
      position: relative;
    }

    .timeline-item {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      padding: 8px;
      background-color: var(--bg-secondary);
      border-radius: 4px;
      border-left: 3px solid var(--border-color);
      transition: all 0.2s;
    }

    .timeline-item:hover {
      border-left-color: var(--info-color);
      background-color: #353535;
    }

    .timeline-item.success {
      border-left-color: var(--success-color);
    }

    .timeline-item.error {
      border-left-color: var(--error-color);
    }

    .timeline-item.warning {
      border-left-color: var(--warning-color);
    }

    .timeline-icon {
      width: 24px;
      height: 24px;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .timeline-content {
      flex: 1;
      min-width: 0;
    }

    .timeline-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
      word-break: break-word;
    }

    .timeline-description {
      font-size: 11px;
      color: var(--text-secondary);
      word-break: break-word;
    }

    .timeline-time {
      font-size: 10px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 20px 10px;
      color: var(--text-secondary);
    }

    .empty-state-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .empty-state-text {
      font-size: 12px;
    }

    /* Scrollbar */
    .container::-webkit-scrollbar {
      width: 8px;
    }

    .container::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    .container::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }

    .container::-webkit-scrollbar-thumb:hover {
      background: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Summary Section -->
    <div class="section">
      <div class="section-title">📊 Summary</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${summary.commandsExecuted}</div>
          <div class="stat-label">Commands</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${summary.dependenciesInstalled}</div>
          <div class="stat-label">Installed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${summary.errorsFixed}</div>
          <div class="stat-label">Fixed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${Math.round(storageUsed)}</div>
          <div class="stat-label">MB Used</div>
        </div>
      </div>
    </div>

    <!-- Health Section -->
    <div class="section">
      <div class="section-title">🏥 Project Health</div>
      <div class="health-indicator ${health.status}">
        <div class="health-dot ${health.status}"></div>
        <div class="health-status">
          <div class="health-status-text">${this.capitalizeFirst(health.status)}</div>
          <div class="health-status-details">
            ${health.dependenciesInstalled} dependencies • ${health.unusedDependencies} unused • ${health.versionConflicts} conflicts
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline Section -->
    <div class="section">
      <div class="section-title">📅 Activity Timeline</div>
      ${recentActivities.length > 0 ? this.getTimelineHtml(recentActivities) : '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">No activities yet</div></div>'}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Get timeline HTML
   */
  private getTimelineHtml(activities: Activity[]): string {
    return `<div class="timeline">
      ${activities.map((activity) => this.getTimelineItemHtml(activity)).join('')}
    </div>`;
  }

  /**
   * Get timeline item HTML
   */
  private getTimelineItemHtml(activity: Activity): string {
    const timeString = new Date(activity.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const severityClass = this.getSeverityClass(activity.severity);
    const icon = this.getActivityIcon(activity.type);

    return `<div class="timeline-item ${severityClass}">
      <div class="timeline-icon">${icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${this.escapeHtml(activity.title)}</div>
        ${activity.description ? `<div class="timeline-description">${this.escapeHtml(activity.description)}</div>` : ''}
        <div class="timeline-time">[${timeString}]</div>
      </div>
    </div>`;
  }

  /**
   * Get activity icon
   */
  private getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      [ActivityType.CommandExecuted]: '⚡',
      [ActivityType.DependencyInstalled]: '✅',
      [ActivityType.DependencyRemoved]: '🗑️',
      [ActivityType.DependencyUpgraded]: '⬆️',
      [ActivityType.DependencyFailed]: '❌',
      [ActivityType.EnvironmentCreated]: '🔧',
      [ActivityType.EnvironmentModified]: '⚙️',
      [ActivityType.ErrorDetected]: '⚠️',
      [ActivityType.ErrorFixed]: '✔️',
      [ActivityType.IssueDetected]: '🔍',
      [ActivityType.ScanCompleted]: '📊'
    };

    return icons[type] || '•';
  }

  /**
   * Get severity CSS class
   */
  private getSeverityClass(severity: ActivitySeverity): string {
    switch (severity) {
      case ActivitySeverity.Success:
        return 'success';
      case ActivitySeverity.Error:
        return 'error';
      case ActivitySeverity.Warning:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    /* eslint-disable @typescript-eslint/naming-convention */
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
