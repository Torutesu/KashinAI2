// tests/orchestratorLoop.test.ts
//
// Agentic-loop safety: the orchestrator stops after MAX_STEPS even if the model
// keeps requesting tools, and reports that it hit the limit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrchestratorService } from '../src/llm/OrchestratorService';
import { InMemoryConversationStore } from '../src/memory/ConversationStore';

const fakeRetriever = { retrieveContext: async () => '' } as any;
const fakeMemory = { searchTools: async () => [] } as any;

// Always requests a safe tool → never terminates on its own.
const loopingLLM = {
  async generateResponse() {
    return { text: null, toolCalls: [{ name: 'browser_get_current_tab', args: {} }] };
  },
} as any;

test('stops after MAX_STEPS and reports the limit', async () => {
  let calls = 0;
  const countingLLM = {
    async generateResponse() {
      calls++;
      return { text: null, toolCalls: [{ name: 'browser_get_current_tab', args: {} }] };
    },
  } as any;

  const orch = new OrchestratorService(
    fakeRetriever,
    countingLLM,
    fakeMemory,
    new InMemoryConversationStore(),
    { execute: async () => ({ ok: true, message: 'ok' }) } as any
  );
  const out = await orch.processPrompt('loop forever', 'loop');
  assert.match(out, /maximum number of steps/i);
  assert.equal(calls, 5); // MAX_STEPS
});

test('records the turn even when the loop hits the limit', async () => {
  const store = new InMemoryConversationStore();
  const orch = new OrchestratorService(
    fakeRetriever,
    loopingLLM,
    fakeMemory,
    store,
    { execute: async () => ({ ok: true, message: 'ok' }) } as any
  );
  await orch.processPrompt('hello', 'sess');
  const history = await store.load('sess');
  assert.equal(history.length, 2); // user + model
  assert.equal(history[0].parts[0].text, 'hello');
});
