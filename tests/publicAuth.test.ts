// tests/publicAuth.test.ts
//
// requireAuthWhenPublic: read routes stay open normally, but require a token
// when REQUIRE_AUTH_ALL=true (public/Cloudflare-Tunnel deployment).

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuthWhenPublic } from '../src/middleware/auth';

function makeReq(headers: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  return { get: (h: string) => lower[h.toLowerCase()] } as any;
}
function makeRes() {
  return {
    statusCode: 200,
    status(c: number) { this.statusCode = c; return this; },
    json() { return this; },
  } as any;
}

const origAll = process.env.REQUIRE_AUTH_ALL;
const origToken = process.env.API_TOKEN;
afterEach(() => {
  if (origAll === undefined) delete process.env.REQUIRE_AUTH_ALL; else process.env.REQUIRE_AUTH_ALL = origAll;
  if (origToken === undefined) delete process.env.API_TOKEN; else process.env.API_TOKEN = origToken;
});

test('read routes are open when REQUIRE_AUTH_ALL is not set', () => {
  delete process.env.REQUIRE_AUTH_ALL;
  process.env.API_TOKEN = 'secret';
  let called = false;
  requireAuthWhenPublic(makeReq(), makeRes(), () => { called = true; });
  assert.equal(called, true);
});

test('read routes require a token when REQUIRE_AUTH_ALL=true', () => {
  process.env.REQUIRE_AUTH_ALL = 'true';
  process.env.API_TOKEN = 'secret';

  const resNoTok = makeRes();
  let called1 = false;
  requireAuthWhenPublic(makeReq(), resNoTok, () => { called1 = true; });
  assert.equal(called1, false);
  assert.equal(resNoTok.statusCode, 401);

  let called2 = false;
  requireAuthWhenPublic(makeReq({ 'x-api-token': 'secret' }), makeRes(), () => { called2 = true; });
  assert.equal(called2, true);
});
