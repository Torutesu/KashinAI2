// tests/toolRegistry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectRelevantTools,
  getToolDefByName,
  getToolEmbeddingCorpus,
  TOOL_REGISTRY,
} from '../src/llm/Toolregistry';

function names(defs: { name: string }[]): string[] {
  return defs.map((d) => d.name);
}

test('confident single keyword match returns just that tool', () => {
  const tools = selectRelevantTools('send an email to bob about lunch');
  assert.deepEqual(names(tools), ['send_email']);
});

test('single-intent directory creation resolves to create_directory', () => {
  const tools = selectRelevantTools('make a directory named test');
  assert.deepEqual(names(tools), ['create_directory']);
});

test('unknown prompt falls back to the safe read-only tool set', () => {
  const tools = selectRelevantTools('hello there how are you today');
  assert.deepEqual(
    names(tools).sort(),
    ['browser_get_current_tab', 'calendar_read_upcoming', 'vscode_get_current_file'].sort()
  );
});

test('multi-intent prompt widens to multiple tools', () => {
  const tools = selectRelevantTools('read my email and then check slack');
  assert.ok(tools.length >= 2, `expected >= 2 tools, got ${tools.length}`);
  assert.ok(names(tools).includes('read_recent_emails'));
});

test('getToolDefByName resolves known and rejects unknown', () => {
  assert.equal(getToolDefByName('send_email')?.name, 'send_email');
  assert.equal(getToolDefByName('does_not_exist'), undefined);
});

test('embedding corpus covers every registered tool', () => {
  const corpus = getToolEmbeddingCorpus();
  assert.equal(corpus.length, TOOL_REGISTRY.length);
  for (const entry of corpus) {
    assert.ok(entry.name && entry.text.includes(entry.name));
  }
});
