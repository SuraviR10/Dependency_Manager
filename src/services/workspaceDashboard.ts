/**
 * Workspace Dependency Dashboard
 * Displays comprehensive project health and dependency information
 */

import { SupportedLanguage, ActivitySeverity } from '../types/types';
import { DependencyScanner, DependencyScanResult } from '../analyzer/dependencyScanner';

export interface DashboardMetrics {
  pythonVersion?: string;
  nodeVersion?: string;
  packagesInstalled: number;
  missingPackages: number;
  unusedPackages: number;
  missingEnvVars: number;
  versionConflicts: number;
  projectHealth: 'healthy' | 'warning' | 'critical';
  environmentStatus: 'configured' | 'misconfigured' | 'missing';
  securityIssues: number;
}

export interface DashboardDisplay {
  title: string;
  sections: DashboardSection[];
  overallScore: number;
  recommendations: string[];
  scanResult: DependencyScanResult;
}

export interface DashboardSection {
  name: string;
  icon: string;
  metrics: { label: string; value: string | number; status?: 'ok' | 'warning' | 'error' }[];
  issues?: string[];
}

export class WorkspaceDashboard {
  private workspacePath: string;
  private scanner: DependencyScanner;

  constructor(workspacePath: string, scanner: DependencyScanner) {
    this.workspacePath = workspacePath;
    this.scanner = scanner;
  }

  /**
   * Build comprehensive dashboard
   */
  public async buildDashboard(
    scanResult: DependencyScanResult,
    conflictCount: number = 0
  ): Promise<DashboardDisplay> {
    const metrics = await this.gatherMetrics(scanResult, conflictCount);
    const sections = this.buildSections(metrics, scanResult);
    const recommendations = this.generateRecommendations(metrics);
    const overallScore = this.calculateScore(metrics);

    return {
      title: '📊 Workspace Dependency Dashboard',
      sections,
      overallScore,
      recommendations,
      scanResult,
    };
  }

  /**
   * Gather all metrics
   */
  private async gatherMetrics(
    scanResult: DependencyScanResult,
    conflictCount: number
  ): Promise<DashboardMetrics> {
    return {
      pythonVersion: await this.getPythonVersion(),
      nodeVersion: await this.getNodeVersion(),
      packagesInstalled: scanResult.pythonPackages.size + scanResult.nodePackages.size,
      missingPackages: scanResult.missingPackages.size,
      unusedPackages: scanResult.unusedPackages.size,
      missingEnvVars: scanResult.missingEnvVars.size,
      versionConflicts: conflictCount,
      projectHealth: this.assessHealth(scanResult, conflictCount),
      environmentStatus: 'configured',
      securityIssues: 0,
    };
  }

  /**
   * Build dashboard sections
   */
  private buildSections(metrics: DashboardMetrics, scanResult: DependencyScanResult): DashboardSection[] {
    const sections: DashboardSection[] = [];

    // Environment Status Section
    sections.push({
      name: '🖥️ Environment',
      icon: '⚙️',
      metrics: [
        {
          label: 'Python Version',
          value: metrics.pythonVersion || 'Not Detected',
          status: metrics.pythonVersion ? 'ok' : 'warning',
        },
        {
          label: 'Node Version',
          value: metrics.nodeVersion || 'Not Detected',
          status: 'ok',
        },
        {
          label: 'Status',
          value: metrics.environmentStatus.toUpperCase(),
          status: metrics.environmentStatus === 'configured' ? 'ok' : 'error',
        },
      ],
    });

    // Dependency Status Section
    sections.push({
      name: '📦 Package Inventory',
      icon: '📍',
      metrics: [
        {
          label: 'Installed',
          value: metrics.packagesInstalled,
          status: 'ok',
        },
        {
          label: 'Missing',
          value: metrics.missingPackages,
          status: metrics.missingPackages > 0 ? 'error' : 'ok',
        },
        {
          label: 'Unused',
          value: metrics.unusedPackages,
          status: metrics.unusedPackages > 0 ? 'warning' : 'ok',
        },
        {
          label: 'Conflicts',
          value: metrics.versionConflicts,
          status: metrics.versionConflicts > 0 ? 'error' : 'ok',
        },
        {
          label: 'Missing Env Vars',
          value: metrics.missingEnvVars,
          status: metrics.missingEnvVars > 0 ? 'error' : 'ok',
        }
      ],
      issues: this.buildIssuesList(scanResult, metrics),
    });

    // Project Health Section
    sections.push({
      name: '💪 Health',
      icon: '❤️',
      metrics: [
        {
          label: 'Status',
          value: metrics.projectHealth.toUpperCase(),
          status: metrics.projectHealth === 'healthy' ? 'ok' : metrics.projectHealth === 'warning' ? 'warning' : 'error',
        },
        {
          label: 'Overall Score',
          value: `${this.calculateScore(metrics)}/100`,
          status: this.calculateScore(metrics) >= 80 ? 'ok' : this.calculateScore(metrics) >= 50 ? 'warning' : 'error',
        },
        {
          label: 'Security Issues',
          value: metrics.securityIssues,
          status: 'ok',
        },
      ],
    });

    return sections;
  }

