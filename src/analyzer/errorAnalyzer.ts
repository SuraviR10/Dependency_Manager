/**
 * Error Analyzer
 * Analyzes terminal output for dependency-related errors
 * Uses pattern matching to detect and classify errors
 */

import { SupportedLanguage, AnalysisResult, DependencyIssue, IssueType, IssueSeverity, ErrorPattern } from '../types/types';
import { extractPackageFromError, normalizePackageName, generateId, getCurrentTimestamp, formatErrorForDisplay } from '../utils/helpers';
import { LanguageDetector } from './languageDetector';
import { DependencyParser } from './dependencyParser';

export class ErrorAnalyzer {
  private errorPatterns: ErrorPattern[] = [];
  private languageDetector: LanguageDetector;
  private dependencyParser: DependencyParser;
  private lastDetectedLanguage: SupportedLanguage = SupportedLanguage.Unknown;

  constructor(workspacePath: string) {
    this.languageDetector = new LanguageDetector(workspacePath);
    this.dependencyParser = new DependencyParser(workspacePath);
    this.initializeErrorPatterns();
  }

  /**
   * Initialize error detection patterns for supported languages
   */
  private initializeErrorPatterns(): void {
    // ============ PYTHON PATTERNS ============

    // ModuleNotFoundError (Python 3.6+)
    this.errorPatterns.push({
      language: SupportedLanguage.Python,
      pattern: /ModuleNotFoundError:\s*No module named ['"`]?([a-zA-Z0-9_.-]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Module ${match[1]} is not installed`,
      }),
    });

