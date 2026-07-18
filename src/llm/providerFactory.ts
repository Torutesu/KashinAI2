// src/llm/providerFactory.ts
//
// Selects the LLM provider at runtime via LLM_PROVIDER (default "gemini").
// Both implement the same LLMProvider interface, so the orchestrator is
// provider-agnostic.

import { LLMProvider } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { getApiKey } from './apiKeys';

export function createLLMProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const which = (env.LLM_PROVIDER || 'gemini').toLowerCase();
  // Pass a resolver (not a static key) so a key set at runtime via the dashboard
  // takes effect without restarting; falls back to the provided env.
  if (which === 'openai') {
    return new OpenAIProvider(() => getApiKey('OPENAI_API_KEY', env));
  }
  return new GeminiProvider(() => getApiKey('GEMINI_API_KEY', env));
}