  /**
   * Build issues list for dashboard
   */
  private buildIssuesList(scanResult: DependencyScanResult, metrics: DashboardMetrics): string[] {
    const issues: string[] = [];

    if (metrics.missingPackages > 0) {
      const packages = Array.from(scanResult.missingPackages).slice(0, 5);
      issues.push(`❌ Missing: ${packages.join(', ')}`);
      if (scanResult.missingPackages.size > 5) {
        issues.push(`   and ${scanResult.missingPackages.size - 5} more...`);
      }
    }

    if (metrics.unusedPackages > 0) {
      const packages = Array.from(scanResult.unusedPackages).slice(0, 5);
      issues.push(`⚠️ Unused: ${packages.join(', ')}`);
      if (scanResult.unusedPackages.size > 5) {
        issues.push(`   and ${scanResult.unusedPackages.size - 5} more...`);
      }
    }

    if (metrics.versionConflicts > 0) {
      issues.push(`🔴 ${metrics.versionConflicts} version conflict(s) detected`);
    }

    if (metrics.missingEnvVars > 0) {
      issues.push(`🔐 Missing Env Vars: ${Array.from(scanResult.missingEnvVars).join(', ')}`);
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: DashboardMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.missingPackages > 0) {
      recommendations.push(
        `[Dependency Doctor] ${metrics.missingPackages} packages are imported in your code but not installed. Install them to prevent runtime crashes.`
      );
    }

    if (metrics.unusedPackages > 0) {
      recommendations.push(
        `Remove ${metrics.unusedPackages} unused packages to reduce disk space and complexity.`
      );
    }

    if (metrics.versionConflicts > 0) {
      recommendations.push(
        `Resolve ${metrics.versionConflicts} version conflict(s) to ensure compatibility.`
      );
    }

    if (metrics.missingEnvVars > 0) {
      recommendations.push(`Configure ${metrics.missingEnvVars} missing environment variables to prevent API/Config failures.`);
    }

    if (metrics.projectHealth === 'critical') {
      recommendations.push('Your project has critical issues. Run "DART: Repair Project Environment" to get started.');
    } else if (metrics.projectHealth === 'warning') {
      recommendations.push('Consider addressing the warnings above to improve project stability.');
    } else {
      recommendations.push('✅ DART Analysis: Your project dependencies look great!');
    }

    // Add proactive recommendations
    if (metrics.packagesInstalled > 50) {
      recommendations.push('You have many dependencies. Consider using a lock file to ensure reproducible builds.');
    }

    return recommendations;
  }

