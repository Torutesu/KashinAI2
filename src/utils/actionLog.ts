// src/utils/actionLog.ts
//
// In-memory ring buffer of recent tool/action executions, surfaced on the
// dashboard's "action history" panel. Transient by design (cleared on restart)
// — it's a monitoring aid, not an audit of record.

export interface ActionLogEntry {
  tool: string;
  ok: boolean;
  device?: string;
  at: number; // epoch ms
}

const MAX = 100;
const entries: ActionLogEntry[] = [];

export function recordAction(entry: Omit<ActionLogEntry, 'at'>, at: number): void {
  entries.push({ ...entry, at });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
}

/** Most recent actions first, capped to `limit`. */
export function recentActions(limit = 50): ActionLogEntry[] {
  return entries.slice(-limit).reverse();
}

export function clearActionLog(): void {
  entries.length = 0;
}
