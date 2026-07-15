// tests/binaryCheck.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandExists } from '../src/utils/binaryCheck';

test('commandExists finds a binary that is on PATH', () => {
  // `node` is guaranteed present (we are running under it).
  assert.equal(commandExists('node'), true);
});

test('commandExists returns false for a nonexistent binary', () => {
  assert.equal(commandExists('definitely-not-a-real-binary-xyz-123'), false);
});
