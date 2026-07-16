// tests/slackIntegration.test.ts
//
// Covers SlackIntegration by mocking axios. Verifies token guards, direct
// channel-id posting, channel-search pagination, and the user-token
// requirement for message search.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { SlackIntegration } from '../src/integrations/SlackIntegration';

function setEnv(t: any, key: string, value: string | undefined) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  });
}

test('sendMessage requires a bot token', async (t) => {
  setEnv(t, 'SLACK_BOT_TOKEN', undefined);
  const out = await new SlackIntegration().sendMessage('#general', 'hi');
  assert.match(out, /SLACK_BOT_TOKEN not set/);
});

test('sendMessage posts to a channel id without a lookup', async (t) => {
  setEnv(t, 'SLACK_BOT_TOKEN', 'xoxb-test');
  const slack = new SlackIntegration();
  let postedTo = '';
  t.mock.method(axios, 'post', async (_url: string, body: any) => {
    postedTo = body.channel;
    return { data: { ok: true } };
  });
  // A channel id (matches [CGD][A-Z0-9]{8,}) skips conversations.list entirely.
  const out = await slack.sendMessage('C12345678', 'hello');
  assert.equal(postedTo, 'C12345678');
  assert.match(out, /Successfully sent Slack message/);
});

test('searchChannels follows cursor pagination', async (t) => {
  setEnv(t, 'SLACK_BOT_TOKEN', 'xoxb-test');
  const slack = new SlackIntegration();
  t.mock.method(axios, 'get', async (_url: string, config: any) => {
    const cursor = config?.params?.cursor;
    if (!cursor) {
      return { data: { ok: true, channels: [{ name: 'alpha', id: 'C1' }], response_metadata: { next_cursor: 'PAGE2' } } };
    }
    return { data: { ok: true, channels: [{ name: 'alpha-beta', id: 'C2' }], response_metadata: { next_cursor: '' } } };
  });
  const out = await slack.searchChannels('alpha');
  assert.match(out, /C1/);
  assert.match(out, /C2/); // second page was fetched
});

test('searchConversations requires a user token', async (t) => {
  setEnv(t, 'SLACK_BOT_TOKEN', 'xoxb-test');
  setEnv(t, 'SLACK_USER_TOKEN', undefined);
  const out = await new SlackIntegration().searchConversations('deploy');
  assert.match(out, /SLACK_USER_TOKEN/);
});
