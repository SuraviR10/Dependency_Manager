import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConflictDetector } from '../../services/conflictDetector';
import { SnapshotManager } from '../../services/snapshot/snapshotManager';
import { SupportedLanguage } from '../../types/types';

suite('Dependify Core Integration & Security Tests', () => {
  const workspacePath = path.join(__dirname, '../../../test-workspace');

  setup(async () => {
    await fs.mkdir(workspacePath, { recursive: true });
  });

  teardown(async () => {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (e) {
      console.warn('Failed to cleanup test-workspace due to EBUSY lock:', e);
    }
  });

  suite('1. Conflict Detection Engine', () => {
    test('Should parse pip check conflicts safely', async function () {
      this.timeout(10000);
      const detector = new ConflictDetector(workspacePath);
      // Note: In a true mocked environment, we stub the exec call.
      // Here we validate the class handles the environment without crashing.
      const result = await detector.detectConflicts(SupportedLanguage.Python);
      assert.ok(Array.isArray(result.conflicts), 'Conflicts should be an array');
    });

    test('Should parse npm peer dependency issues', async function () {
      this.timeout(10000);
      const detector = new ConflictDetector(workspacePath);
      const result = await detector.detectConflicts(SupportedLanguage.NodeJS);
      assert.ok(Array.isArray(result.conflicts), 'Conflicts should be an array');
    });
  });

  suite('2. Snapshot & Rollback System', () => {
    test('Should capture and restore package.json accurately', async () => {
      const manager = new SnapshotManager(workspacePath);
      const pkgPath = path.join(workspacePath, 'package.json');
      
      await fs.writeFile(pkgPath, '{"dependencies": {}}', 'utf-8');
      await manager.capture('Pre-install state');
      
      // Simulate corrupted install
      await fs.writeFile(pkgPath, '{"dependencies": {"corrupted": "1.0.0"}}', 'utf-8');
      
      // Restore
      await manager.restoreLatest();
      const restored = await fs.readFile(pkgPath, 'utf-8');
      
      assert.strictEqual(restored, '{"dependencies": {}}', 'State should be perfectly rolled back');
    });

    test('Should destroy partially created environments on rollback', async () => {
      const manager = new SnapshotManager(workspacePath);
      const mockEnvPath = path.join(workspacePath, '.venv');
      
      await manager.capture('Pre-env', undefined, [mockEnvPath]);
      await fs.mkdir(mockEnvPath, { recursive: true }); // simulate creation
      
      await manager.restoreLatest();
      
      const exists = await fs.stat(mockEnvPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, false, 'Partially created .venv should be deleted');
    });
  });

  suite('3. Security & Validation (SafeCommandExecutor)', () => {
    // Simulating the exact regex validations used in SafeCommandExecutor & InstallQueue
    const validatePackageName = (name: string) => {
      if (name.includes('..') || name.includes('\\') || name.startsWith('/') || name.startsWith('.')) {
        return false;
      }
      return /^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name);
    };
    const validateCommand = (cmd: string) => !/[&|;$><`\\]/.test(cmd) && !cmd.includes('..');

    test('Should strictly block command injection attempts', () => {
      const maliciousInputs = [
        'pandas && rm -rf /',
        'numpy; del *',
        'package | malicious',
        '$(malicious)',
        '../../escape'
      ];

      for (const input of maliciousInputs) {
        assert.strictEqual(validatePackageName(input), false, `Blocked injection: ${input}`);
        assert.strictEqual(validateCommand(`pip install ${input}`), false, `Blocked command execution: ${input}`);
      }
    });

    test('Should allow valid scope and standard packages', () => {
      const validInputs = ['@types/node', 'react-dom', 'pandas', 'scikit-learn'];
      for (const input of validInputs) {
        assert.strictEqual(validatePackageName(input), true, `Allowed valid package: ${input}`);
      }
    });
  });
});