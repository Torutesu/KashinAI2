// src/integrations/integrationStatus.ts
//
// Reports which integrations are wired up, purely from configuration — env vars
// and the presence of the Google OAuth token file. Makes NO external calls and
// returns only booleans + the names of the settings involved (never a secret),
// so it is safe to surface on the dashboard and in ops checks.

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  requires: string; // human hint: which settings enable it (names only, no values)
}

/** True when an env var is present and non-blank. */
function has(env: NodeJS.ProcessEnv, key: string): boolean {
  const v = env[key];
  return !!(v && v.trim());
}

/**
 * Compute the configured/not-configured status of every integration.
 *
 * @param env         environment to read (defaults to process.env)
 * @param googleReady whether a Google OAuth token file is present (defaults to
 *                    googleTokenExists(); injectable so it stays pure in tests)
 */
export function getIntegrationStatus(
  env: NodeJS.ProcessEnv = process.env,
  googleReady: boolean = defaultGoogleReady()
): IntegrationStatus[] {
  return [
    { name: 'slack', configured: has(env, 'SLACK_BOT_TOKEN'), requires: 'SLACK_BOT_TOKEN' },
    { name: 'github', configured: has(env, 'GITHUB_TOKEN'), requires: 'GITHUB_TOKEN' },
    { name: 'google', configured: googleReady, requires: 'google_token.json (Gmail/Calendar/Drive)' },
    { name: 'notion', configured: has(env, 'NOTION_API_KEY'), requires: 'NOTION_API_KEY' },
    {
      name: 'jira',
      configured: has(env, 'JIRA_BASE_URL') && has(env, 'JIRA_EMAIL') && has(env, 'JIRA_API_TOKEN'),
      requires: 'JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN',
    },
    { name: 'linear', configured: has(env, 'LINEAR_API_KEY'), requires: 'LINEAR_API_KEY' },
    {
      name: 'telegram',
      configured: has(env, 'TELEGRAM_BOT_TOKEN') && has(env, 'TELEGRAM_CHAT_ID'),
      requires: 'TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID',
    },
    { name: 'discord', configured: has(env, 'DISCORD_WEBHOOK_URL'), requires: 'DISCORD_WEBHOOK_URL' },
  ];
}

// Isolated so tests can pass their own googleReady without touching the FS.
function defaultGoogleReady(): boolean {
  // Lazy require avoids pulling googleapis into pure test paths.
  const { googleTokenExists } = require('../auth/googleClient') as typeof import('../auth/googleClient');
  return googleTokenExists();
}
