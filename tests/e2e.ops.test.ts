// tests/e2e.ops.test.ts
//
// E2E of the /metrics and /ready handlers over real HTTP.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import path from 'path';
import { metricsHandler, createReadyHandler, createVersionHandler } from '../src/routes/ops';
import { increment, resetMetrics } from '../src/utils/metrics';

let server: Server;
let baseUrl = '';
let ready = false;

before(async () => {
  resetMetrics();
  increment('events_stored_total', 7);
  const app = express();
  app.get('/metrics', metricsHandler);
  app.get('/ready', createReadyHandler(() => ready));
  app.get('/version', createVersionHandler('9.9.9'));
  // Serve the real dashboard from ./public (cwd is the repo root under the test runner).
  app.use(express.static(path.join(process.cwd(), 'public')));
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

test('/metrics returns Prometheus text with counters', async () => {
  const res = await fetch(`${baseUrl}/metrics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/plain/);
  const body = await res.text();
  assert.match(body, /events_stored_total 7/);
});

test('/ready reports 503 until ready, then 200', async () => {
  ready = false;
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);
  ready = true;
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);
});

test('/version returns name and version', async () => {
  const res = await fetch(`${baseUrl}/version`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { name: string; version: string };
  assert.equal(body.name, 'KashinAI2');
  assert.equal(body.version, '9.9.9');
});

test('/ serves the dashboard HTML', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  const body = await res.text();
  assert.match(body, /KashinAI2 Dashboard/);
  assert.match(body, /Recent activity/);
});
