// tests/notifyService.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotifyService, NotifyChannel } from '../src/integrations/NotifyService';

function fakeChannel(name: string, configured: boolean, behavior: 'ok' | 'fail' = 'ok'): NotifyChannel & { sent: string[] } {
  const sent: string[] = [];
  return {
    name,
    sent,
    isConfigured: () => configured,
    async sendMessage(message: string) {
      sent.push(message);
      if (behavior === 'fail') throw new Error(`${name} failed`);
      return `sent via ${name}`;
    },
  };
}

test('fans out to all configured channels when NOTIFY_CHANNELS is unset', async () => {
  const tg = fakeChannel('telegram', true);
  const dc = fakeChannel('discord', true);
  const svc = new NotifyService([tg, dc]);
  const summary = await svc.notify('hello', undefined);
  assert.match(summary, /Notified via telegram, discord\./);
  assert.deepEqual(tg.sent, ['hello']);
  assert.deepEqual(dc.sent, ['hello']);
});

test('skips unconfigured channels', async () => {
  const tg = fakeChannel('telegram', true);
  const dc = fakeChannel('discord', false);
  const svc = new NotifyService([tg, dc]);
  const summary = await svc.notify('hi', undefined);
  assert.equal(summary, 'Notified via telegram.');
  assert.deepEqual(dc.sent, []);
});

test('NOTIFY_CHANNELS narrows the fan-out and ignores unknown names', async () => {
  const tg = fakeChannel('telegram', true);
  const dc = fakeChannel('discord', true);
  const svc = new NotifyService([tg, dc]);
  const summary = await svc.notify('yo', 'discord, slack');
  assert.equal(summary, 'Notified via discord.');
  assert.deepEqual(tg.sent, []);
  assert.deepEqual(dc.sent, ['yo']);
});

test('reports partial failures but still succeeds if one channel accepts', async () => {
  const tg = fakeChannel('telegram', true, 'fail');
  const dc = fakeChannel('discord', true);
  const svc = new NotifyService([tg, dc]);
  const summary = await svc.notify('msg', undefined);
  assert.equal(summary, 'Notified via discord. Failed: telegram.');
});

test('throws when no channel is configured', async () => {
  const svc = new NotifyService([fakeChannel('telegram', false), fakeChannel('discord', false)]);
  await assert.rejects(() => svc.notify('x', undefined), /no configured channels/);
});

test('throws when NOTIFY_CHANNELS selects nothing eligible', async () => {
  const svc = new NotifyService([fakeChannel('telegram', true)]);
  await assert.rejects(() => svc.notify('x', 'discord'), /no configured channels/);
});

test('throws when every selected channel fails', async () => {
  const svc = new NotifyService([fakeChannel('telegram', true, 'fail'), fakeChannel('discord', true, 'fail')]);
  await assert.rejects(() => svc.notify('x', undefined), /all channels failed/);
});

test('rejects an empty message before contacting channels', async () => {
  const tg = fakeChannel('telegram', true);
  const svc = new NotifyService([tg]);
  await assert.rejects(() => svc.notify('   ', undefined), /message is empty/);
  assert.deepEqual(tg.sent, []);
});
