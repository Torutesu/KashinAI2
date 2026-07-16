// tests/providerFactory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLLMProvider } from '../src/llm/providerFactory';
import { GeminiProvider } from '../src/llm/GeminiProvider';
import { OpenAIProvider } from '../src/llm/OpenAIProvider';

test('defaults to the Gemini provider', () => {
  const p = createLLMProvider({ GEMINI_API_KEY: 'k' } as any);
  assert.ok(p instanceof GeminiProvider);
});

test('selects OpenAI when LLM_PROVIDER=openai', () => {
  const p = createLLMProvider({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' } as any);
  assert.ok(p instanceof OpenAIProvider);
});

test('unknown provider falls back to Gemini', () => {
  const p = createLLMProvider({ LLM_PROVIDER: 'nope' } as any);
  assert.ok(p instanceof GeminiProvider);
});

test('constructing the OpenAI provider without a key does not throw', () => {
  assert.doesNotThrow(() => createLLMProvider({ LLM_PROVIDER: 'openai' } as any));
});
