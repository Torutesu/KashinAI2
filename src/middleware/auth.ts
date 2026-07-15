// src/middleware/auth.ts
//
// API-token gate for state-changing routes.
//
// The action layer can send email, post to Slack, create files, etc. Because
// the Chrome extension's injected script runs in the visited page's origin,
// CORS alone cannot tell the extension apart from an arbitrary website — so a
// shared secret token is the real authentication boundary.
//
// Configure `API_TOKEN` in the environment and send it as the `x-api-token`
// header (or `Authorization: Bearer <token>`). If `API_TOKEN` is unset the
// server runs in an explicitly-warned "open" mode for local development only.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const API_TOKEN = process.env.API_TOKEN || '';

let warned = false;
function warnOnce() {
  if (!warned) {
    warned = true;
    console.warn(
      '[auth] API_TOKEN is not set — state-changing endpoints are UNAUTHENTICATED. ' +
        'Any local process (or website, via the extension) can trigger actions. ' +
        'Set API_TOKEN in your .env before using this beyond local testing.'
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
  if (!API_TOKEN) {
    warnOnce();
    return next(); // dev-only open mode
  }
  const provided = extractToken(req);
  if (!provided || !tokensMatch(provided, API_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized: valid x-api-token header required.' });
  }
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
