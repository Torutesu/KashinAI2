// src/utils/logger.ts
//
// Lightweight leveled logger (no external dependency). Level is set via
// LOG_LEVEL (debug|info|warn|error, default info); LOG_FORMAT=json emits one
// JSON object per line for ingestion, otherwise a readable "[level] message"
// line. Keeps the existing throttled warner for high-frequency collector loops.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** True if a message at `msgLevel` should be emitted given `configLevel`. */
export function shouldLog(configLevel: LogLevel, msgLevel: LogLevel): boolean {
  return LEVEL_ORDER[msgLevel] >= LEVEL_ORDER[configLevel];
}

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return (['debug', 'info', 'warn', 'error'].includes(raw) ? raw : 'info') as LogLevel;
}

function emit(level: LogLevel, args: unknown[]): void {
  if (!shouldLog(currentLevel(), level)) return;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (process.env.LOG_FORMAT === 'json') {
    const message = args
      .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : JSON.stringify(a)))
      .join(' ');
    sink(JSON.stringify({ level, message }));
  } else {
    sink(`[${level}]`, ...args);
  }
}

export const log = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

const lastLogged: Record<string, number> = {};

/** Log at most once per `intervalMs` per `key` (for high-frequency loops). */
export function warnThrottled(key: string, intervalMs: number, ...args: unknown[]): void {
  const now = Date.now();
  if (!lastLogged[key] || now - lastLogged[key] > intervalMs) {
    lastLogged[key] = now;
    log.warn(...args);
  }
}
