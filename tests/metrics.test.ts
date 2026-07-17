// tests/metrics.test.ts
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { increment, snapshot, renderPrometheus, resetMetrics } from '../src/utils/metrics';

beforeEach(() => resetMetrics());

test('increment accumulates per name', () => {
  increment('tool_calls_total');
  increment('tool_calls_total', 2);
  increment('tool_failures_total');
  const s = snapshot();
  assert.equal(s.tool_calls_total, 3);
  assert.equal(s.tool_failures_total, 1);
});

test('renderPrometheus emits name value lines', () => {
  increment('events_stored_total', 5);
  const text = renderPrometheus();
  assert.match(text, /^events_stored_total 5$/m);
  assert.ok(text.endsWith('\n'));
});

test('empty registry renders empty string', () => {
  assert.equal(renderPrometheus(), '');
});
