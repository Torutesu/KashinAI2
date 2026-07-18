// src/llm/apiKeys.ts
//
// Runtime API-key resolution. Keys can come from env (12-factor) OR be set at
// runtime via the dashboard, which persists them in the settings store so the
// desktop app's testers can paste their key instead of editing env. In-memory
// overrides take effect immediately (providers resolve the key per request), and
// are reloaded from the store at boot.

import { getSetting, setSetting } from '../settings/settingsStore';

export type ApiKeyName = 'GEMINI_API_KEY' | 'OPENAI_API_KEY';
const NAMES: ApiKeyName[] = ['GEMINI_API_KEY', 'OPENAI_API_KEY'];

const overrides: Record<string, string> = {};

/** Resolve a key: runtime override → env. */
export function getApiKey(name: ApiKeyName, env: NodeJS.ProcessEnv = process.env): string {
  return overrides[name] || env[name] || '';
}

/** Load any persisted key overrides from the settings store (call once at boot). */
export async function loadApiKeyOverrides(): Promise<void> {
  for (const name of NAMES) {
    const v = await getSetting(`apikey:${name}`);
    if (v) overrides[name] = v;
  }
}

/** Set (or clear, with '') a key override and persist it. */
export async function setApiKey(name: ApiKeyName, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) overrides[name] = trimmed;
  else delete overrides[name];
  await setSetting(`apikey:${name}`, trimmed);
}

/** Which keys are configured — booleans only, never the values. */
export function apiKeyStatus(env: NodeJS.ProcessEnv = process.env): Record<ApiKeyName, boolean> {
  return {
    GEMINI_API_KEY: !!getApiKey('GEMINI_API_KEY', env),
    OPENAI_API_KEY: !!getApiKey('OPENAI_API_KEY', env),
  };
}
