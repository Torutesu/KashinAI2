// tests/orchestratorTools.test.ts
//
// Drives the agentic tool loop with a fake LLM + fake ActionExecutor to verify
// the orchestrator feeds typed tool results back and surfaces failures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrchestratorService } from '../src/llm/OrchestratorService';
import { InMemoryConversationStore } from '../src/memory/ConversationStore';
import type { ToolResult } from '../src/types/result';

const fakeRetriever = { retrieveContext: async () => '' } as any;
const fakeMemory = { searchTools: async () => [] } as any;

// LLM that requests one safe tool on the first call, then answers with text.
function toolThenAnswerLLM(toolName: string) {
  let calls = 0;
  return {
    async generateResponse() {
      calls++;
      if (calls === 1) return { text: null, toolCalls: [{ name: toolName, args: {} }] };
      return { text: 'all done', toolCalls: [] };
    },
  } as any;
}

function fakeExecutor(result: ToolResult) {
  return { execute: async () => result } as any;
}

test('a failing tool is surfaced to the model as [FAILED]', async () => {
  const orch = new OrchestratorService(
    fakeRetriever,
    toolThenAnswerLLM('browser_get_current_tab'),
    fakeMemory,
    new InMemoryConversationStore(),
    fakeExecutor({ ok: false, message: 'Error executing browser_get_current_tab: boom' })
  );
  const out = await orch.processPrompt('what tab am I on', 's1');
  assert.match(out, /\[FAILED\]/);
  assert.match(out, /boom/);
});

test('a succeeding tool result is fed back without a failure marker', async () => {
  const orch = new OrchestratorService(
    fakeRetriever,
    toolThenAnswerLLM('browser_get_current_tab'),
    fakeMemory,
    new InMemoryConversationStore(),
    fakeExecutor({ ok: true, message: 'Current Tab -> example.com' })
  );
  const out = await orch.processPrompt('what tab am I on', 's2');
  assert.doesNotMatch(out, /\[FAILED\]/);
  assert.match(out, /all done|example\.com/);
});
