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
          label: 'Node.js Version',
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
      name: '📦 Dependencies',
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

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: DashboardMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.missingPackages > 0) {
      recommendations.push(
        `Install ${metrics.missingPackages} missing packages to make your project runnable.`
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

    if (metrics.projectHealth === 'critical') {
      recommendations.push('Your project has critical issues. Run "Dependify: Run Health Check" to get started.');
    } else if (metrics.projectHealth === 'warning') {
      recommendations.push('Consider addressing the warnings above to improve project stability.');
    } else {
      recommendations.push('✅ Your project dependencies look great!');
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
    const sectionHTML = dashboard.sections
      .map(
        section => `
      <div class="section">
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; padding: 20px; }
    .dashboard { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .score { font-size: 48px; font-weight: bold; color: #0078d4; }
    .section { margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
    .metric { padding: 8px; border-radius: 4px; background: #f5f5f5; }
    .metric.ok { border-left: 4px solid #107c10; }
    .metric.warning { border-left: 4px solid #ffb900; }
    .metric.error { border-left: 4px solid #e81123; }
    .label { display: block; font-size: 12px; color: #666; }
    .value { display: block; font-size: 20px; font-weight: bold; }
    .recommendations { margin-top: 30px; padding: 15px; background: #f0f8ff; border-radius: 8px; }
    .recommendations h3 { margin-top: 0; }
    .recommendation { margin: 8px 0; padding-left: 20px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>${dashboard.title}</h1>
      <div class="score">${dashboard.overallScore}/100</div>
    </div>
    
    ${sectionHTML}
    
    <div class="recommendations">
      <h3>💡 Recommendations</h3>
      ${dashboard.recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
    </div>
  </div>
</body>
</html>
    `;
  }
}
