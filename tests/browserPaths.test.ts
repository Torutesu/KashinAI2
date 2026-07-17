// tests/browserPaths.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { browserUserDataDirs, profileHistoryPaths } from '../src/collectors/browserPaths';

test('lists multiple Chromium browsers per platform', () => {
  const linux = browserUserDataDirs('linux', '/home/u').map((b) => b.name);
  assert.ok(linux.includes('Chrome'));
  assert.ok(linux.includes('Brave'));
  assert.ok(linux.includes('Edge'));

  const mac = browserUserDataDirs('darwin', '/Users/u').map((b) => b.name);
  assert.ok(mac.includes('Chromium'));

  const win = browserUserDataDirs('win32', 'C:\\Users\\u').map((b) => b.name);
  assert.ok(win.includes('Chrome'));
});

test('uses the expected Linux Chrome path', () => {
  const chrome = browserUserDataDirs('linux', '/home/u').find((b) => b.name === 'Chrome');
  assert.equal(chrome?.userDataDir, path.join('/home/u', '.config', 'google-chrome'));
});

test('finds Default and Profile N history files that exist', () => {
  const userDataDir = '/ud';
  const entries = ['Default', 'Profile 1', 'Profile 2', 'Guest Profile', 'Local State'];
  const existing = new Set([
    '/ud',
    path.join('/ud', 'Default', 'History'),
    path.join('/ud', 'Profile 1', 'History'),
    // Profile 2 has no History file (never opened) -> excluded
  ]);
  const paths = profileHistoryPaths(
    userDataDir,
    () => entries,
    (p) => existing.has(p)
  );
  assert.deepEqual(paths.sort(), [
    path.join('/ud', 'Default', 'History'),
    path.join('/ud', 'Profile 1', 'History'),
  ].sort());
});

test('returns nothing when the user-data dir is absent', () => {
  const paths = profileHistoryPaths('/nope', () => [], () => false);
  assert.deepEqual(paths, []);
});
