// tests/auth.test.ts
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireApiToken, corsOriginCheck, parseTokens, listDevices } from '../src/middleware/auth';

// Minimal Express req/res/next fakes.
function makeReq(headers: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  return { get: (h: string) => lower[h.toLowerCase()] } as any;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const originalToken = process.env.API_TOKEN;
const originalOrigins = process.env.ALLOWED_ORIGINS;
const originalTokens = process.env.API_TOKENS;

afterEach(() => {
  if (originalToken === undefined) delete process.env.API_TOKEN;
  else process.env.API_TOKEN = originalToken;
  if (originalOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = originalOrigins;
  if (originalTokens === undefined) delete process.env.API_TOKENS;
  else process.env.API_TOKENS = originalTokens;
});

test('requireApiToken allows through when no API_TOKEN configured (dev mode)', () => {
  delete process.env.API_TOKEN;
  delete process.env.API_TOKENS;
  const res = makeRes();
  let called = false;
  requireApiToken(makeReq(), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test('requireApiToken accepts a matching x-api-token header', () => {
  process.env.API_TOKEN = 'secret-123';
  const res = makeRes();
  let called = false;
  requireApiToken(makeReq({ 'x-api-token': 'secret-123' }), res, () => {
    called = true;
  });
  assert.equal(called, true);
});

test('requireApiToken accepts a matching Bearer token', () => {
  process.env.API_TOKEN = 'secret-123';
  const res = makeRes();
  let called = false;
  requireApiToken(makeReq({ authorization: 'Bearer secret-123' }), res, () => {
    called = true;
  });
  assert.equal(called, true);
});

test('requireApiToken rejects a missing or wrong token with 401', () => {
  process.env.API_TOKEN = 'secret-123';

  const res1 = makeRes();
  let called1 = false;
  requireApiToken(makeReq(), res1, () => {
    called1 = true;
  });
  assert.equal(called1, false);
  assert.equal(res1.statusCode, 401);

  const res2 = makeRes();
  let called2 = false;
  requireApiToken(makeReq({ 'x-api-token': 'wrong' }), res2, () => {
    called2 = true;
  });
  assert.equal(called2, false);
  assert.equal(res2.statusCode, 401);
});

test('corsOriginCheck is permissive when no allowlist configured', () => {
  delete process.env.ALLOWED_ORIGINS;
  corsOriginCheck('https://anything.example', (err, allow) => {
    assert.equal(err, null);
    assert.equal(allow, true);
  });
});

test('corsOriginCheck enforces the allowlist when configured', () => {
  process.env.ALLOWED_ORIGINS = 'https://good.example, chrome-extension://abc';

  corsOriginCheck('https://good.example', (_e, allow) => assert.equal(allow, true));
  corsOriginCheck('chrome-extension://abc', (_e, allow) => assert.equal(allow, true));
  corsOriginCheck('https://evil.example', (_e, allow) => assert.equal(allow, false));
  // No Origin header (curl / native) is always allowed.
  corsOriginCheck(undefined, (_e, allow) => assert.equal(allow, true));
});

test('parseTokens combines API_TOKEN and API_TOKENS label:token pairs', () => {
  const toks = parseTokens({ API_TOKEN: 'single', API_TOKENS: 'laptop:abc, phone:def' } as any);
  assert.deepEqual(toks, [
    { label: 'default', token: 'single' },
    { label: 'laptop', token: 'abc' },
    { label: 'phone', token: 'def' },
  ]);
});

test('parseTokens tolerates a bare token (no label)', () => {
  const toks = parseTokens({ API_TOKENS: 'justatoken' } as any);
  assert.deepEqual(toks, [{ label: 'device', token: 'justatoken' }]);
});

test('listDevices returns labels only (never secrets)', () => {
  const labels = listDevices({ API_TOKEN: 's', API_TOKENS: 'laptop:abc,phone:def' } as any);
  assert.deepEqual(labels, ['default', 'laptop', 'phone']);
});

test('requireApiToken accepts any configured device token and tags the label', () => {
  delete process.env.API_TOKEN;
  process.env.API_TOKENS = 'laptop:abc123,phone:def456';
  const res = makeRes();
  const req = makeReq({ 'x-api-token': 'def456' });
  let called = false;
  requireApiToken(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.deviceLabel, 'phone');
});

test('requireApiToken rejects a token not in the device list', () => {
  delete process.env.API_TOKEN;
  process.env.API_TOKENS = 'laptop:abc123';
  const res = makeRes();
  let called = false;
  requireApiToken(makeReq({ 'x-api-token': 'nope' }), res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});
