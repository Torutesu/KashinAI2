// tests/e2e.manage.test.ts
//
// E2E of the dashboard management handlers with injected fakes (no DB / model).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import {
  privacyGetHandler,
  createPrivacyPutHandler,
  actionsHistoryHandler,
  createMemoryClearHandler,
} from '../src/routes/manage';
import { recordAction, clearActionLog } from '../src/utils/actionLog';
import { getExcludeApps } from '../src/collectors/activeAppState';

let server: Server;
let baseUrl = '';
let persisted = '';
const cleared: string[] = [];

before(async () => {
  clearActionLog();
  recordAction({ tool: 'send_email', ok: false, device: 'laptop' }, 1000);

  const app = express();
  app.use(express.json());
  app.get('/settings/privacy', privacyGetHandler);
  app.put('/settings/privacy', createPrivacyPutHandler(async (v) => { persisted = v; }));
  app.get('/actions/history', actionsHistoryHandler);
  app.post('/memory/clear', createMemoryClearHandler(async (s) => {
    cleared.push(s);
    return { deleted: 3, vectorsDeleted: 2 };
  }));

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

test('PUT then GET /settings/privacy round-trips and persists', async () => {
  const put = await fetch(`${baseUrl}/settings/privacy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captureExcludeApps: '1Password,Bitwarden' }),
  });
  assert.equal(put.status, 200);
  assert.equal(persisted, '1Password,Bitwarden');
  assert.equal(getExcludeApps(), '1Password,Bitwarden');

  const get = await (await fetch(`${baseUrl}/settings/privacy`)).json() as { captureExcludeApps: string };
  assert.equal(get.captureExcludeApps, '1Password,Bitwarden');
});

test('GET /actions/history returns recorded actions', async () => {
  const data = await (await fetch(`${baseUrl}/actions/history`)).json() as { actions: any[] };
  assert.ok(data.actions.length >= 1);
  assert.equal(data.actions[0].tool, 'send_email');
});

test('POST /memory/clear validates the source and returns counts', async () => {
  const bad = await fetch(`${baseUrl}/memory/clear`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'NOPE' }),
  });
  assert.equal(bad.status, 400);

  const ok = await fetch(`${baseUrl}/memory/clear`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'CLIPBOARD' }),
  });
  assert.equal(ok.status, 200);
  const body = await ok.json() as { deleted: number; vectorsDeleted: number };
  assert.equal(body.deleted, 3);
  assert.deepEqual(cleared, ['CLIPBOARD']);
});
