// tests/jiraIntegration.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { JiraIntegration } from '../src/integrations/JiraIntegration';

function withConfig(t: any, on: boolean) {
  const keys = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
  const orig = keys.map((k) => process.env[k]);
  if (on) {
    process.env.JIRA_BASE_URL = 'https://x.atlassian.net';
    process.env.JIRA_EMAIL = 'me@x.com';
    process.env.JIRA_API_TOKEN = 'tok';
  } else {
    keys.forEach((k) => delete process.env[k]);
  }
  t.after(() => keys.forEach((k, i) => {
    if (orig[i] === undefined) delete process.env[k];
    else process.env[k] = orig[i]!;
  }));
}

test('searchIssues throws when unconfigured', async (t) => {
  withConfig(t, false);
  await assert.rejects(() => new JiraIntegration().searchIssues('bug'), /JIRA_BASE_URL/);
});

test('searchIssues parses results', async (t) => {
  withConfig(t, true);
  t.mock.method(axios, 'get', async () => ({
    data: { issues: [{ key: 'ABC-1', fields: { summary: 'Fix bug', status: { name: 'To Do' }, assignee: null } }] },
  }));
  const out = await new JiraIntegration().searchIssues('bug');
  assert.match(out, /ABC-1: Fix bug \[To Do\]/);
});

test('createIssue posts and reports the key', async (t) => {
  withConfig(t, true);
  t.mock.method(axios, 'post', async () => ({ data: { key: 'ABC-2' } }));
  const out = await new JiraIntegration().createIssue('ABC', 'New task', 'desc');
  assert.match(out, /Successfully created Jira issue ABC-2/);
});

test('surfaces API errors as IntegrationError', async (t) => {
  withConfig(t, true);
  t.mock.method(axios, 'get', async () => { throw new Error('boom'); });
  await assert.rejects(() => new JiraIntegration().searchIssues('x'), /Failed to search Jira issues: boom/);
});
