// src/utils/logger.ts
//
// Minimal throttled logger. Several collectors poll every few seconds; logging
// every failure would spam the console, which is why they were left as silent
// `catch {}` blocks. This logs at most once per `intervalMs` per `key` so a
// persistent failure (e.g. a missing binary or an expired token) is visible
// without flooding the terminal.

const lastLogged: Record<string, number> = {};

export function warnThrottled(key: string, intervalMs: number, ...args: unknown[]): void {
  const now = Date.now();
  if (!lastLogged[key] || now - lastLogged[key] > intervalMs) {
    lastLogged[key] = now;
    console.warn(...args);
  }
}
