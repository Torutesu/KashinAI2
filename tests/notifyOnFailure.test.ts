// tests/notifyOnFailure.test.ts
//
// Opt-in proactive alerting: when NOTIFY_ON_TOOL_FAILURE=true, a failed tool
// fires a best-effort notification. Must never recurse on notification tools
// and must stay silent when disabled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { ActionExecutor } from '../src/actions/ActionExecutor';

function setEnv(t: any, key: string, value: string | undefined) {
  const orig = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => { if (orig === undefined) delete process.env[key]; else process.env[key] = orig; });
}

// Let the fire-and-forget alert promise settle before asserting.
const flush = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));

test('alerts via notify when a tool fails and alerting is enabled', async (t) => {
  setEnv(t, 'NOTIFY_ON_TOOL_FAILURE', 'true');
  setEnv(t, 'DISCORD_WEBHOOK_URL', 'https://discord.test/webhook');
  setEnv(t, 'TELEGRAM_BOT_TOKEN', undefined);
  setEnv(t, 'TELEGRAM_CHAT_ID', undefined);
  setEnv(t, 'NOTIFY_CHANNELS', undefined);
  const posts: any[] = [];
  t.mock.method(axios, 'post', async (_u: string, body: any) => { posts.push(body); return { data: {} }; });

  const res = await new ActionExecutor().execute('nonexistent_tool', {});
  assert.equal(res.ok, false);
  await flush();
  assert.equal(posts.length, 1);
  assert.match(posts[0].content, /Tool "nonexistent_tool" failed/);
});

test('does not alert or recurse when a notification tool itself fails', async (t) => {
  setEnv(t, 'NOTIFY_ON_TOOL_FAILURE', 'true');
  setEnv(t, 'DISCORD_WEBHOOK_URL', undefined);
  setEnv(t, 'TELEGRAM_BOT_TOKEN', undefined);
  setEnv(t, 'TELEGRAM_CHAT_ID', undefined);
  setEnv(t, 'NOTIFY_CHANNELS', undefined);
  const posts: any[] = [];
  t.mock.method(axios, 'post', async (_u: string, body: any) => { posts.push(body); return { data: {} }; });

  const res = await new ActionExecutor().execute('notify', { message: 'x' });
  assert.equal(res.ok, false); // no channels configured
  await flush();
  assert.equal(posts.length, 0);
});

test('stays silent when NOTIFY_ON_TOOL_FAILURE is unset', async (t) => {
  setEnv(t, 'NOTIFY_ON_TOOL_FAILURE', undefined);
  setEnv(t, 'DISCORD_WEBHOOK_URL', 'https://discord.test/webhook');
  const posts: any[] = [];
  t.mock.method(axios, 'post', async (_u: string, body: any) => { posts.push(body); return { data: {} }; });

  await new ActionExecutor().execute('nonexistent_tool', {});
  await flush();
  assert.equal(posts.length, 0);
});
