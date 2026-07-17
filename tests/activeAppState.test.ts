// tests/activeAppState.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCaptureExcluded,
  setCurrentApp,
  getCurrentApp,
  isCurrentAppExcluded,
  setExcludeApps,
} from '../src/collectors/activeAppState';

test('isCaptureExcluded matches case-insensitive substrings', () => {
  assert.equal(isCaptureExcluded('1Password 8', '1Password,Bitwarden'), true);
  assert.equal(isCaptureExcluded('Keychain Access', 'keychain'), true);
  assert.equal(isCaptureExcluded('Google Chrome', '1Password,Bitwarden'), false);
});

test('empty inputs exclude nothing', () => {
  assert.equal(isCaptureExcluded('1Password', ''), false);
  assert.equal(isCaptureExcluded('', '1Password'), false);
  assert.equal(isCaptureExcluded('anything', '  ,  '), false);
});

test('isCurrentAppExcluded reflects the focused app + live list', () => {
  try {
    setExcludeApps('Bitwarden');
    setCurrentApp('Bitwarden Desktop');
    assert.equal(getCurrentApp(), 'Bitwarden Desktop');
    assert.equal(isCurrentAppExcluded(), true);

    setCurrentApp('VSCode');
    assert.equal(isCurrentAppExcluded(), false);
  } finally {
    setExcludeApps('');
    setCurrentApp('');
  }
});

test('setExcludeApps updates the live exclusion list', async () => {
  const { setExcludeApps, setCurrentApp: setApp, isCurrentAppExcluded: excluded } =
    await import('../src/collectors/activeAppState');
  setExcludeApps('Bitwarden,1Password');
  setApp('1Password 8');
  assert.equal(excluded(), true);
  setApp('VSCode');
  assert.equal(excluded(), false);
  setExcludeApps(''); // reset
  setApp('1Password 8');
  assert.equal(excluded(), false);
  setApp('');
});
