// tests/notifyIntegrations.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { TelegramIntegration } from '../src/integrations/TelegramIntegration';
import { DiscordIntegration } from '../src/integrations/DiscordIntegration';
import { getToolDefByName } from '../src/llm/Toolregistry';

function setEnv(t: any, key: string, value: string | undefined) {
  const orig = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => { if (orig === undefined) delete process.env[key]; else process.env[key] = orig; });
}

test('notification tools are registered', () => {
  assert.ok(getToolDefByName('send_telegram_message'));
  assert.ok(getToolDefByName('send_discord_message'));
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
