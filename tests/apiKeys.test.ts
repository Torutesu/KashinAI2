// tests/apiKeys.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApiKey, apiKeyStatus } from '../src/llm/apiKeys';
import { GeminiProvider } from '../src/llm/GeminiProvider';
import { OpenAIProvider } from '../src/llm/OpenAIProvider';

test('getApiKey falls back to the provided env when no override is set', () => {
  assert.equal(getApiKey('GEMINI_API_KEY', { GEMINI_API_KEY: 'from-env' } as NodeJS.ProcessEnv), 'from-env');
  assert.equal(getApiKey('GEMINI_API_KEY', {} as NodeJS.ProcessEnv), '');
});

test('apiKeyStatus reports booleans only, reflecting presence', () => {
  const status = apiKeyStatus({ GEMINI_API_KEY: 'x' } as NodeJS.ProcessEnv);
  assert.equal(status.GEMINI_API_KEY, true);
  assert.equal(status.OPENAI_API_KEY, false);
  // Never leaks a value.
  assert.ok(!JSON.stringify(status).includes('x'));
});

test('OpenAIProvider rebuilds its client when the resolved key changes', () => {
  let key = 'k1';
  const p = new OpenAIProvider(() => key);
  const c1 = (p as unknown as { getClient(): unknown }).getClient();
  const again = (p as unknown as { getClient(): unknown }).getClient();
  assert.equal(c1, again, 'same key → same client');
  key = 'k2';
  const c2 = (p as unknown as { getClient(): unknown }).getClient();
  assert.notEqual(c1, c2, 'changed key → rebuilt client');
});

test('GeminiProvider rebuilds its client when the resolved key changes', () => {
  let key = 'g1';
  const p = new GeminiProvider(() => key);
  const c1 = (p as unknown as { client(): unknown }).client();
  const again = (p as unknown as { client(): unknown }).client();
  assert.equal(c1, again);
  key = 'g2';
  const c2 = (p as unknown as { client(): unknown }).client();
  assert.notEqual(c1, c2);
});

test('a static string key still works (backward compatible)', () => {
  const p = new GeminiProvider('static-key');
  assert.ok((p as unknown as { client(): unknown }).client());
});
