// tests/notifyScheduler.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotifyScheduler } from '../src/integrations/NotifyScheduler';
import type { NotifyPayload } from '../src/integrations/notifyFormat';

// A controllable timer + clock harness so scheduling is tested without real time.
function harness() {
  const timers: { id: number; cb: () => void; ms: number; cleared: boolean }[] = [];
  let seq = 0;
  let clock = 1_000_000;
  return {
    timers,
    now: () => clock,
    advance: (ms: number) => { clock += ms; },
    setTimer: (cb: () => void, ms: number) => { const h = { id: ++seq, cb, ms, cleared: false }; timers.push(h); return h as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: (h: unknown) => { (h as { cleared: boolean }).cleared = true; },
    fire: (index = 0) => { const t = timers[index]; if (t && !t.cleared) t.cb(); },
  };
}

const MIN = NotifyScheduler.MIN_MS;

test('schedule queues an item and fires the send after the delay', async () => {
  const h = harness();
  const sent: NotifyPayload[] = [];
  const s = new NotifyScheduler(async (p) => { sent.push(p); }, h);

  const item = s.schedule({ body: 'ping', title: 'Reminder', level: 'info' }, MIN);
  assert.equal(s.count(), 1);
  assert.equal(item.fireAt, h.now() + MIN);
  assert.equal(sent.length, 0, 'not sent before firing');

  h.fire();
  await Promise.resolve(); // let the async send settle
  assert.deepEqual(sent, [{ body: 'ping', title: 'Reminder', level: 'info' }]);
  assert.equal(s.count(), 0, 'removed from pending after firing');
});

test('rejects an empty body and out-of-range delays', () => {
  const h = harness();
  const s = new NotifyScheduler(async () => {}, h);
  assert.throws(() => s.schedule({ body: '  ' }, MIN), /message is empty/);
  assert.throws(() => s.schedule({ body: 'x' }, MIN - 1), /1 minute and 24 hours/);
  assert.throws(() => s.schedule({ body: 'x' }, NotifyScheduler.MAX_MS + 1), /1 minute and 24 hours/);
  assert.throws(() => s.schedule({ body: 'x' }, NaN), /1 minute and 24 hours/);
  assert.equal(s.count(), 0);
});

test('list returns pending items soonest-first', () => {
  const h = harness();
  const s = new NotifyScheduler(async () => {}, h);
  s.schedule({ body: 'later' }, 3 * MIN);
  s.schedule({ body: 'sooner' }, MIN);
  const list = s.list();
  assert.deepEqual(list.map((i) => i.payload.body), ['sooner', 'later']);
});

test('cancel removes a pending schedule and clears its timer', () => {
  const h = harness();
  const sent: NotifyPayload[] = [];
  const s = new NotifyScheduler(async (p) => { sent.push(p); }, h);
  const item = s.schedule({ body: 'ping' }, MIN);
  assert.equal(s.cancel(item.id), true);
  assert.equal(s.cancel('nope'), false);
  assert.equal(s.count(), 0);
  h.fire(); // timer was cleared → no send
  assert.equal(sent.length, 0);
});

test('clearAll cancels every pending schedule', () => {
  const h = harness();
  const s = new NotifyScheduler(async () => {}, h);
  s.schedule({ body: 'a' }, MIN);
  s.schedule({ body: 'b' }, 2 * MIN);
  s.clearAll();
  assert.equal(s.count(), 0);
  assert.ok(h.timers.every((t) => t.cleared));
});

test('a failing send does not throw out of the timer callback', () => {
  const h = harness();
  const s = new NotifyScheduler(async () => { throw new Error('send failed'); }, h);
  s.schedule({ body: 'ping' }, MIN);
  assert.doesNotThrow(() => h.fire());
  assert.equal(s.count(), 0);
});
