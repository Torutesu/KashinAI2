// tests/integrationStatus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationStatus } from '../src/integrations/integrationStatus';

const byName = (list: ReturnType<typeof getIntegrationStatus>, name: string) =>
  list.find((s) => s.name === name)!;

test('reports every integration as not configured for an empty env', () => {
  const list = getIntegrationStatus({}, false);
  assert.ok(list.length >= 8);
  for (const s of list) assert.equal(s.configured, false, `${s.name} should be unconfigured`);
});

test('single-var integrations flip to configured when their var is set', () => {
  const env = { SLACK_BOT_TOKEN: 'x', GITHUB_TOKEN: 'y', NOTION_API_KEY: 'z', LINEAR_API_KEY: 'w', DISCORD_WEBHOOK_URL: 'https://d' } as NodeJS.ProcessEnv;
  const list = getIntegrationStatus(env, false);
  for (const name of ['slack', 'github', 'notion', 'linear', 'discord']) {
    assert.equal(byName(list, name).configured, true, `${name} should be configured`);
  }
});

test('jira requires all three vars', () => {
  assert.equal(byName(getIntegrationStatus({ JIRA_BASE_URL: 'u', JIRA_EMAIL: 'e' } as NodeJS.ProcessEnv, false), 'jira').configured, false);
  const full = { JIRA_BASE_URL: 'u', JIRA_EMAIL: 'e', JIRA_API_TOKEN: 't' } as NodeJS.ProcessEnv;
  assert.equal(byName(getIntegrationStatus(full, false), 'jira').configured, true);
});

test('telegram requires both token and chat id', () => {
  assert.equal(byName(getIntegrationStatus({ TELEGRAM_BOT_TOKEN: 'b' } as NodeJS.ProcessEnv, false), 'telegram').configured, false);
  const full = { TELEGRAM_BOT_TOKEN: 'b', TELEGRAM_CHAT_ID: '1' } as NodeJS.ProcessEnv;
  assert.equal(byName(getIntegrationStatus(full, false), 'telegram').configured, true);
});

test('google reflects the injected token-file presence, not env', () => {
  assert.equal(byName(getIntegrationStatus({}, true), 'google').configured, true);
  assert.equal(byName(getIntegrationStatus({}, false), 'google').configured, false);
});

test('blank/whitespace values do not count as configured', () => {
  assert.equal(byName(getIntegrationStatus({ SLACK_BOT_TOKEN: '   ' } as NodeJS.ProcessEnv, false), 'slack').configured, false);
});

test('never exposes secret values — only requires-hints and booleans', () => {
  const env = { SLACK_BOT_TOKEN: 'super-secret-value' } as NodeJS.ProcessEnv;
  const json = JSON.stringify(getIntegrationStatus(env, false));
  assert.ok(!json.includes('super-secret-value'));
  assert.match(json, /"requires":"SLACK_BOT_TOKEN"/);
});
