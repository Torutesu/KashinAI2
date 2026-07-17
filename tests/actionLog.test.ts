// tests/actionLog.test.ts
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordAction, recentActions, clearActionLog } from '../src/utils/actionLog';

beforeEach(() => clearActionLog());

test('records actions, most-recent-first', () => {
  recordAction({ tool: 'a', ok: true }, 1000);
  recordAction({ tool: 'b', ok: false, device: 'laptop' }, 2000);
  const recent = recentActions();
  assert.equal(recent.length, 2);
  assert.equal(recent[0].tool, 'b');
  assert.equal(recent[0].device, 'laptop');
  assert.equal(recent[1].tool, 'a');
});

test('caps to the ring size and respects the limit arg', () => {
  for (let i = 0; i < 150; i++) recordAction({ tool: `t${i}`, ok: true }, i);
  assert.equal(recentActions(1000).length, 100); // MAX
  assert.equal(recentActions(5).length, 5);
  assert.equal(recentActions(5)[0].tool, 't149');
});
