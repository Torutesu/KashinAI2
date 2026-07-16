// src/types/result.ts
//
// Typed outcome for tool/action execution so callers (and the LLM loop) can
// branch on success vs. failure instead of string-sniffing prose.

export interface ToolResult {
  ok: boolean;
  message: string;
}

export function toolOk(message: string): ToolResult {
  return { ok: true, message };
}

export function toolErr(message: string): ToolResult {
  return { ok: false, message };
}

/**
 * Typed failure for the action/integration layer. Throwing this (instead of
 * returning an "Error…" string) lets ActionExecutor classify failures by
 * exception rather than by sniffing prose. `cause` is folded into the message.
 */
export class IntegrationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(cause instanceof Error ? `${message}: ${cause.message}` : message);
    this.name = 'IntegrationError';
  }
}
