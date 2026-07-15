// tests/conversationHistory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrchestratorService } from '../src/llm/OrchestratorService';

// Fake LLM that records the history it was handed and never calls tools.
function makeLLM(capture: { role: string; text: string }[][]) {
  return {
    async generateResponse(prompt: string, _ctx: string, history: any[]) {
      capture.push(history.map((h) => ({ role: h.role, text: h.parts[0].text })));
      return { text: 'reply-' + prompt, toolCalls: [] };
    },
  } as any;
}

const fakeRetriever = { retrieveContext: async () => '' } as any;
const fakeMemory = { searchTools: async () => [] } as any;

test('conversation history carries across turns within a session', async () => {
  const capture: { role: string; text: string }[][] = [];
  const orch = new OrchestratorService(fakeRetriever, makeLLM(capture), fakeMemory);

  await orch.processPrompt('first question', 's1');
  await orch.processPrompt('second question', 's1');

  const secondTurn = capture[capture.length - 1].map((m) => m.text);
  assert.ok(secondTurn.includes('first question'), 'prior user turn should be present');
  assert.ok(secondTurn.some((t) => t.startsWith('reply-first')), 'prior answer should be present');
  assert.ok(secondTurn.includes('second question'), 'current turn should be present');
});

test('sessions are isolated from each other', async () => {
  const capture: { role: string; text: string }[][] = [];
  const orch = new OrchestratorService(fakeRetriever, makeLLM(capture), fakeMemory);

  await orch.processPrompt('alpha', 'A');
  capture.length = 0;
  await orch.processPrompt('beta', 'B');

  const bHistory = capture[capture.length - 1].map((m) => m.text);
  assert.ok(!bHistory.includes('alpha'), 'session B must not see session A history');
  assert.ok(bHistory.includes('beta'));
});
