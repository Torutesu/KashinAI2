// tests/toolRegistrySemantic.test.ts
//
// Semantic tool selection on top of the keyword tiers, driven by a fake
// MemoryService.searchTools so no embeddings/LanceDB are needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRelevantToolsSemantic } from '../src/llm/Toolregistry';

function memoryWith(results: { name: string; distance: number }[]) {
  return { searchTools: async () => results } as any;
}

test('confident single match returns just that tool', async () => {
  const tools = await selectRelevantToolsSemantic(
    memoryWith([
      { name: 'send_email', distance: 0.2 },
      { name: 'create_gmail_draft', distance: 0.9 },
    ]),
    'email bob about lunch'
  );
  assert.deepEqual(tools.map((t) => t.name), ['send_email']);
});

test('a top match past the relevance floor sends no tools', async () => {
  const tools = await selectRelevantToolsSemantic(
    memoryWith([{ name: 'send_email', distance: 1.9 }]),
    'what is the weather like today'
  );
  assert.equal(tools.length, 0);
});

test('ambiguous (close) matches widen to several tools', async () => {
  const tools = await selectRelevantToolsSemantic(
    memoryWith([
      { name: 'send_email', distance: 0.40 },
      { name: 'create_gmail_draft', distance: 0.41 },
      { name: 'read_recent_emails', distance: 0.42 },
    ]),
    'do something with email'
  );
  assert.ok(tools.length >= 2);
});

test('no semantic results falls back to keyword selection', async () => {
  const tools = await selectRelevantToolsSemantic(memoryWith([]), 'make a directory named test');
  assert.deepEqual(tools.map((t) => t.name), ['create_directory']);
});
