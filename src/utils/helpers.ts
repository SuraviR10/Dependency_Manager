/**
 * Utility functions and helpers for the extension
 */

import * as crypto from 'crypto';
import { SupportedLanguage } from '../types/types';

/**
 * Generate a unique ID for issues
 */
export function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Create a delay promise (useful for testing)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate if a package name is likely valid
 * Basic validation: alphanumeric, hyphens, underscores
 */
export function isValidPackageName(name: string): boolean {
  if (!name || name.length === 0) {
    return false;
  }
  
  // Allow alphanumeric, hyphens, underscores, dots
  const packageNameRegex = /^[a-zA-Z0-9_.-]+$/;
  return packageNameRegex.test(name);
}

/**
 * Extract package name from error message
 * Handles quotes, backticks, etc.
 */
export function extractPackageFromError(error: string): string | null {
  // Try various quote patterns
  const patterns = [
    /'([a-zA-Z0-9_.-]+)'/,        // Single quotes
    /"([a-zA-Z0-9_.-]+)"/,        // Double quotes
    /`([a-zA-Z0-9_.-]+)`/,        // Backticks
    /:\s*([a-zA-Z0-9_.-]+)\s*$/, // At end with colon
    /\(([a-zA-Z0-9_.-]+)\)/,      // In parentheses
  ];

  for (const pattern of patterns) {
    const match = error.match(pattern);
    if (match && match[1]) {
      const extracted = match[1];
      if (isValidPackageName(extracted)) {
        return extracted;
      }
    }
  }

  return null;
}

/**
 * Normalize package name (lowercase, handle special cases)
 */
export function normalizePackageName(name: string, language: SupportedLanguage): string {
  let normalized = name.toLowerCase().trim();

  // Handle Python-specific cases
  if (language === SupportedLanguage.Python) {
    // Replace underscores with hyphens (Python convention)
    normalized = normalized.replace(/_/g, '-');
  }

  // Handle Node.js-specific cases
  if (language === SupportedLanguage.NodeJS) {
    // Node packages can contain hyphens, already lowercase
  }

  return normalized;
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidence(
  patternMatch: boolean,
  packageValidity: boolean,
  contextMatch: boolean
): number {
  let score = 0;

  if (patternMatch) {
    score += 50;
  }

  if (packageValidity) {
    score += 30;
  }

  if (contextMatch) {
    score += 20;
  }

  return score;
}

/**
 * Sanitize user input to prevent command injection
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input.replace(/[;&|`$()\\]/g, '');
}

/**
 * Format error message for display
 */
export function formatErrorForDisplay(error: string): string {
  return error
    .trim()
    .replace(/\n+/g, '\n')
    .substring(0, 500); // Limit to 500 chars
}

/**
 * Get user-friendly language name
 */
export function getLanguageDisplayName(language: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    [SupportedLanguage.Python]: 'Python',
    [SupportedLanguage.NodeJS]: 'Node.js',
    [SupportedLanguage.Unknown]: 'Unknown',
  };
  return names[language] || 'Unknown';
}

/**
 * Get package manager for language
 */
export function getPackageManager(language: SupportedLanguage): string {
  switch (language) {
    case SupportedLanguage.Python:
      return 'pip';
    case SupportedLanguage.NodeJS:
      return 'npm';
    default:
      return 'unknown';
  }
}

/**
 * Parse environment info (OS, architecture, etc.)
 */
export function getEnvironmentInfo(): {
  platform: string;
  nodeVersion: string;
  arch: string;
} {
  return {
    platform: process.platform,
    nodeVersion: process.version,
    arch: process.arch,
  };
}
