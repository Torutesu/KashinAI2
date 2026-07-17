// src/utils/sessionScope.ts
//
// Conversation history is keyed by session id. On a shared backend serving
// several devices (multi-device tokens), two devices that both use the default
// or an identical `x-session-id` would otherwise share one history. We namespace
// the session id with the authenticated device label so each device keeps its
// own thread, while distinct sessions within a device stay separate.

import { Request } from 'express';

/** Combine a device label and a raw session id into a per-device storage key. */
export function scopeSessionId(deviceLabel: string | undefined, rawSessionId: string | undefined): string {
  const device = (deviceLabel || 'default').slice(0, 64);
  const raw = (rawSessionId || 'default').slice(0, 128);
  return `${device}:${raw}`;
}

/**
 * Resolve the effective session id for a chat request: the `x-session-id`
 * header (or body `sessionId`) namespaced by the request's device label
 * (set by requireApiToken; falls back to "default" in open dev mode).
 */
export function resolveSessionId(req: Request): string {
  const raw =
    req.get('x-session-id') ||
    (typeof req.body?.sessionId === 'string' ? req.body.sessionId : '') ||
    '';
  const deviceLabel = (req as Request & { deviceLabel?: string }).deviceLabel;
  return scopeSessionId(deviceLabel, raw);
}
