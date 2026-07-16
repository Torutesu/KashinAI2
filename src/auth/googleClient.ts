// src/auth/googleClient.ts
//
// Single source of truth for the Google OAuth2 client used by Gmail, Calendar,
// and the calendar collector. Previously each of those read the credential and
// token files itself with no refresh — so once the access token expired every
// Google call failed forever (silently). This module:
//
//   * loads credentials/token from configurable paths (env override, else cwd),
//   * accepts both `installed` and `web` credential shapes,
//   * lets googleapis auto-refresh the access token (a refresh_token must be
//     present in google_token.json — it is when authorized with access_type
//     'offline', which src/auth/googleAuth.ts already requests),
//   * persists refreshed tokens back to disk so the refresh survives restarts.

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Infer the client type straight from the constructor. googleapis bundles its
// own nested copy of google-auth-library, and annotating with the top-level
// `Auth.OAuth2Client` type triggers a dual-package type mismatch when the client
// is passed to google.calendar/google.gmail. This keeps the exact type they expect.
type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

const CREDENTIALS_PATH =
  process.env.GOOGLE_CREDENTIALS_PATH || path.join(process.cwd(), 'google_credentials.json');
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || path.join(process.cwd(), 'google_token.json');

let cached: GoogleOAuthClient | null = null;

/** True if an OAuth token file exists (collectors use this to skip quietly). */
export function googleTokenExists(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

/**
 * Return a shared, refresh-capable OAuth2 client. Throws (with a clear message)
 * if the credential/token files are missing or malformed — callers already wrap
 * Google calls in try/catch and surface the message.
 */
export function getGoogleAuthClient(): GoogleOAuthClient {
  if (cached) return cached;

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing Google credentials at ${CREDENTIALS_PATH}.`);
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Missing Google token at ${TOKEN_PATH}. Run the OAuth flow first (src/auth/googleAuth.ts).`);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const conf = credentials.installed || credentials.web;
  if (!conf) {
    throw new Error('google_credentials.json must contain an "installed" or "web" client block.');
  }

  const { client_secret, client_id, redirect_uris } = conf;
  const redirectUri = (redirect_uris && redirect_uris[0]) || 'http://localhost';
  const client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  client.setCredentials(tokens);

  // googleapis emits 'tokens' whenever it refreshes — persist so the new
  // access_token (and any rotated refresh_token) survives a restart.
  client.on('tokens', (newTokens) => {
    try {
      const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      const merged = { ...current, ...newTokens };
      // Refresh responses usually omit refresh_token — keep the existing one.
      if (!newTokens.refresh_token && current.refresh_token) {
        merged.refresh_token = current.refresh_token;
      }
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      console.log('[googleClient] Refreshed Google access token persisted.');
    } catch (err) {
      console.error('[googleClient] Failed to persist refreshed token:', err);
    }
  });

  cached = client;
  return client;
}
