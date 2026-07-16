// src/config.ts
//
// Startup configuration validation. Fails fast on clearly-invalid config
// (non-numeric numeric vars) and warns about risky-but-runnable setups
// (missing API_TOKEN / GEMINI_API_KEY). Pure over an env object so it's testable.

export interface ConfigReport {
  errors: string[];
  warnings: string[];
}

const NUMERIC_VARS = ['PORT', 'MEMORY_RETENTION_DAYS', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX'];

export function validateConfig(env: NodeJS.ProcessEnv): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of NUMERIC_VARS) {
    const raw = env[key];
    if (raw !== undefined && raw !== '' && !Number.isFinite(Number(raw))) {
      errors.push(`${key} must be a number (got "${raw}").`);
    }
  }

  if (!env.API_TOKEN) {
    warnings.push('API_TOKEN is not set — state-changing endpoints are unauthenticated (dev only).');
  }
  if (!env.GEMINI_API_KEY) {
    warnings.push('GEMINI_API_KEY is not set — /chat and /llm/query will fail.');
  }

  return { errors, warnings };
}

/**
 * Validate process.env, log warnings, and throw on hard errors. Call once at
 * startup (after .env is loaded).
 */
export function assertValidConfig(env: NodeJS.ProcessEnv = process.env): void {
  const { errors, warnings } = validateConfig(env);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}
