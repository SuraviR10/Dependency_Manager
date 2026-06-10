/**
 * Activity Panel Provider
 * Manages the sidebar webview for displaying activity timeline and project health.
 * Uses postMessage for incremental updates to avoid full HTML re-renders (no flicker).
 */

import * as vscode from 'vscode';
import { ActivityTracker } from '../services/activityTracker';
import { Activity, ActivitySeverity, ActivityType } from '../types/types';

export class ActivityPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activityTracker: ActivityTracker;
  private context: vscode.ExtensionContext;
  private disposeListener?: () => void;

  constructor(context: vscode.ExtensionContext, activityTracker: ActivityTracker) {
    this.context = context;
    this.activityTracker = activityTracker;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      this.handleWebviewMessage(message);
    });

    // Register activity listener and store disposer
    this.disposeListener = this.activityTracker.onActivityAdded((activity) => {
      this.pushActivityUpdate(activity);
    });

    // Clean up listener when view is disposed
    webviewView.onDidDispose(() => {
      if (this.disposeListener) {
        this.disposeListener();
        this.disposeListener = undefined;
      }
    });
  }

  /**
   * Push a single new activity to the webview without re-rendering everything.
   */
  private pushActivityUpdate(activity: Activity): void {
    if (!this.view) {
      return;
    }
    const health = this.activityTracker.getProjectHealth();
    const summary = this.activityTracker.getActivitySummary();
    void this.view.webview.postMessage({
      command: 'addActivity',
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description ?? '',
        timestamp: activity.timestamp,
        severity: activity.severity,
        type: activity.type,
      },
      summary: {
        commandsExecuted: summary.commandsExecuted,
        dependenciesInstalled: summary.dependenciesInstalled,
        errorsFixed: summary.errorsFixed,
        storageUsed: Math.round(this.activityTracker.getStorageUsed()),
      },
      health: {
        status: health.status,
        dependenciesInstalled: health.dependenciesInstalled,
        unusedDependencies: health.unusedDependencies,
        versionConflicts: health.versionConflicts,
      },
    });
  }

  private handleWebviewMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      return;
    }
    const msg = message as Record<string, unknown>;
    if (msg['command'] === 'clearActivities') {
      this.activityTracker.clearActivities();
      if (this.view) {
        this.view.webview.html = this.getHtml();
      }
    }
  }

  private getHtml(): string {
    const recentActivities = this.activityTracker.getRecentActivities(20);
    const summary = this.activityTracker.getActivitySummary();
    const health = this.activityTracker.getProjectHealth();
    const storageUsed = Math.round(this.activityTracker.getStorageUsed());
    const nonce = this.getNonce();

    const timelineHtml = recentActivities.length > 0
      ? recentActivities.map(a => this.getTimelineItemHtml(a)).join('')
      : '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">No activities yet</div></div>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'">
  <title>Dependency Activity</title>
  <style nonce="${nonce}">
    :root {
      --success-color: var(--vscode-testing-iconPassed, #10b981);
      --warning-color: var(--vscode-editorWarning-foreground, #f59e0b);
      --error-color: var(--vscode-editorError-foreground, #ef4444);
      --info-color: var(--vscode-textLink-foreground, #3b82f6);
      --bg-secondary: var(--vscode-editor-lineHighlightBackground, #2d2d2d);
      --text-primary: var(--vscode-foreground, #e0e0e0);
      --text-secondary: var(--vscode-descriptionForeground, #a0a0a0);
      --border-color: var(--vscode-editor-lineHighlightBorder, #404040);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--vscode-editor-background);
      color: var(--text-primary);
      font-size: 12px;
      line-height: 1.5;
    }
    .container { padding: 12px; overflow-y: auto; }
    .section { margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
    .section:last-child { border-bottom: none; }
    .section-title {
      font-weight: 600; font-size: 11px; text-transform: uppercase;
      color: var(--text-secondary); margin-bottom: 8px; letter-spacing: 0.5px;
    }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .stat-card {
      background-color: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 4px; padding: 10px; text-align: center;
    }
    .stat-number { font-size: 16px; font-weight: bold; color: var(--info-color); }
    .stat-label { font-size: 10px; color: var(--text-secondary); margin-top: 4px; }
    .health-indicator {
      display: flex; align-items: center; gap: 8px; padding: 10px;
      background-color: var(--bg-secondary); border-radius: 4px;
      border-left: 4px solid var(--success-color);
    }
    .health-indicator.warning { border-left-color: var(--warning-color); }
    .health-indicator.critical { border-left-color: var(--error-color); }
    .health-status { flex: 1; }
    .health-status-text { font-weight: 600; font-size: 13px; }
    .health-status-details { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .health-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background-color: var(--success-color); animation: pulse 2s infinite;
    }
    .health-dot.warning { background-color: var(--warning-color); }
    .health-dot.critical { background-color: var(--error-color); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .timeline-item {
      display: flex; gap: 10px; margin-bottom: 8px; padding: 8px;
      background-color: var(--bg-secondary); border-radius: 4px;
      border-left: 3px solid var(--border-color);
    }
    .timeline-item.success { border-left-color: var(--success-color); }
    .timeline-item.error { border-left-color: var(--error-color); }
    .timeline-item.warning { border-left-color: var(--warning-color); }
    .timeline-item.info { border-left-color: var(--info-color); }
    .timeline-icon { width: 22px; min-width: 22px; display: flex; align-items: center; justify-content: center; font-size: 13px; }
    .timeline-content { flex: 1; min-width: 0; }
    .timeline-title { font-weight: 600; font-size: 12px; margin-bottom: 2px; word-break: break-word; }
    .timeline-description { font-size: 11px; color: var(--text-secondary); word-break: break-word; }
    .timeline-time { font-size: 10px; color: var(--text-secondary); margin-top: 3px; }
    .empty-state { text-align: center; padding: 20px 10px; color: var(--text-secondary); }
    .empty-state-icon { font-size: 24px; margin-bottom: 8px; }
    .empty-state-text { font-size: 12px; }
    .clear-btn {
      width: 100%; padding: 6px; margin-top: 8px; font-size: 11px;
      background: none; border: 1px solid var(--border-color);
      color: var(--text-secondary); border-radius: 3px; cursor: pointer;
    }
    .clear-btn:hover { border-color: var(--error-color); color: var(--error-color); }
  </style>
</head>
<body>
  <div class="container">
    <div class="section">
      <div class="section-title">📊 Summary</div>
      <div class="stats-grid" id="statsGrid">
        <div class="stat-card"><div class="stat-number" id="statCommands">${summary.commandsExecuted}</div><div class="stat-label">Commands</div></div>
        <div class="stat-card"><div class="stat-number" id="statInstalled">${summary.dependenciesInstalled}</div><div class="stat-label">Installed</div></div>
        <div class="stat-card"><div class="stat-number" id="statFixed">${summary.errorsFixed}</div><div class="stat-label">Fixed</div></div>
        <div class="stat-card"><div class="stat-number" id="statStorage">${storageUsed}</div><div class="stat-label">MB Used</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🏥 Project Health</div>
      <div class="health-indicator ${health.status}" id="healthIndicator">
        <div class="health-dot ${health.status}" id="healthDot"></div>
        <div class="health-status">
          <div class="health-status-text" id="healthStatusText">${this.capitalizeFirst(health.status)}</div>
          <div class="health-status-details" id="healthDetails">
            ${health.dependenciesInstalled} dependencies · ${health.unusedDependencies} unused · ${health.versionConflicts} conflicts
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📅 Activity Timeline</div>
      <div id="timeline">${timelineHtml}</div>
      <button class="clear-btn" onclick="clearActivities()">🗑 Clear History</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const ICONS = {
      'command': '⚡', 'dependency-installed': '✅', 'dependency-removed': '🗑️',
      'dependency-upgraded': '⬆️', 'dependency-failed': '❌', 'environment-created': '🔧',
      'environment-modified': '⚙️', 'error-detected': '⚠️', 'error-fixed': '✔️',
      'issue-detected': '🔍', 'scan-completed': '📊'
    };

    function severityClass(severity) {
      if (severity === 'success') return 'success';
      if (severity === 'error') return 'error';
      if (severity === 'warning') return 'warning';
      return 'info';
    }

    function buildTimelineItem(a) {
      const time = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const icon = ICONS[a.type] || '•';
      const cls = severityClass(a.severity);
      const desc = a.description ? '<div class="timeline-description">' + escapeHtml(a.description) + '</div>' : '';
      return '<div class="timeline-item ' + cls + '" id="act-' + escapeHtml(a.id) + '">'
        + '<div class="timeline-icon">' + icon + '</div>'
        + '<div class="timeline-content">'
        + '<div class="timeline-title">' + escapeHtml(a.title) + '</div>'
        + desc
        + '<div class="timeline-time">[' + time + ']</div>'
        + '</div></div>';
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'addActivity') {
        // Update stats
        document.getElementById('statCommands').textContent = msg.summary.commandsExecuted;
        document.getElementById('statInstalled').textContent = msg.summary.dependenciesInstalled;
        document.getElementById('statFixed').textContent = msg.summary.errorsFixed;
        document.getElementById('statStorage').textContent = msg.summary.storageUsed;

        // Update health
        const hi = document.getElementById('healthIndicator');
        const hd = document.getElementById('healthDot');
        hi.className = 'health-indicator ' + msg.health.status;
        hd.className = 'health-dot ' + msg.health.status;
        document.getElementById('healthStatusText').textContent =
          msg.health.status.charAt(0).toUpperCase() + msg.health.status.slice(1);
        document.getElementById('healthDetails').textContent =
          msg.health.dependenciesInstalled + ' dependencies · ' +
          msg.health.unusedDependencies + ' unused · ' +
          msg.health.versionConflicts + ' conflicts';

        // Prepend new activity item
        const timeline = document.getElementById('timeline');
        const emptyState = timeline.querySelector('.empty-state');
        if (emptyState) { timeline.innerHTML = ''; }
        const div = document.createElement('div');
        div.innerHTML = buildTimelineItem(msg.activity);
        timeline.insertBefore(div.firstChild, timeline.firstChild);

        // Keep max 20 items visible
        const items = timeline.querySelectorAll('.timeline-item');
        if (items.length > 20) {
          items[items.length - 1].remove();
        }
      }
    });

    function clearActivities() {
      vscode.postMessage({ command: 'clearActivities' });
    }
  </script>
</body>
</html>`;
  }

  private getTimelineItemHtml(activity: Activity): string {
    const timeString = new Date(activity.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const severityClass = this.getSeverityClass(activity.severity);
    const icon = this.getActivityIcon(activity.type);
    const desc = activity.description
      ? `<div class="timeline-description">${this.escapeHtml(activity.description)}</div>`
      : '';

    return `<div class="timeline-item ${severityClass}" id="act-${activity.id}">
      <div class="timeline-icon">${icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${this.escapeHtml(activity.title)}</div>
        ${desc}
        <div class="timeline-time">[${timeString}]</div>
      </div>
    </div>`;
  }

  private getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      [ActivityType.CommandExecuted]: '⚡',
      [ActivityType.DependencyInstalled]: '✅',
      [ActivityType.DependencyRemoved]: '🗑️',
      [ActivityType.DependencyUpgraded]: '⬆️',
      [ActivityType.DependencyFailed]: '❌',
      [ActivityType.EnvironmentCreated]: '🔧',
      [ActivityType.EnvironmentModified]: '⚙️',
      [ActivityType.EnvironmentChecked]: '🔍',
      [ActivityType.EnvironmentExported]: '📸',
      [ActivityType.ErrorDetected]: '⚠️',
      [ActivityType.ErrorFixed]: '✔️',
      [ActivityType.IssueDetected]: '🔍',
      [ActivityType.ScanCompleted]: '📊',
      [ActivityType.ProjectSetup]: '🚀',
      [ActivityType.DependenciesSynced]: '🔄',
      [ActivityType.DashboardViewed]: '📊',
    };
    return icons[type] || '•';
  }

  private getSeverityClass(severity: ActivitySeverity): string {
    switch (severity) {
      case ActivitySeverity.Success: return 'success';
      case ActivitySeverity.Error: return 'error';
      case ActivitySeverity.Warning: return 'warning';
      default: return 'info';
    }
  }

  private escapeHtml(text: string): string {
    /* eslint-disable @typescript-eslint/naming-convention */
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
  }

  private getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
