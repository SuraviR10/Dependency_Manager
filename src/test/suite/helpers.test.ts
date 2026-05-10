/**
 * Test suite for Helpers/Utils
 */

import * as assert from 'assert';
import {
  isValidPackageName,
  extractPackageFromError,
  normalizePackageName,
  calculateConfidence,
  sanitizeInput,
  formatErrorForDisplay,
  getLanguageDisplayName,
  getPackageManager,
} from '../../utils/helpers';
import { SupportedLanguage } from '../../types/types';

suite('Helpers Tests', () => {
  test('Should validate package names', () => {
    assert.strictEqual(isValidPackageName('numpy'), true);
    assert.strictEqual(isValidPackageName('requests-2.0'), true);
    assert.strictEqual(isValidPackageName('my_package'), true);
    assert.strictEqual(isValidPackageName('package.ext'), true);
    assert.strictEqual(isValidPackageName(''), false);
    assert.strictEqual(isValidPackageName('package@2.0'), false);
    assert.strictEqual(isValidPackageName('package;rm'), false);
  });

  test('Should extract package from error messages', () => {
    const errors = [
      { error: "ModuleNotFoundError: No module named 'numpy'", expected: 'numpy' },
      { error: 'Cannot find module "express"', expected: 'express' },
      { error: 'cannot import name `requests`', expected: 'requests' },
    ];

    for (const { error, expected } of errors) {
      const result = extractPackageFromError(error);
      assert.strictEqual(result, expected);
    }
  });

  test('Should return null for invalid package extraction', () => {
    const result = extractPackageFromError('SyntaxError: unexpected token');
    assert.strictEqual(result, null);
  });

  test('Should normalize Python package names', () => {
    const result = normalizePackageName('NumPy', SupportedLanguage.Python);
    assert.strictEqual(result, 'numpy');

    const underscoreResult = normalizePackageName('PIL_Image', SupportedLanguage.Python);
    assert.strictEqual(underscoreResult, 'pil-image');
  });

  test('Should normalize Node.js package names', () => {
    const result = normalizePackageName('ExpressJS', SupportedLanguage.NodeJS);
    assert.strictEqual(result, 'expressjs');
  });

  test('Should calculate confidence score', () => {
    const score1 = calculateConfidence(true, true, true);
    assert.strictEqual(score1, 100);

    const score2 = calculateConfidence(true, false, false);
    assert.ok(score2 >= 40 && score2 <= 60);

    const score3 = calculateConfidence(false, false, false);
    assert.strictEqual(score3, 0);
  });

  test('Should sanitize user input', () => {
    const dangerous = 'test; rm -rf /';
    const result = sanitizeInput(dangerous);
    assert.strictEqual(result.includes(';'), false);
    assert.strictEqual(result.includes('&'), false);
  });

  test('Should format error for display', () => {
    const longError = 'Error message\n\n\n\nwith multiple\nlines'.repeat(100);
    const result = formatErrorForDisplay(longError);
    assert.ok(result.length <= 500);
  });

  test('Should get language display names', () => {
    assert.strictEqual(getLanguageDisplayName(SupportedLanguage.Python), 'Python');
    assert.strictEqual(getLanguageDisplayName(SupportedLanguage.NodeJS), 'Node.js');
    assert.strictEqual(getLanguageDisplayName(SupportedLanguage.Unknown), 'Unknown');
  });

  test('Should get correct package manager', () => {
    assert.strictEqual(getPackageManager(SupportedLanguage.Python), 'pip');
    assert.strictEqual(getPackageManager(SupportedLanguage.NodeJS), 'npm');
    assert.strictEqual(getPackageManager(SupportedLanguage.Unknown), 'unknown');
  });
});
