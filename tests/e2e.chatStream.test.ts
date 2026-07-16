// tests/e2e.chatStream.test.ts
//
// E2E of the SSE chat handler with a fake orchestrator (no LLM). Verifies the
// progress events, final answer, and [DONE] sentinel are streamed.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { createChatStreamHandler, StreamableOrchestrator } from '../src/llm/chatStream';

const fakeOrchestrator: StreamableOrchestrator = {
  async processPrompt(_prompt, _sessionId, onEvent) {
    onEvent?.({ type: 'status', data: 'Considering 1 tool(s).' });
    onEvent?.({ type: 'tool', data: 'ran a tool' });
    return 'the final answer';
  },
};

let server: Server;
let baseUrl = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.post('/chat/stream', createChatStreamHandler(fakeOrchestrator));
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

test('streams progress events, the answer, and a DONE sentinel', async () => {
  const res = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

  const body = await res.text();
  assert.match(body, /"type":"status"/);
  assert.match(body, /"type":"tool"/);
  assert.match(body, /"type":"answer".*final answer/);
  assert.match(body, /\[DONE\]/);
});

test('rejects an empty prompt with 400', async () => {
  const res = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});