  /**
   * Assess overall health
   */
  private assessHealth(
    scanResult: DependencyScanResult,
    conflictCount: number
  ): 'healthy' | 'warning' | 'critical' {
    let issueScore = 0;

    issueScore += scanResult.missingPackages.size * 10;
    issueScore += scanResult.unusedPackages.size * 3;
    issueScore += conflictCount * 15;
    issueScore += scanResult.missingEnvVars.size * 8;

    if (issueScore > 50) return 'critical';
    if (issueScore > 20) return 'warning';
    return 'healthy';
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateScore(metrics: DashboardMetrics): number {
    let score = 100;

    score -= Math.min(metrics.missingPackages * 10, 40);
    score -= Math.min(metrics.unusedPackages * 2, 20);
    score -= Math.min(metrics.versionConflicts * 15, 30);
    score -= Math.min(metrics.missingEnvVars * 8, 20);

    return Math.max(0, score);
  }

  /**
   * Get Python version (stub - should be implemented with actual detection)
   */
  private async getPythonVersion(): Promise<string | undefined> {
    try {
      const { execSync } = require('child_process');
      const version = execSync('python --version', { encoding: 'utf-8' }).trim();
      return version.replace('Python ', '');
    } catch {
      return undefined;
    }
  }

  /**
   * Get Node.js version (stub - should be implemented with actual detection)
   */
  private async getNodeVersion(): Promise<string | undefined> {
    try {
      const { execSync } = require('child_process');
      const version = execSync('node --version', { encoding: 'utf-8' }).trim();
      return version.replace('v', '');
    } catch {
      return undefined;
    }
  }

  /**
   * Generate dashboard HTML for webview
   */
  public generateHTML(dashboard: DashboardDisplay): string {
    const dartLogoSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 12L12 22L22 12L12 2Z" stroke="var(--vscode-button-background)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="4" fill="var(--vscode-button-background)"/>
      <path d="M12 8L16 4" stroke="var(--vscode-button-background)" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

    const missingPackagesList = Array.from(dashboard.scanResult.missingPackages).map(pkg => 
      `<div class="proactive-item"><span>⚠️ ${pkg}</span> <button class="action-btn">Install</button></div>`
    ).join('');

    const missingEnvVarsList = Array.from(dashboard.scanResult.missingEnvVars).map(v => 
      `<div class="proactive-item"><span>🔐 ${v}</span> <span class="badge error">Missing</span></div>`
    ).join('');

    const sectionHTML = dashboard.sections
      .map(
        section => `
      <div class="card">
        <h3>${section.name}</h3>
        <div class="metrics">
          ${section.metrics
            .map(
              m => `
            <div class="metric ${m.status || 'ok'}">
              <span class="label">${m.label}</span>
              <span class="value">${m.value}</span>
            </div>
          `
            )
            .join('')}
        </div>
        ${
          section.issues && section.issues.length > 0
            ? `
          <div class="issues">
            ${section.issues.map(i => `<p class="issue">${i}</p>`).join('')}
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --text-color: var(--vscode-editor-foreground);
      --card-bg: var(--vscode-sideBar-background);
      --border-color: var(--vscode-widget-border);
      --primary: var(--vscode-button-background);
      --primary-hover: var(--vscode-button-hoverBackground);
      --success: var(--vscode-testing-iconPassed, #3fb950);
      --warning: var(--vscode-editorWarning-foreground, #d83b01);
      --error: var(--vscode-editorError-foreground, #e81123);
    }
    
    body { 
      font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; 
      padding: 0; margin: 0; background: var(--bg-color); color: var(--text-color); 
    }
    
    .navbar {
      display: flex; align-items: center; padding: 15px 30px; 
      background: var(--card-bg); border-bottom: 1px solid var(--border-color);
    }
    .navbar h1 { margin: 0 0 0 15px; font-size: 20px; font-weight: 600; letter-spacing: 1px;}
    .navbar .tagline { margin-left: auto; font-size: 12px; opacity: 0.7; }
    
    .dashboard { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
    
    .hero {
      display: flex; justify-content: space-between; align-items: center; 
      margin-bottom: 30px; padding: 30px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(0, 120, 212, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
      border: 1px solid var(--border-color);
    }
    .hero h2 { margin: 0 0 10px 0; font-size: 28px; }
    .score-circle {
      width: 100px; height: 100px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 32px; font-weight: bold;
      border: 6px solid ${dashboard.overallScore > 80 ? 'var(--success)' : dashboard.overallScore > 50 ? 'var(--warning)' : 'var(--error)'};
    }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
    
    .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; }
    .card h3 { margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
    
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .metric { padding: 12px; border-radius: 6px; background: rgba(0,0,0,0.1); border-left: 4px solid transparent; }
    .metric.ok { border-left-color: var(--success); }
    .metric.warning { border-left-color: var(--warning); }
    .metric.error { border-left-color: var(--error); }
    .label { display: block; font-size: 11px; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px; }
    .value { display: block; font-size: 22px; font-weight: bold; }
    
    .proactive-item { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 10px; border-bottom: 1px solid var(--border-color); 
    }
    .proactive-item:last-child { border-bottom: none; }
    
    .action-btn { 
      background: var(--primary); color: white; border: none; 
      padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; 
    }
    .action-btn:hover { background: var(--primary-hover); }
    
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.error { background: rgba(232, 17, 35, 0.2); color: #ff6b6b; }
    
    .tools-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;}
    .tool-btn {
      background: var(--card-bg); border: 1px solid var(--border-color); padding: 15px;
      border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s;
    }
    .tool-btn:hover { border-color: var(--primary); transform: translateY(-2px); }
    .tool-icon { font-size: 24px; margin-bottom: 10px; display: block; }
    
    .recommendations { padding: 20px; background: rgba(0, 120, 212, 0.05); border-radius: 8px; border: 1px solid var(--border-color); }
    .recommendations h3 { margin-top: 0; }
    .recommendation { margin: 10px 0; display: flex; gap: 10px; align-items: flex-start; }
  </style>
</head>
<body>
  <div class="navbar">
    ${dartLogoSvg}
    <h1>DART</h1>
    <span class="tagline">Dependency Analysis & Resolution Toolkit</span>
  </div>

  <div class="dashboard">
    
    <div class="hero">
      <div>
        <h2>Workspace Intelligence</h2>
        <p>Continuous dependency monitoring and automated resolution.</p>
      </div>
      <div class="score">${dashboard.overallScore}/100</div>
    </div>
    
    <div class="grid">
      <!-- Proactive Dependency Doctor -->
      <div class="card" style="grid-column: span 2;">
        <h3>🏥 Dependency Doctor (Proactive Checks)</h3>
        ${missingPackagesList ? missingPackagesList : '<div class="proactive-item"><span>✅ All imported packages are properly installed.</span></div>'}
      </div>

      <!-- Environment Variables -->
      <div class="card">
        <h3>🔐 Env Variable Detector</h3>
        ${missingEnvVarsList ? missingEnvVarsList : '<div class="proactive-item"><span>✅ No missing required variables detected.</span></div>'}
      </div>
    </div>

    <div class="grid">
      ${sectionHTML}
    </div>
    
    <h3>🚀 DART Intelligence Tools</h3>
    <div class="tools-grid">
      <div class="tool-btn">
        <span class="tool-icon">📦</span>
        <strong>Clone & Run Assistant</strong>
        <div style="font-size:11px; opacity:0.7; margin-top:5px;">One-click workspace setup</div>
      </div>
      <div class="tool-btn">
        <span class="tool-icon">⚠️</span>
        <strong>Impact Analysis</strong>
        <div style="font-size:11px; opacity:0.7; margin-top:5px;">See breaking changes before uninstalling</div>
      </div>
      <div class="tool-btn">
        <span class="tool-icon">⬆️</span>
        <strong>Smart Upgrade Advisor</strong>
        <div style="font-size:11px; opacity:0.7; margin-top:5px;">Risk-aware version bumps</div>
      </div>
      <div class="tool-btn">
        <span class="tool-icon">🕸️</span>
        <strong>Knowledge Graph</strong>
        <div style="font-size:11px; opacity:0.7; margin-top:5px;">Visualize dependency trees</div>
      </div>
    </div>

    <div class="recommendations">
      <h3>💡 Automated Recommendations</h3>
      ${dashboard.recommendations.map(r => `<div class="recommendation"><span>👉</span> <span>${r}</span></div>`).join('')}
    </div>

  </div>
</body>
</html>
    `;
  }
}
