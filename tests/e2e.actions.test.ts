// tests/e2e.actions.test.ts
//
// End-to-end test of the HTTP security + action layer: a real Express server
// with the real requireApiToken middleware and the real ActionExecutor, driven
// over real HTTP. Deliberately avoids the LLM/embedding path so it runs offline
// and deterministically in CI.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { requireApiToken } from '../src/middleware/auth';
import { ActionExecutor } from '../src/actions/ActionExecutor';

let server: Server;
let baseUrl = '';
const TOKEN = 'test-token-abc';

before(async () => {
  process.env.API_TOKEN = TOKEN;
  const app = express();
  app.use(express.json());
  const executor = new ActionExecutor();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.post('/actions/execute', requireApiToken, async (req, res) => {
    const { toolName, args } = req.body || {};
    if (!toolName) return res.status(400).json({ error: 'toolName is required' });
    const result = await executor.execute(toolName, args || {});
    res.json({ result: result.message, ok: result.ok });
  });

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
  delete process.env.API_TOKEN;
});

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, 'ok');
});

test('POST /actions/execute without a token is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'open_browser_url', args: { url: 'https://example.com' } }),
  });
  assert.equal(res.status, 401);
});

test('action layer blocks an unsafe (non-http) URL', async () => {
  const res = await fetch(`${baseUrl}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': TOKEN },
    body: JSON.stringify({ toolName: 'open_browser_url', args: { url: 'file:///etc/passwd' } }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: string; ok: boolean };
  assert.match(body.result, /Invalid URL/i);
  assert.equal(body.ok, false);
});

test('unknown tool returns a not-supported message', async () => {
  const res = await fetch(`${baseUrl}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': TOKEN },
    body: JSON.stringify({ toolName: 'no_such_tool', args: {} }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: string };
  assert.match(body.result, /not supported/i);
});
