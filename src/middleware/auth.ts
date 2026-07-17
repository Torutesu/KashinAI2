// src/middleware/auth.ts
//
// API-token gate for state-changing routes.
//
// The action layer can send email, post to Slack, create files, etc. Because
// the Chrome extension's injected script runs in the visited page's origin,
// CORS alone cannot tell the extension apart from an arbitrary website — so a
// shared secret token is the real authentication boundary.
//
// Send a token as the `x-api-token` header (or `Authorization: Bearer <token>`).
// Two ways to configure, both supported together:
//   - `API_TOKEN` — a single token (label "default").
//   - `API_TOKENS` — comma-separated `label:token` pairs, one per device, e.g.
//       "laptop:abc123,phone:def456"
// A revoked device = remove its pair and restart. If NO token is configured the
// server runs in an explicitly-warned "open" mode for local development only.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { log } from '../utils/logger';

export interface DeviceToken {
  label: string;
  token: string;
}

/**
 * Parse configured tokens from env (pure). Combines `API_TOKEN` (label
 * "default") with the `API_TOKENS` `label:token` list. Read lazily so it
 * reflects env loaded via ./loadEnv.
 */
export function parseTokens(env: NodeJS.ProcessEnv = process.env): DeviceToken[] {
  const tokens: DeviceToken[] = [];
  if (env.API_TOKEN) tokens.push({ label: 'default', token: env.API_TOKEN });
  for (const pair of (env.API_TOKENS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf(':');
    if (idx > 0) tokens.push({ label: pair.slice(0, idx).trim(), token: pair.slice(idx + 1).trim() });
    else tokens.push({ label: 'device', token: pair });
  }
  return tokens.filter((t) => t.token.length > 0);
}

/** Device labels for the /devices endpoint (never exposes the secrets). */
export function listDevices(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseTokens(env).map((t) => t.label);
}

let warned = false;
function warnOnce() {
  if (!warned) {
    warned = true;
    log.warn(
      '[auth] No API token configured (API_TOKEN / API_TOKENS) — state-changing ' +
        'endpoints are UNAUTHENTICATED. Set one before using this beyond local testing.'
    );
  }
}

function extractToken(req: Request): string {
  const header = req.get('x-api-token');
  if (header) return header;
  const auth = req.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

/** Constant-time comparison to avoid leaking the token via timing. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const tokens = parseTokens();
  if (tokens.length === 0) {
    warnOnce();
    return next(); // dev-only open mode
  }
  const provided = extractToken(req);
  const match = provided ? tokens.find((t) => tokensMatch(provided, t.token)) : undefined;
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized: valid x-api-token header required.' });
  }
  // Attribute the request to a device label (for logging / auditing).
  (req as Request & { deviceLabel?: string }).deviceLabel = match.label;
  next();
}

/**
 * CORS origin allowlist. Set `ALLOWED_ORIGINS` (comma-separated) to restrict
 * which browser origins may call the API. If unset, all origins are allowed
 * (with a warning) to preserve local-dev behaviour — the token gate above is
 * the primary defense.
 */
export function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  const raw = process.env.ALLOWED_ORIGINS;
  // No allowlist configured → permissive (token gate is the real boundary).
  if (!raw) return callback(null, true);

  const allowed = raw.split(',').map((o) => o.trim()).filter(Boolean);
  // Requests with no Origin header (curl, native apps, same-origin) are allowed.
  if (!origin) return callback(null, true);
  if (allowed.includes(origin)) return callback(null, true);
  return callback(null, false);
}
