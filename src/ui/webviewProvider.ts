/**
 * Webview Provider
 * Manages the webview UI panel for displaying dependency issues
 */

import * as vscode from 'vscode';
import { DependencyIssue, DependencySummary, WebviewMessage, SupportedLanguage } from '../types/types';
import { InstallCommandGenerator } from '../commands/installCommandGenerator';
import { ConflictInfo } from '../services/conflictDetector';

export class WebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private currentIssue: DependencyIssue | null = null;
  private installationStatus: 'idle' | 'installing' | 'success' | 'error' = 'idle';
  private errorMessage: string | null = null;
  private context: vscode.ExtensionContext;
  private commandGenerator: InstallCommandGenerator;
  private onPanelActionCallback: ((action: 'refresh' | 'repair' | 'createEnvironment' | 'cleanup') => void) | null = null;

  // Callbacks
  private onInstallClick: ((issue: DependencyIssue) => void) | null = null;
  private onCopyClick: ((command: string) => void) | null = null;
  private onDismiss: ((issueId: string) => void) | null = null;

  constructor(context: vscode.ExtensionContext, commandGenerator: InstallCommandGenerator) {
    this.context = context;
    this.commandGenerator = commandGenerator;
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
      localResourceRoots: [this.context.extensionUri],
    };

    // Set initial content
    webviewView.webview.html = this.getEmptyStateHtml();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.handleWebviewMessage(message);
    });

    console.log('[WebviewProvider] View resolved and ready');
  }

  /**
   * Display an issue in the webview
   */
  public displayIssue(issue: DependencyIssue): void {
    this.currentIssue = issue;
    this.installationStatus = 'idle';
    this.errorMessage = null;

    if (this.view) {
      this.view.webview.html = this.getIssueHtml(issue);

      // NOTE: Do not auto-show the view to avoid disrupting user's workflow.
      // Users can click the Dependify panel button to view issues.
      // this.view.show?.(true);
    }

    console.log(`[WebviewProvider] Displaying issue: ${issue.packageName}`);
  }

  /**
   * Update installation status
   */
  public updateInstallationStatus(
    status: 'idle' | 'installing' | 'success' | 'error',
    errorMsg?: string
  ): void {
    this.installationStatus = status;
    this.errorMessage = errorMsg || null;

    if (this.view && this.currentIssue) {
      this.updateStatusDisplay();
    }

    console.log(`[WebviewProvider] Installation status: ${status}`);
  }

  /**
   * Update status display in webview
   */
  private updateStatusDisplay(): void {
    if (!this.view || !this.currentIssue) {
      return;
    }

    const statusHtml = this.getStatusIndicatorHtml();
    this.view.webview.postMessage({
      command: 'updateStatus',
      status: this.installationStatus,
      html: statusHtml,
    });
  }

  /**
   * Handle messages from webview
   */
  private handleWebviewMessage(message: WebviewMessage): void {
    switch (message.command) {
      case 'install':
        if (this.currentIssue && this.onInstallClick) {
          this.onInstallClick(this.currentIssue);
        }
        break;

      case 'copyCommand':
        if (this.currentIssue) {
          const command = this.commandGenerator.generateCommand(this.currentIssue);
          if (this.onCopyClick) {
            this.onCopyClick(command.command);
          }
        }
        break;

      case 'dismiss':
        if (this.currentIssue && this.onDismiss) {
          this.onDismiss(this.currentIssue.id);
          this.clearDisplay();
        }
        break;

      case 'refresh':
      case 'repair':
      case 'createEnvironment':
      case 'cleanup':
        if (this.onPanelActionCallback) {
          this.onPanelActionCallback(message.command);
        }
        break;

      case 'retry':
        this.installationStatus = 'idle';
        if (this.view && this.currentIssue) {
          this.displayIssue(this.currentIssue);
        }
        break;
    }
  }

  /**
   * Clear the display
   */
  private clearDisplay(): void {
    this.currentIssue = null;
    this.installationStatus = 'idle';
    this.errorMessage = null;

    if (this.view) {
      this.view.webview.html = this.getEmptyStateHtml();
    }
  }

  /**
   * Register install callback
   */
  public onInstall(callback: (issue: DependencyIssue) => void): void {
    this.onInstallClick = callback;
  }

  /**
   * Register copy command callback
   */
  public onCopy(callback: (command: string) => void): void {
    this.onCopyClick = callback;
  }

  /**
   * Register dismiss callback
   */
  public onDismissIssue(callback: (issueId: string) => void): void {
    this.onDismiss = callback;
  }

  /**
   * Register panel action callback
   */
  public onPanelAction(callback: (action: 'refresh' | 'repair' | 'createEnvironment' | 'cleanup') => void): void {
    this.onPanelActionCallback = callback;
  }

  /**
   * Display summary dashboard in the webview
   */
  public displayDashboard(summary: DependencySummary, conflicts: ConflictInfo[] = []): void {
    this.currentIssue = null;
    this.installationStatus = 'idle';
    this.errorMessage = null;
    if (this.view) {
      this.view.webview.html = this.getDashboardHtml(summary, conflicts);
      this.view.show?.(true);
    }
  }

  private getDashboardHtml(summary: DependencySummary, conflicts: ConflictInfo[] = []): string {
    const nonce = this.getNonce();
    const languageList = summary.languages.map(l => this.getLanguageDisplayName(l)).join(', ') || 'Unknown';
    const score = summary.healthScore;
    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const scoreLabel = score >= 80 ? 'Healthy' : score >= 50 ? 'Warning' : 'Critical';

    const missingHtml = summary.missingPackages.length > 0
      ? summary.missingPackages.map(p => `<span class="pkg-tag missing">${this.escapeHtml(p)}</span>`).join(' ')
      : '<span class="none-text">None detected ✓</span>';

    const unusedHtml = summary.unusedPackages.length > 0
      ? summary.unusedPackages.map(p => `<span class="pkg-tag unused">${this.escapeHtml(p)}</span>`).join(' ')
      : '<span class="none-text">None detected ✓</span>';

    const conflictsHtml = conflicts.length > 0
      ? conflicts.map(c => `
          <div class="conflict-item">
            <div class="conflict-title">⚠️ ${this.escapeHtml(c.package)} conflicts with ${this.escapeHtml(c.affectedDependency)}</div>
            <div class="conflict-detail">${this.escapeHtml(c.message)}</div>
            <div class="conflict-fix">💡 ${this.escapeHtml(c.recommendedFix)}</div>
          </div>`).join('')
      : '<span class="none-text">No conflicts detected ✓</span>';

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'">
        <style nonce="${nonce}">
          ${this.getRawStyles()}
          .health-ring { display:flex; align-items:center; gap:16px; margin-bottom:12px; }
          .ring-score { font-size:36px; font-weight:700; color:${scoreColor}; }
          .ring-label { font-size:13px; color:${scoreColor}; font-weight:600; }
          .ring-sub { font-size:11px; color:var(--vscode-descriptionForeground); }
          .pkg-tag { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; margin:2px; }
          .pkg-tag.missing { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
          .pkg-tag.unused { background:#f59e0b22; color:#f59e0b; border:1px solid #f59e0b44; }
          .none-text { font-size:12px; color:var(--vscode-descriptionForeground); }
          .conflict-item { padding:8px; background:var(--vscode-editor-background); border-radius:4px; margin-bottom:8px; border-left:3px solid #f59e0b; }
          .conflict-title { font-size:12px; font-weight:600; margin-bottom:4px; }
          .conflict-detail { font-size:11px; color:var(--vscode-descriptionForeground); margin-bottom:4px; }
          .conflict-fix { font-size:11px; color:#10b981; }
          .summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
          .summary-stat { background:var(--vscode-editor-background); border-radius:4px; padding:8px; text-align:center; }
          .summary-stat-num { font-size:18px; font-weight:700; }
          .summary-stat-label { font-size:10px; color:var(--vscode-descriptionForeground); }
          .dashboard-header { margin-bottom:16px; }
          .dashboard-header h2 { font-size:16px; margin-bottom:4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="dashboard-header">
            <h2>📊 Project Health Dashboard</h2>
            <p class="secondary-text">Scanned ${summary.scannedFiles} file(s) · ${languageList}</p>
          </div>

          <div class="card">
            <div class="health-ring">
              <div>
                <div class="ring-score">${score}</div>
                <div class="ring-sub">out of 100</div>
              </div>
              <div>
                <div class="ring-label">${scoreLabel}</div>
                <div class="ring-sub">${summary.environmentStatus}</div>
              </div>
            </div>
            <div class="summary-grid">
              <div class="summary-stat"><div class="summary-stat-num">${summary.declaredPackages.length}</div><div class="summary-stat-label">Declared</div></div>
              <div class="summary-stat"><div class="summary-stat-num">${summary.usedPackages.length}</div><div class="summary-stat-label">Used</div></div>
              <div class="summary-stat" style="color:${summary.missingPackages.length > 0 ? '#ef4444' : 'inherit'}"><div class="summary-stat-num">${summary.missingPackages.length}</div><div class="summary-stat-label">Missing</div></div>
              <div class="summary-stat" style="color:${summary.unusedPackages.length > 0 ? '#f59e0b' : 'inherit'}"><div class="summary-stat-num">${summary.unusedPackages.length}</div><div class="summary-stat-label">Unused</div></div>
            </div>
          </div>

          <div class="card"><h3>📦 Missing Packages</h3><div>${missingHtml}</div></div>
          <div class="card"><h3>🗑 Unused Packages</h3><div>${unusedHtml}</div></div>
          <div class="card"><h3>⚠️ Conflicts (${conflicts.length})</h3><div>${conflictsHtml}</div></div>

          <div class="actions">
            <button id="btn-refresh" class="btn btn-primary">🔄 Refresh</button>
            <button id="btn-create-env" class="btn btn-secondary">⚙️ Create Env</button>
          </div>
          <div class="actions">
            <button id="btn-cleanup" class="btn btn-secondary">🧹 Cleanup</button>
            <button id="btn-repair" class="btn btn-secondary">🛠️ Repair</button>
          </div>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          document.getElementById('btn-refresh').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
          document.getElementById('btn-create-env').addEventListener('click', () => vscode.postMessage({ command: 'createEnvironment' }));
          document.getElementById('btn-cleanup').addEventListener('click', () => vscode.postMessage({ command: 'cleanup' }));
          document.getElementById('btn-repair').addEventListener('click', () => vscode.postMessage({ command: 'repair' }));
        </script>
      </body>
      </html>`;
  }

  private getEmptyStateHtml(): string {
    const nonce = this.getNonce();
    const iconUri = this.view ? this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.png')) : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'">
        <style nonce="${nonce}">${this.getRawStyles()}</style>
      </head>
      <body>
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <img src="${iconUri}" alt="Dependify Logo" style="width: 100px; height: 100px; margin-bottom: 20px; border-radius: 20%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <h2>Smart Dependency Assistant</h2>
          <p>Run your code and this panel will show detected dependency issues.</p>
          <p class="secondary-text">Currently monitoring terminal output for errors...</p>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>
    `;
  }

  private getIssueHtml(issue: DependencyIssue): string {
    const nonce = this.getNonce();
    const command = this.commandGenerator.generateCommand(issue);
    const statusHtml = this.getStatusIndicatorHtml();
    const confidenceBar = this.getConfidenceBarHtml(issue.confidence);

    const severityColor = {
      critical: '#f48771',
      high: '#ff7043',
      medium: '#ffb74d',
      low: '#81c784',
    }[issue.severity];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'">
        <style nonce="${nonce}">${this.getRawStyles()}</style>
      </head>
      <body>
        <div class="container">
          <!-- Issue Header -->
          <div class="issue-header" style="border-left-color: ${severityColor}">
            <div class="header-top">
              <div class="package-name">
                <span class="severity-badge" style="background-color: ${severityColor}">
                  ${issue.severity.toUpperCase()}
                </span>
                <h2>${issue.packageName}</h2>
              </div>
              <button id="btn-dismiss" class="dismiss-btn" title="Dismiss">✕</button>
            </div>
            <p class="issue-type">${this.getIssueTypeLabel(issue.type)}</p>
          </div>

          <!-- Explanation -->
          <div class="card">
            <h3>What's Wrong?</h3>
            <p class="explanation">${this.escapeHtml(issue.explanation)}</p>
          </div>

          <!-- Original Error -->
          <div class="card">
            <h3>Error Details</h3>
            <code class="error-text">${this.escapeHtml(issue.originalError.substring(0, 300))}</code>
          </div>

          <!-- Suggested Command -->
          <div class="card command-card">
            <h3>Installation Command</h3>
            <div class="command-display">
              <code id="commandText">${this.escapeHtml(command.commandDisplay)}</code>
              <button id="btn-copy-top" class="copy-btn" title="Copy to clipboard">📋 Copy</button>
            </div>
          </div>

          <!-- Confidence Indicator -->
          <div class="card">
            <h3>Detection Confidence</h3>
            ${confidenceBar}
            <p class="confidence-text">${issue.confidence}% confident this is a dependency issue</p>
          </div>

          <!-- Status Indicator -->
          <div id="statusIndicator" class="card">
            ${statusHtml}
          </div>

          <!-- Action Buttons -->
          <div class="actions">
            <button id="btn-install" class="btn btn-primary">
              <span>⚙️</span>
              <span>Install Package</span>
            </button>
            <button id="btn-copy-bottom" class="btn btn-secondary">
              <span>📋</span>
              <span>Copy Command</span>
            </button>
          </div>

          <!-- Language Info -->
          <div class="card language-info">
            <p class="secondary-text">
              Language: <strong>${this.getLanguageDisplayName(issue.language)}</strong> •
              Time: <strong>${new Date(issue.timestamp).toLocaleTimeString()}</strong>
            </p>
          </div>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();

          document.body.addEventListener('click', event => {
            const target = event.target;
            if (target.closest('#btn-install')) {
              const btn = target.closest('#btn-install');
              btn.disabled = true;
              btn.innerHTML = '<span>⏳</span><span>Installing...</span>';
              vscode.postMessage({ command: 'install' });
            } else if (target.closest('#btn-copy-top') || target.closest('#btn-copy-bottom')) {
              const cmdText = document.getElementById('commandText').textContent;
              vscode.postMessage({ command: 'copyCommand', text: cmdText });
            } else if (target.closest('#btn-dismiss')) {
              vscode.postMessage({ command: 'dismiss' });
            } else if (target.closest('.retry-btn')) {
              vscode.postMessage({ command: 'retry' });
            }
          });

          // Listen for messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStatus') {
              document.getElementById('statusIndicator').innerHTML = message.html;
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Get status indicator HTML
   */
  private getStatusIndicatorHtml(): string {
    switch (this.installationStatus) {
      case 'installing':
        return `
          <div class="status installing">
            <span class="spinner"></span>
            <span>Installing... Please wait</span>
          </div>
        `;

      case 'success':
        return `
          <div class="status success">
            <span class="status-icon">✓</span>
            <span>Package installed successfully!</span>
          </div>
        `;

      case 'error':
        return `
          <div class="status error">
            <span class="status-icon">✗</span>
            <span>Installation failed: ${this.escapeHtml(this.errorMessage || 'Unknown error')}</span>
            <button class="retry-btn">Retry</button>
          </div>
        `;

      default:
        return `
          <div class="status idle">
            <span class="status-icon">ℹ️</span>
            <span>Ready to install</span>
          </div>
        `;
    }
  }

  /**
   * Get confidence bar HTML
   */
  private getConfidenceBarHtml(confidence: number): string {
    const percentage = Math.min(100, Math.max(0, confidence));
    const color = percentage >= 80 ? '#4caf50' : percentage >= 60 ? '#ff9800' : '#f44336';

    return `
      <div class="confidence-bar-container">
        <div class="confidence-bar" style="width: ${percentage}%; background-color: ${color}"></div>
      </div>
    `;
  }

  private getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  }

  private getRawStyles(): string {
    return `
        :root {
          /* Professional Dark Blue Palette */
          --dartx-bg: #090c10;
          --dartx-card-bg: #161b22;
          --dartx-border: #30363d;
          --dartx-accent-blue: #58a6ff;
          --dartx-accent-hover: #1f6feb;
          --dartx-text-main: #c9d1d9;
          --dartx-text-muted: #8b949e;
          --dartx-success: #238636;
          --dartx-warning: #d29922;
          --dartx-error: #f85149;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--dartx-text-main);
          background-color: var(--dartx-bg);
          padding: 16px;
          line-height: 1.5;
        }

        .container {
          max-width: 500px;
          margin: 0 auto;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h2 {
          color: var(--vscode-foreground);
          color: var(--dartx-text-main);
          margin-bottom: 12px;
        }

        .issue-header {
          border-left: 4px solid;
          padding: 16px;
          background: var(--dartx-card-bg);
          border-radius: 8px;
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
          border: 1px solid var(--dartx-border);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .package-name {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .package-name h2 {
          margin: 0;
          font-size: 24px;
          color: var(--vscode-foreground);
          color: var(--dartx-text-main);
        }

        .severity-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: bold;
          color: white;
        }

        .dismiss-btn {
          background: none;
          border: none;
          color: var(--vscode-descriptionForeground);
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
        }

        .dismiss-btn:hover {
          background-color: var(--vscode-editor-hoverHighlightBackground);
          color: var(--vscode-foreground);
        }

        .issue-type {
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
          margin-top: 8px;
        }

        .card {
          background-color: var(--vscode-editor-lineHighlightBackground);
          background-color: var(--dartx-card-bg);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid var(--vscode-editor-lineHighlightBorder);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          margin-bottom: 16px;
          border: 1px solid var(--dartx-border);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
          transition: border-color 0.2s ease;
        }

        .card:hover {
          border-color: #484f58;
        }

        .card h3 {
          font-size: 14px;
          color: var(--vscode-foreground);
          color: var(--dartx-accent-blue);
          margin-bottom: 8px;
          font-weight: 600;
        }

        .explanation {
          font-size: 13px;
          line-height: 1.5;
          color: var(--vscode-foreground);
          color: var(--dartx-text-main);
        }

        .error-text {
          display: block;
          background-color: var(--vscode-editor-background);
          background-color: #0d1117;
          padding: 8px;
          border-radius: 3px;
          font-size: 11px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--vscode-terminal-ansiRed);
          color: var(--dartx-error);
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          border: 1px solid var(--dartx-border);
        }

        .command-card {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          border-left: 3px solid var(--dartx-accent-blue);
        }

        .command-display {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .command-display code {
          flex: 1;
          background-color: var(--vscode-editor-background);
          background-color: #0d1117;
          padding: 8px 12px;
          border-radius: 3px;
          font-size: 12px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          color: var(--vscode-terminal-ansiGreen);
          color: var(--dartx-success);
          white-space: nowrap;
          overflow-x: auto;
          border: 1px solid var(--dartx-border);
        }

        .copy-btn {
          padding: 8px 12px;
          background-color: var(--vscode-button-secondaryBackground);
          border: 1px solid var(--vscode-button-secondaryBorder);
          color: var(--vscode-button-secondaryForeground);
          border-radius: 3px;
          background-color: transparent;
          border: 1px solid var(--dartx-border);
          color: var(--dartx-text-main);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
          border-color: var(--dartx-text-muted);
          background-color: rgba(255, 255, 255, 0.05);
        }

        .confidence-bar-container {
          width: 100%;
          height: 6px;
          background-color: var(--vscode-editor-background);
          background-color: var(--dartx-border);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .confidence-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .confidence-text {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          color: var(--dartx-text-muted);
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 3px;
          font-size: 13px;
        }

        .status.idle {
          background-color: var(--vscode-editor-background);
          color: var(--vscode-descriptionForeground);
          background-color: #0d1117;
          color: var(--dartx-text-muted);
          border: 1px solid var(--dartx-border);
        }

        .status.installing {
          background-color: var(--vscode-statusBar-warningBackground);
          color: var(--vscode-statusBar-warningForeground);
          background-color: rgba(210, 153, 34, 0.1);
          color: var(--dartx-warning);
        }

        .status.success {
          background-color: var(--vscode-testing-iconPassed);
          color: white;
          background-color: rgba(35, 134, 54, 0.1);
          color: var(--dartx-success);
        }

        .status.error {
          background-color: var(--vscode-statusBar-errorBackground);
          color: var(--vscode-statusBar-errorForeground);
          background-color: rgba(248, 81, 73, 0.1);
          color: var(--dartx-error);
          gap: 12px;
        }

        .status-icon {
          font-size: 16px;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .retry-btn {
          padding: 4px 8px;
          background-color: rgba(255, 255, 255, 0.2);
          border: 1px solid currentColor;
          color: inherit;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
          margin-left: auto;
        }

        .retry-btn:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }

        .actions {
          display: flex;
          gap: 8px;
          margin: 16px 0;
        }

        .btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
          background-color: var(--dartx-accent-hover);
        }

        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          background-color: var(--dartx-accent-blue);
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--vscode-button-hoverBackground);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: 1px solid var(--vscode-button-secondaryBorder);
          background-color: transparent;
          color: var(--dartx-text-main);
          border: 1px solid var(--dartx-border);
        }

        .btn-secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
          border-color: var(--dartx-text-muted);
          background-color: rgba(255, 255, 255, 0.05);
        }

        .language-info {
          text-align: center;
          background-color: transparent;
          border: none;
          padding: 8px 0;
        }

        .secondary-text {
          color: var(--vscode-descriptionForeground);
          color: var(--dartx-text-muted);
          font-size: 12px;
        }

        code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        @media (prefers-color-scheme: light) {
          .card {
            background-color: #f3f3f3;
            border-color: #e0e0e0;
          }
        }
    `;
  }

  /** @deprecated - kept for reference only, use getRawStyles() */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getStyles(): string { return this.getRawStyles(); }

  /**
   * Get issue type label
   */
  private getIssueTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      missing: '📦 Missing Dependency',
      conflict: '⚠️ Version Conflict',
      environment: '🔧 Environment Issue',
    };
    if (type === 'non-dependency') {
      return 'ℹ️ Not Dependency Related';
    }
    return labels[type] || type;
  }

  /**
   * Get language display name
   */
  private getLanguageDisplayName(language: SupportedLanguage): string {
    return language === SupportedLanguage.Python ? 'Python' : 'Node.js';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return match;
      }
    });
  }
}
