// tests/githubIntegration.test.ts
//
// Covers GithubIntegration by mocking axios (no network). Verifies the token
// guard, PR filtering, success path, and error handling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { GithubIntegration } from '../src/integrations/GithubIntegration';

function withToken(t: any, token: string | undefined) {
  const original = process.env.GITHUB_TOKEN;
  if (token === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = token;
  t.after(() => {
    if (original === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = original;
  });
}

test('readIssues requires a token', async (t) => {
  withToken(t, undefined);
  const out = await new GithubIntegration().readIssues('a/b');
  assert.match(out, /GITHUB_TOKEN not set/);
});

test('readIssues filters out pull requests', async (t) => {
  withToken(t, 'tok');
  const gh = new GithubIntegration();
  t.mock.method(axios, 'get', async () => ({
    data: [
      { number: 1, title: 'Real issue', assignee: null },
      { number: 2, title: 'A pull request', assignee: null, pull_request: { url: 'x' } },
    ],
  }));
  const out = await gh.readIssues('a/b');
  assert.match(out, /#1: Real issue/);
  assert.doesNotMatch(out, /A pull request/);
});

test('createIssue posts and reports success', async (t) => {
  withToken(t, 'tok');
  const gh = new GithubIntegration();
  let posted = false;
  t.mock.method(axios, 'post', async () => {
    posted = true;
    return { data: {} };
  });
  const out = await gh.createIssue('a/b', 'Title', 'Body');
  assert.ok(posted);
  assert.match(out, /Successfully created GitHub issue in a\/b/);
});

test('readIssues surfaces errors as a string', async (t) => {
  withToken(t, 'tok');
  const gh = new GithubIntegration();
  t.mock.method(axios, 'get', async () => {
    throw new Error('boom');
  });
  const out = await gh.readIssues('a/b');
  assert.match(out, /Error reading issues: boom/);
});
