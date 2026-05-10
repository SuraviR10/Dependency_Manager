/**
 * Test suite for LanguageDetector
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LanguageDetector } from '../../analyzer/languageDetector';
import { SupportedLanguage } from '../../types/types';

suite('LanguageDetector Tests', () => {
  let tempDir: string;
  let detector: LanguageDetector;

  setup(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detector-test-'));
    detector = new LanguageDetector(tempDir);
  });

  teardown(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('Should detect Node.js project from package.json', () => {
    const packageJson = path.join(tempDir, 'package.json');
    fs.writeFileSync(packageJson, '{"name": "test"}');

    const result = detector.detectLanguage();

    assert.strictEqual(result.language, SupportedLanguage.NodeJS);
    assert.ok(result.confidence >= 90);
  });

  test('Should detect Python project from requirements.txt', () => {
    const reqPath = path.join(tempDir, 'requirements.txt');
    fs.writeFileSync(reqPath, 'numpy==1.21.0\nrequests>=2.25.0\n');

    detector.clearCache();
    const result = detector.detectLanguage();

    assert.strictEqual(result.language, SupportedLanguage.Python);
    assert.ok(result.confidence >= 90);
  });

  test('Should detect Python project from setup.py', () => {
    const setupPath = path.join(tempDir, 'setup.py');
    fs.writeFileSync(setupPath, 'from setuptools import setup\n');

    detector.clearCache();
    const result = detector.detectLanguage();

    assert.strictEqual(result.language, SupportedLanguage.Python);
    assert.ok(result.confidence >= 85);
  });

  test('Should detect Python project from pyproject.toml', () => {
    const pyprojectPath = path.join(tempDir, 'pyproject.toml');
    fs.writeFileSync(pyprojectPath, '[tool.poetry]\n');

    detector.clearCache();
    const result = detector.detectLanguage();

    assert.strictEqual(result.language, SupportedLanguage.Python);
  });

  test('Should cache detection results', () => {
    const packageJson = path.join(tempDir, 'package.json');
    fs.writeFileSync(packageJson, '{}');

    const result1 = detector.detectLanguage();
    const result2 = detector.detectLanguage();

    assert.strictEqual(result1.language, result2.language);
    assert.strictEqual(result1.confidence, result2.confidence);
  });

  test('Should return unknown for unsupported projects', () => {
    const result = detector.detectLanguage();

    assert.strictEqual(result.language, SupportedLanguage.Unknown);
    assert.strictEqual(result.confidence, 0);
  });
});
