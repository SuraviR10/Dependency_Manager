/**
 * Test suite for ErrorAnalyzer
 */

import * as assert from 'assert';
import { ErrorAnalyzer } from '../../analyzer/errorAnalyzer';
import { SupportedLanguage, IssueType } from '../../types/types';

suite('ErrorAnalyzer Tests', () => {
  let analyzer: ErrorAnalyzer;

  setup(() => {
    analyzer = new ErrorAnalyzer('.');
  });

  test('Should detect Python ModuleNotFoundError', () => {
    const error = "ModuleNotFoundError: No module named 'numpy'";
    const result = analyzer.analyzeError(error);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.issue?.language, SupportedLanguage.Python);
    assert.strictEqual(result.issue?.type, IssueType.MissingDependency);
    assert.ok(result.issue?.packageName.includes('numpy'));
  });

  test('Should detect Node.js Cannot find module', () => {
    const error = "Cannot find module 'express'";
    const result = analyzer.analyzeError(error);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.issue?.language, SupportedLanguage.NodeJS);
    assert.strictEqual(result.issue?.type, IssueType.MissingDependency);
    assert.ok(result.issue?.packageName.includes('express'));
  });

  test('Should detect Python ImportError', () => {
    const error = "ImportError: No module named 'requests'";
    const result = analyzer.analyzeError(error);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.issue?.packageName.includes('requests'), true);
  });

  test('Should detect npm 404 error', () => {
    const error = "npm ERR! 404 'unknown-package' is not in the npm registry";
    const result = analyzer.analyzeError(error);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.issue?.type, IssueType.MissingDependency);
  });

  test('Should handle non-dependency errors', () => {
    const error = 'SyntaxError: Unexpected token }';
    const result = analyzer.analyzeError(error);

    assert.strictEqual(result.detected, false);
  });

  test('Should generate confidence score', () => {
    const error = "ModuleNotFoundError: No module named 'pandas'";
    const result = analyzer.analyzeError(error);

    assert.ok(result.issue);
    assert.ok(result.issue.confidence >= 0 && result.issue.confidence <= 100);
  });

  test('Should generate user-friendly explanation', () => {
    const error = "ModuleNotFoundError: No module named 'requests'";
    const result = analyzer.analyzeError(error);

    assert.ok(result.issue);
    assert.ok(result.issue.explanation.length > 0);
    assert.ok(result.issue.explanation.toLowerCase().includes('install'));
  });

  test('Should identify dependency-related keywords', () => {
    const depError = 'ModuleNotFoundError: test';
    const nonDepError = 'ValueError: test';

    assert.strictEqual(analyzer.isProbablyDependencyRelated(depError), true);
    assert.strictEqual(analyzer.isProbablyDependencyRelated(nonDepError), false);
  });
});
