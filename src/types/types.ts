import type * as vscode from 'vscode';

/**
 * Type definitions for Smart Dependency Assistant
 * Defines interfaces for errors, dependencies, and commands
 */

/**
 * Supported programming languages for dependency detection
 */
export enum SupportedLanguage {
  Python = 'python',
  NodeJS = 'nodejs',
  Unknown = 'unknown'
}

/**
 * Severity levels for dependency issues
 */
export enum IssueSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

/**
 * Types of dependency issues that can be detected
 */
export enum IssueType {
  MissingDependency = 'missing',
  VersionConflict = 'conflict',
  EnvironmentIssue = 'environment',
  NonDependencyIssue = 'non-dependency'
}

/**
 * Represents a detected dependency issue
 */
export interface DependencyIssue {
  id: string;
  type: IssueType;
  language: SupportedLanguage;
  packageName: string;
  originalError: string;
  explanation: string;
  severity: IssueSeverity;
  confidence: number; // 0-100
  suggestedCommand: string;
  timestamp: number;
  sourceFile?: string;
  lineNumber?: number;
}

/**
 * Result of error analysis
 */
export interface AnalysisResult {
  detected: boolean;
  issue?: DependencyIssue;
  rawError: string;
  language: SupportedLanguage;
}

export interface DependencySummary {
  languages: SupportedLanguage[];
  usedPackages: string[];
  declaredPackages: string[];
  missingPackages: string[];
  unusedPackages: string[];
  healthScore: number;
  environmentStatus: string;
  scannedFiles: number;
}

/**
 * Represents a dependency installation command
 */
export interface InstallCommand {
  language: SupportedLanguage;
  packageName: string;
  command: string;
  commandDisplay: string; // Human-readable version
  alternatives?: string[]; // Alternative installation methods
}

/**
 * UI data passed to webview
 */
export interface WebviewData {
  issue: DependencyIssue | null;
  isLoading: boolean;
  installationStatus?: 'idle' | 'installing' | 'success' | 'error';
  errorMessage?: string;
}

/**
 * Message from webview to extension
 */
export interface WebviewMessage {
  command: 'install' | 'copyCommand' | 'dismiss' | 'retry' | 'refresh' | 'repair' | 'createEnvironment' | 'cleanup';
  issueId?: string;
}

/**
 * Terminal output event
 */
export interface TerminalOutputEvent {
  text: string;
  terminal: vscode.Terminal; // VS Code Terminal object
  timestamp: number;
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number; // 0-100
  detectionMethod: 'file-extension' | 'config-file' | 'package-manager';
}

/**
 * Error pattern for regex matching
 */
export interface ErrorPattern {
  language: SupportedLanguage;
  pattern: RegExp;
  issueType: IssueType;
  packageExtractGroup?: number;
  extractor?: (match: RegExpMatchArray) => { packageName: string; message: string };
}

/**
 * Command suggestion with metadata
 */
export interface CommandSuggestion {
  language: SupportedLanguage;
  packageName: string;
  installCommand: string;
  explanation: string;
  confidence: number;
}
