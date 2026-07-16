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
