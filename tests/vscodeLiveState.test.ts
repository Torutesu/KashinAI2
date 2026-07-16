// tests/vscodeLiveState.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setVSCodeLiveState,
  getVSCodeLiveState,
  isLiveStateFresh,
} from '../src/integrations/vscodeLiveState';
import { VSCodeIntegration } from '../src/integrations/VSCodeIntegration';

test('integration reports live cursor + selection when fresh', async () => {
  setVSCodeLiveState({ file: '/x/a.ts', line: 10, column: 5, selectedText: 'const x = 1' });
  const v = new VSCodeIntegration();
  assert.match(await v.getCursorPosition(), /a\.ts:10:5/);
  assert.equal(await v.readSelectedCode(), 'const x = 1');
});

test('freshness lapses after the stale window', () => {
  setVSCodeLiveState({ file: 'a.ts', line: 1 });
  const { updatedAt } = getVSCodeLiveState();
  assert.ok(updatedAt);
  assert.equal(isLiveStateFresh(updatedAt! + 1000), true);
  assert.equal(isLiveStateFresh(updatedAt! + 40_000), false);
});
