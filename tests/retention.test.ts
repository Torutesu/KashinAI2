// tests/retention.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retentionCutoff } from '../src/memory/retention';

test('retentionCutoff subtracts the given number of days', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');
  const cutoff = retentionCutoff(30, now);
  assert.equal(cutoff.toISOString(), '2026-06-15T00:00:00.000Z');
});

test('retentionCutoff handles zero days (cutoff == now)', () => {
  const now = new Date('2026-07-15T12:34:56.000Z');
  assert.equal(retentionCutoff(0, now).getTime(), now.getTime());
});

test('retentionCutoff handles fractional days', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');
  const cutoff = retentionCutoff(0.5, now); // 12 hours
  assert.equal(cutoff.toISOString(), '2026-07-14T12:00:00.000Z');
});
