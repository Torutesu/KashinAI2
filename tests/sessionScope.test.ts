// tests/sessionScope.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeSessionId, resolveSessionId } from '../src/utils/sessionScope';
import type { Request } from 'express';

// Minimal Request stub carrying just what resolveSessionId reads.
function fakeReq(opts: { header?: string; body?: unknown; deviceLabel?: string }): Request {
  return {
    get: (name: string) => (name.toLowerCase() === 'x-session-id' ? opts.header : undefined),
    body: opts.body,
    deviceLabel: opts.deviceLabel,
  } as unknown as Request;
}

test('scopeSessionId namespaces the session by device label', () => {
  assert.equal(scopeSessionId('laptop', 'chat1'), 'laptop:chat1');
  assert.equal(scopeSessionId('phone', 'chat1'), 'phone:chat1');
});

test('two devices with the same raw session id get different keys', () => {
  assert.notEqual(scopeSessionId('laptop', 'default'), scopeSessionId('phone', 'default'));
});

test('missing device or session falls back to "default"', () => {
  assert.equal(scopeSessionId(undefined, undefined), 'default:default');
  assert.equal(scopeSessionId('laptop', undefined), 'laptop:default');
  assert.equal(scopeSessionId(undefined, 'chat1'), 'default:chat1');
});

test('device label and raw id are length-capped', () => {
  const longDevice = 'd'.repeat(100);
  const longRaw = 'r'.repeat(200);
  const key = scopeSessionId(longDevice, longRaw);
  const [device, raw] = key.split(':');
  assert.equal(device.length, 64);
  assert.equal(raw.length, 128);
});

test('resolveSessionId reads the x-session-id header and device label', () => {
  const req = fakeReq({ header: 'sessionA', deviceLabel: 'laptop' });
  assert.equal(resolveSessionId(req), 'laptop:sessionA');
});

test('resolveSessionId falls back to body.sessionId then default', () => {
  assert.equal(resolveSessionId(fakeReq({ body: { sessionId: 'fromBody' }, deviceLabel: 'phone' })), 'phone:fromBody');
  assert.equal(resolveSessionId(fakeReq({ deviceLabel: 'phone' })), 'phone:default');
  assert.equal(resolveSessionId(fakeReq({})), 'default:default');
});

test('resolveSessionId ignores a non-string body sessionId', () => {
  const req = fakeReq({ body: { sessionId: 123 }, deviceLabel: 'laptop' });
  assert.equal(resolveSessionId(req), 'laptop:default');
});
