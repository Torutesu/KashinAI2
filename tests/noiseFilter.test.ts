// tests/noiseFilter.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLowSignalText } from '../src/memory/noiseFilter';

test('keeps meaningful text', () => {
  assert.equal(isLowSignalText('Meeting notes: ship the release Friday'), false);
  assert.equal(isLowSignalText('src/app.ts'), false);
  assert.equal(isLowSignalText('会議メモ'), false); // CJK letters
});

test('drops too-short text', () => {
  assert.equal(isLowSignalText(''), true);
  assert.equal(isLowSignalText('   '), true);
  assert.equal(isLowSignalText('ok'), true);
});

test('drops text with no letters', () => {
  assert.equal(isLowSignalText('1234567'), true);
  assert.equal(isLowSignalText('--- === ...'), true);
});

test('drops generic browser/window titles', () => {
  assert.equal(isLowSignalText('New Tab'), true);
  assert.equal(isLowSignalText('untitled'), true);
  assert.equal(isLowSignalText('about:blank'), true);
});