    // ImportError (older Python)
    this.errorPatterns.push({
      language: SupportedLanguage.Python,
      pattern: /ImportError:\s*No module named ['"`]?([a-zA-Z0-9_.-]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Failed to import ${match[1]}`,
      }),
    });

    // ModuleNotFoundError with different format
    this.errorPatterns.push({
      language: SupportedLanguage.Python,
      pattern: /cannot import name ['"`]?([a-zA-Z0-9_.-]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Cannot import ${match[1]}`,
      }),
    });

    // Python version conflict
    this.errorPatterns.push({
      language: SupportedLanguage.Python,
      pattern: /(python|pip):\s*error.*version/i,
      issueType: IssueType.VersionConflict,
      extractor: (_match) => ({
        packageName: 'unknown',
        message: 'Version conflict detected',
      }),
    });

    // ============ NODE.JS PATTERNS ============

    // Cannot find module
    this.errorPatterns.push({
      language: SupportedLanguage.NodeJS,
      pattern: /Cannot find module ['"`]?([a-zA-Z0-9_.\-/@]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Module ${match[1]} is not installed`,
      }),
    });

    // MODULE_NOT_FOUND
    this.errorPatterns.push({
      language: SupportedLanguage.NodeJS,
      pattern: /MODULE_NOT_FOUND.*module ['"`]?([a-zA-Z0-9_.\-/@]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Module ${match[1]} not found`,
      }),
    });

    // ERESOLVE or npm dependency conflict
    this.errorPatterns.push({
      language: SupportedLanguage.NodeJS,
      pattern: /ERESOLVE.*unable to resolve dependency tree/i,
      issueType: IssueType.VersionConflict,
      extractor: () => ({
        packageName: 'unknown',
        message: 'Dependency conflict detected',
      }),
    });

    // npm ERR! 404 - package not found on registry
    this.errorPatterns.push({
      language: SupportedLanguage.NodeJS,
      pattern: /npm ERR! 404.*['"`]?([a-zA-Z0-9_.\-/@]+)['"`]?/i,
      issueType: IssueType.MissingDependency,
      packageExtractGroup: 1,
      extractor: (match) => ({
        packageName: match[1] || '',
        message: `Package ${match[1]} not found in registry`,
      }),
    });
  }

  /**
   * Analyze error output and detect dependency issues
   */
  public analyzeError(errorText: string): AnalysisResult {
    // Detect project language
    const detection = this.languageDetector.detectLanguage();
    this.lastDetectedLanguage = detection.language;

    const formatted = formatErrorForDisplay(errorText);

    // Determine patterns to evaluate. If we cannot infer project language from files,
    // still attempt to match error output against all supported patterns.
    const relevantPatterns = this.errorPatterns.filter((p) =>
      detection.language === SupportedLanguage.Unknown ? true : p.language === detection.language
    );

    for (const pattern of relevantPatterns) {
      const match = formatted.match(pattern.pattern);
      if (match) {
        const detectedLanguage = detection.language === SupportedLanguage.Unknown ? pattern.language : detection.language;
        return this.createIssueFromPattern(formatted, pattern, match, detectedLanguage);
      }
    }

    // No pattern matched
    return {
      detected: false,
      rawError: formatted,
      language: detection.language,
    };
  }

  /**
   * Create a DependencyIssue from matched pattern
   */
  private createIssueFromPattern(
    errorText: string,
    pattern: ErrorPattern,
    match: RegExpMatchArray,
    language: SupportedLanguage
  ): AnalysisResult {
    let packageName = '';
    let extractedInfo = { packageName: '', message: '' };

    // Extract package information
    if (pattern.extractor) {
      extractedInfo = pattern.extractor(match);
      packageName = extractedInfo.packageName;
    } else if (pattern.packageExtractGroup && match[pattern.packageExtractGroup]) {
      packageName = match[pattern.packageExtractGroup];
    }

    // Try to extract package name from error if pattern didn't provide one
    if (!packageName) {
      packageName = extractPackageFromError(errorText) || 'unknown';
    }

    // Normalize package name
    packageName = normalizePackageName(packageName, language);

    // Check if it's actually a dependency issue
    const isInstalledInProject = this.dependencyParser.isPackageInstalled(packageName, language);
    
    // Determine issue type and severity
    const issueType = pattern.issueType;
    let severity = IssueSeverity.Medium;

    if (pattern.issueType === IssueType.MissingDependency) {
      severity = IssueSeverity.High;
    } else if (pattern.issueType === IssueType.VersionConflict) {
      severity = IssueSeverity.High;
    }

    // Calculate confidence
    const confidence = this.calculateAnalysisConfidence(
      true,                          // pattern matched
      packageName !== 'unknown',     // valid package extracted
      isInstalledInProject           // package in project config
    );

    // Only report if we're reasonably confident
    if (confidence < 40) {
      return {
        detected: false,
        rawError: errorText,
        language,
      };
    }

    const issue: DependencyIssue = {
      id: generateId(),
      type: issueType,
      language,
      packageName,
      originalError: errorText,
      explanation: this.generateExplanation(packageName, issueType, language),
      severity,
      confidence,
      suggestedCommand: '', // Will be filled by command generator
      timestamp: getCurrentTimestamp(),
    };

    return {
      detected: true,
      issue,
      rawError: errorText,
      language,
    };
  }

  /**
   * Calculate confidence score for analysis
   */
  private calculateAnalysisConfidence(
    patternMatched: boolean,
    validPackage: boolean,
    packageInConfig: boolean
  ): number {
    let score = 0;

    if (patternMatched) {
      score += 40;
    }
    if (validPackage) {
      score += 35;
    }
    if (packageInConfig) {
      score += 25;
    }

    return score;
  }

  /**
   * Generate user-friendly explanation for the issue
   */
  private generateExplanation(packageName: string, issueType: IssueType, language: SupportedLanguage): string {
    const languageName = language === SupportedLanguage.Python ? 'Python' : 'Node.js';

    switch (issueType) {
      case IssueType.MissingDependency:
        return `The ${packageName} library required for this ${languageName} program is not installed. You need to install it using your package manager.`;

      case IssueType.VersionConflict:
        return `There is a version conflict with one or more dependencies. This usually happens when different packages require different versions of the same library.`;

      case IssueType.EnvironmentIssue:
        return `There may be an environment-related issue with your dependencies. Check your virtual environment or Node.js setup.`;

      case IssueType.NonDependencyIssue:
        return `This error doesn't appear to be related to missing or conflicting dependencies.`;

      default:
        return `An issue with dependencies was detected.`;
    }
  }

  /**
   * Check if error is likely a dependency issue (even if pattern didn't match perfectly)
   */
  public isProbablyDependencyRelated(errorText: string): boolean {
    const keywords = [
      'module', 'import', 'require', 'package', 'not found', 'cannot find',
      'missing', 'conflict', 'version', 'npm err', 'pip error'
    ];

    const lower = errorText.toLowerCase();
    return keywords.some(keyword => lower.includes(keyword));
  }
}
