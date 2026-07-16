// src/llm/providerFactory.ts
//
// Selects the LLM provider at runtime via LLM_PROVIDER (default "gemini").
// Both implement the same LLMProvider interface, so the orchestrator is
// provider-agnostic.

import { LLMProvider } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';

export function createLLMProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const which = (env.LLM_PROVIDER || 'gemini').toLowerCase();
  if (which === 'openai') {
    return new OpenAIProvider(env.OPENAI_API_KEY || '');
  }
  return new GeminiProvider(env.GEMINI_API_KEY || '');
}
