// tests/notifyFormat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  levelEmoji,
  parseLevel,
  formatTelegramHtml,
  formatDiscordMarkdown,
  formatPlain,
} from '../src/integrations/notifyFormat';

test('levelEmoji maps known levels and ignores unknown', () => {
  assert.equal(levelEmoji('info'), 'ℹ️');
  assert.equal(levelEmoji('warn'), '⚠️');
  assert.equal(levelEmoji('error'), '🚨');
  assert.equal(levelEmoji(undefined), '');
});

test('parseLevel accepts valid levels case-insensitively, else undefined', () => {
  assert.equal(parseLevel('ERROR'), 'error');
  assert.equal(parseLevel('Warn'), 'warn');
  assert.equal(parseLevel('bogus'), undefined);
  assert.equal(parseLevel(undefined), undefined);
  assert.equal(parseLevel(42), undefined);
});

test('formatTelegramHtml bolds the title, adds emoji, and escapes the body', () => {
  const out = formatTelegramHtml({ title: 'Alert', body: 'a < b & c', level: 'error' });
  assert.equal(out, '🚨 <b>Alert</b>\na &lt; b &amp; c');
});

test('formatTelegramHtml with only a body returns the escaped body alone', () => {
  assert.equal(formatTelegramHtml({ body: 'plain <tag>' }), 'plain &lt;tag&gt;');
});

test('formatTelegramHtml escapes a title containing markup', () => {
  assert.equal(formatTelegramHtml({ title: '<b>x</b>', body: 'y' }), '<b>&lt;b&gt;x&lt;/b&gt;</b>\ny');
});

test('formatDiscordMarkdown bolds the title, adds emoji, leaves the body as-is', () => {
  const out = formatDiscordMarkdown({ title: 'Alert', body: 'a < b & c', level: 'warn' });
  assert.equal(out, '⚠️ **Alert**\na < b & c');
});

test('formatDiscordMarkdown caps the output at 2000 characters', () => {
  const out = formatDiscordMarkdown({ body: 'x'.repeat(5000) });
  assert.equal(out.length, 2000);
});

test('formatPlain joins emoji + title + body with no markup', () => {
  assert.equal(formatPlain({ title: 'Alert', body: 'hi', level: 'info' }), 'ℹ️ Alert\nhi');
  assert.equal(formatPlain({ body: 'hi' }), 'hi');
});
