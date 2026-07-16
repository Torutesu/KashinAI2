// tests/logger.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldLog } from '../src/utils/logger';

test('emits messages at or above the configured level', () => {
  assert.equal(shouldLog('info', 'info'), true);
  assert.equal(shouldLog('info', 'warn'), true);
  assert.equal(shouldLog('info', 'error'), true);
});

test('suppresses messages below the configured level', () => {
  assert.equal(shouldLog('info', 'debug'), false);
  assert.equal(shouldLog('warn', 'info'), false);
  assert.equal(shouldLog('error', 'warn'), false);
});

test('debug level lets everything through', () => {
  for (const l of ['debug', 'info', 'warn', 'error'] as const) {
    assert.equal(shouldLog('debug', l), true);
  }
});
