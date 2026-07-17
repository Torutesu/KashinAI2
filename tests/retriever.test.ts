// tests/retriever.test.ts
//
// Exercises the hybrid retrieval assembly end-to-end with a fake MemoryService
// (no DB / embeddings): recent activity + vector + keyword candidates → ranked
// context string.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RetrieverService } from '../src/retriever/RetrieverService';

const now = new Date().toISOString();

const fakeMemory = {
  getRecentContext: async () => ({
    recentApps: [{ app: 'VSCode', window: 'server.ts' }],
    recentBrowser: [{ title: 'GitHub - KashinAI2' }],
  }),
  searchMemory: async () => ({
    semanticMatches: [{ text: 'deploy notes for prod', type: 'OCR', _distance: 0.2, timestamp: now }],
  }),
  keywordSearch: async () => [
    { text: 'deploy notes for prod', type: 'OCR', timestamp: now }, // same as vector → merged
    { text: 'unrelated clipboard', type: 'CLIPBOARD', timestamp: now },
  ],
} as any;

test('retrieveContext includes recent activity and ranked hybrid memory', async () => {
  const r = new RetrieverService(fakeMemory);
  const ctx = await r.retrieveContext('deploy');

  assert.match(ctx, /=== RECENT ACTIVITY ===/);
  assert.match(ctx, /Active Window: VSCode - server\.ts/);
  assert.match(ctx, /Last Browser Tab: GitHub - KashinAI2/);

  assert.match(ctx, /=== RELEVANT MEMORY \(hybrid\)/);
  assert.match(ctx, /deploy notes for prod/);
  // The item surfaced by BOTH vector and keyword shows both sources.
  assert.match(ctx, /vector\+keyword|keyword\+vector/);
});

test('retrieveContext reports when there are no relevant memories', async () => {
  const empty = {
    getRecentContext: async () => ({}),
    searchMemory: async () => ({ semanticMatches: [] }),
    keywordSearch: async () => [],
  } as any;
  const ctx = await new RetrieverService(empty).retrieveContext('nothing');
  assert.match(ctx, /No relevant memories found/);
});
