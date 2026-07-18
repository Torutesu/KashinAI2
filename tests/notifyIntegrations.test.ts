// tests/notifyIntegrations.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { TelegramIntegration } from '../src/integrations/TelegramIntegration';
import { DiscordIntegration } from '../src/integrations/DiscordIntegration';
import { ActionExecutor } from '../src/actions/ActionExecutor';
import { getToolDefByName } from '../src/llm/Toolregistry';

function setEnv(t: any, key: string, value: string | undefined) {
  const orig = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => { if (orig === undefined) delete process.env[key]; else process.env[key] = orig; });
}

test('notification tools are registered', () => {
  assert.ok(getToolDefByName('notify'));
  assert.ok(getToolDefByName('notify_later'));
  assert.ok(getToolDefByName('notify_list'));
  assert.ok(getToolDefByName('notify_cancel'));
  assert.ok(getToolDefByName('send_telegram_message'));
  assert.ok(getToolDefByName('send_discord_message'));
});

test('notify_later schedules without sending immediately and reports pending count', async () => {
  const res = await new ActionExecutor().execute('notify_later', { message: 'ping', delayMinutes: 5 });
  assert.equal(res.ok, true);
  assert.match(res.message, /Scheduled a notification in 5 minute\(s\) \(1 pending\)/);
});

test('notify_later rejects an out-of-range delay', async () => {
  const res = await new ActionExecutor().execute('notify_later', { message: 'ping', delayMinutes: 0 });
  assert.equal(res.ok, false);
  assert.match(res.message, /1 minute and 24 hours/);
});

test('notify_list and notify_cancel manage pending reminders', async () => {
  const ex = new ActionExecutor();
  assert.match((await ex.execute('notify_list', {})).message, /No scheduled notifications/);
  await ex.execute('notify_later', { message: 'water plants', delayMinutes: 10 });
  const list = await ex.execute('notify_list', {});
  assert.match(list.message, /\[n1\].*water plants/);
  const cancel = await ex.execute('notify_cancel', { id: 'n1' });
  assert.match(cancel.message, /Cancelled scheduled notification n1/);
  assert.match((await ex.execute('notify_list', {})).message, /No scheduled notifications/);
});

test('notify_cancel reports a missing id', async () => {
  const res = await new ActionExecutor().execute('notify_cancel', { id: 'nope' });
  assert.match(res.message, /No scheduled notification with id nope/);
});

test('listScheduledNotifications exposes pending reminders for the dashboard', async () => {
  const ex = new ActionExecutor();
  assert.deepEqual(ex.listScheduledNotifications(), []);
  await ex.execute('notify_later', { message: 'standup', delayMinutes: 15 });
  const list = ex.listScheduledNotifications();
  assert.equal(list.length, 1);
  assert.equal(list[0].payload.body, 'standup');
  ex.execute('notify_cancel', { id: list[0].id });
});

test('isConfigured reflects the presence of credentials', (t) => {
  setEnv(t, 'TELEGRAM_BOT_TOKEN', undefined);
  setEnv(t, 'TELEGRAM_CHAT_ID', undefined);
  setEnv(t, 'DISCORD_WEBHOOK_URL', undefined);
  assert.equal(new TelegramIntegration().isConfigured(), false);
  assert.equal(new DiscordIntegration().isConfigured(), false);

  setEnv(t, 'TELEGRAM_BOT_TOKEN', 'bot');
  setEnv(t, 'TELEGRAM_CHAT_ID', '1');
  setEnv(t, 'DISCORD_WEBHOOK_URL', 'https://discord.test/webhook');
  assert.equal(new TelegramIntegration().isConfigured(), true);
  assert.equal(new DiscordIntegration().isConfigured(), true);
});

test('notify tool dispatches and reports no configured channels', async (t) => {
  setEnv(t, 'TELEGRAM_BOT_TOKEN', undefined);
  setEnv(t, 'TELEGRAM_CHAT_ID', undefined);
  setEnv(t, 'DISCORD_WEBHOOK_URL', undefined);
  const res = await new ActionExecutor().execute('notify', { message: 'ping' });
  assert.equal(res.ok, false);
  assert.match(res.message, /no configured channels/);
});

test('Telegram throws when unconfigured', async (t) => {
  setEnv(t, 'TELEGRAM_BOT_TOKEN', undefined);
  setEnv(t, 'TELEGRAM_CHAT_ID', undefined);
  await assert.rejects(() => new TelegramIntegration().sendMessage('hi'), /TELEGRAM_BOT_TOKEN/);
});

test('Telegram posts to the Bot API on success', async (t) => {
  setEnv(t, 'TELEGRAM_BOT_TOKEN', 'bot123');
  setEnv(t, 'TELEGRAM_CHAT_ID', '42');
  let url = '';
  t.mock.method(axios, 'post', async (u: string, body: any) => { url = u; assert.equal(body.chat_id, '42'); return { data: {} }; });
  const out = await new TelegramIntegration().sendMessage('hello');
  assert.match(url, /api\.telegram\.org\/botbot123\/sendMessage/);
  assert.match(out, /Successfully sent Telegram/);
});

test('Discord throws without a webhook, posts with one', async (t) => {
  setEnv(t, 'DISCORD_WEBHOOK_URL', undefined);
  await assert.rejects(() => new DiscordIntegration().sendMessage('hi'), /DISCORD_WEBHOOK_URL/);

  setEnv(t, 'DISCORD_WEBHOOK_URL', 'https://discord.test/webhook');
  let posted = false;
  t.mock.method(axios, 'post', async (_u: string, body: any) => { posted = true; assert.equal(body.content, 'hey'); return { data: {} }; });
  const out = await new DiscordIntegration().sendMessage('hey');
  assert.ok(posted);
  assert.match(out, /Successfully sent Discord/);
});
