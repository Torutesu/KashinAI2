// tests/rateLimit.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/middleware/rateLimit';

test('allows up to max within the window, then blocks', () => {
  const rl = new RateLimiter({ windowMs: 1000, max: 3 });
  const now = 10_000;
  assert.equal(rl.hit('ip', now).allowed, true);
  assert.equal(rl.hit('ip', now).allowed, true);
  const third = rl.hit('ip', now);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  assert.equal(rl.hit('ip', now).allowed, false); // 4th blocked
});

test('window resets after it elapses', () => {
  const rl = new RateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(rl.hit('ip', 0).allowed, true);
  assert.equal(rl.hit('ip', 500).allowed, false);
  assert.equal(rl.hit('ip', 1000).allowed, true); // new window
});

test('different keys have independent buckets', () => {
  const rl = new RateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(rl.hit('a', 0).allowed, true);
  assert.equal(rl.hit('b', 0).allowed, true);
  assert.equal(rl.hit('a', 0).allowed, false);
});
