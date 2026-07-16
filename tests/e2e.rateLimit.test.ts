// tests/e2e.rateLimit.test.ts
//
// E2E: the rate-limit middleware returns 429 once the window budget is spent.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { createRateLimiter } from '../src/middleware/rateLimit';

let server: Server;
let baseUrl = '';

before(async () => {
  const app = express();
  app.use(createRateLimiter({ windowMs: 60_000, max: 2 }));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('third request within the window is rate-limited (429)', async () => {
  assert.equal((await fetch(`${baseUrl}/ping`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/ping`)).status, 200);
  const third = await fetch(`${baseUrl}/ping`);
  assert.equal(third.status, 429);
  assert.ok(third.headers.get('retry-after'));
  assert.equal(third.headers.get('x-ratelimit-limit'), '2');
});
