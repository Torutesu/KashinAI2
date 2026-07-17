// tests/activeAppState.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCaptureExcluded,
  setCurrentApp,
  getCurrentApp,
  isCurrentAppExcluded,
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

test('isCurrentAppExcluded reflects the focused app + env', () => {
  const orig = process.env.CAPTURE_EXCLUDE_APPS;
  process.env.CAPTURE_EXCLUDE_APPS = 'Bitwarden';
  try {
    setCurrentApp('Bitwarden Desktop');
    assert.equal(getCurrentApp(), 'Bitwarden Desktop');
    assert.equal(isCurrentAppExcluded(), true);

    setCurrentApp('VSCode');
    assert.equal(isCurrentAppExcluded(), false);
  } finally {
    if (orig === undefined) delete process.env.CAPTURE_EXCLUDE_APPS;
    else process.env.CAPTURE_EXCLUDE_APPS = orig;
    setCurrentApp('');
  }
});
