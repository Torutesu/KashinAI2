// tests/linearIntegration.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { LinearIntegration } from '../src/integrations/LinearIntegration';

function withKey(t: any, on: boolean) {
  const orig = process.env.LINEAR_API_KEY;
  if (on) process.env.LINEAR_API_KEY = 'lin_key';
  else delete process.env.LINEAR_API_KEY;
  t.after(() => {
    if (orig === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = orig;
  });
}

test('searchIssues throws without a key', async (t) => {
  withKey(t, false);
  await assert.rejects(() => new LinearIntegration().searchIssues('bug'), /LINEAR_API_KEY/);
});

test('searchIssues parses GraphQL nodes', async (t) => {
  withKey(t, true);
  t.mock.method(axios, 'post', async () => ({
    data: { data: { issues: { nodes: [{ identifier: 'LIN-1', title: 'Fix', state: { name: 'Todo' }, assignee: null }] } } },
  }));
  const out = await new LinearIntegration().searchIssues('fix');
  assert.match(out, /LIN-1: Fix \[Todo\]/);
});

test('createIssue reports the identifier on success', async (t) => {
  withKey(t, true);
  t.mock.method(axios, 'post', async () => ({
    data: { data: { issueCreate: { success: true, issue: { identifier: 'LIN-2' } } } },
  }));
  const out = await new LinearIntegration().createIssue('team1', 'Title', 'desc');
  assert.match(out, /Successfully created Linear issue LIN-2/);
});

test('GraphQL errors surface as IntegrationError', async (t) => {
  withKey(t, true);
  t.mock.method(axios, 'post', async () => ({ data: { errors: [{ message: 'bad query' }] } }));
  await assert.rejects(() => new LinearIntegration().searchIssues('x'), /Failed to search Linear issues: bad query/);
});
