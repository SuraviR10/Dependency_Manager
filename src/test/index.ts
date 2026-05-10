/**
 * Test Suite Index
 * Imports all test suites
 */

import * as path from 'path';
import { glob } from 'glob';
import mochaConstructor from 'mocha';

export async function run(): Promise<void> {
  console.log('[test-runner] run() invoked');

  // Create the mocha test suite
  const mocha = new mochaConstructor({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname);

  const patterns = ['**/*.test.ts', '**/*.test.js'];
  const fileLists = await Promise.all(
    patterns.map((pattern) => glob(pattern, { cwd: testsRoot }))
  );
  const files = fileLists.flat();

  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  await new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
