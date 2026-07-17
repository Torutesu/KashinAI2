// tests/metricsHistory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSample, getSeries, clearSeries } from '../src/utils/metricsHistory';

test('records samples in order and copies values defensively', () => {
  clearSeries();
  const values = { events_stored_total: 1, tool_calls_total: 2 };
  recordSample(values, 1000);
  // Mutating the source object must not affect the stored sample.
  values.events_stored_total = 99;
  recordSample({ events_stored_total: 5 }, 2000);

  const series = getSeries();
  assert.equal(series.length, 2);
  assert.deepEqual(series[0], { t: 1000, values: { events_stored_total: 1, tool_calls_total: 2 } });
  assert.equal(series[1].t, 2000);
  assert.equal(series[1].values.events_stored_total, 5);
});

test('getSeries returns a copy that cannot mutate internal state', () => {
  clearSeries();
  recordSample({ a: 1 }, 1);
  const s = getSeries();
  s.push({ t: 99, values: { a: 9 } });
  assert.equal(getSeries().length, 1);
});

test('ring buffer caps at 120 samples, dropping the oldest', () => {
  clearSeries();
  for (let i = 0; i < 200; i++) recordSample({ n: i }, i);
  const series = getSeries();
  assert.equal(series.length, 120);
  // Oldest kept sample is index 80 (200 - 120).
  assert.equal(series[0].values.n, 80);
  assert.equal(series[series.length - 1].values.n, 199);
});

test('clearSeries empties the buffer', () => {
  recordSample({ a: 1 }, 1);
  clearSeries();
  assert.equal(getSeries().length, 0);
});
