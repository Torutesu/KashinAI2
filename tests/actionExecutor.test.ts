// tests/actionExecutor.test.ts
//
// ActionExecutor.execute classification: failures (unknown tool, invalid URL)
// return ToolResult { ok:false }. These paths have no side effects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionExecutor } from '../src/actions/ActionExecutor';

test('unknown tool -> ok:false with a not-supported message', async () => {
  const r = await new ActionExecutor().execute('no_such_tool', {});
  assert.equal(r.ok, false);
  assert.match(r.message, /not supported/i);
});

test('invalid (non-http) URL -> ok:false', async () => {
  const r = await new ActionExecutor().execute('open_browser_url', { url: 'file:///etc/passwd' });
  assert.equal(r.ok, false);
  assert.match(r.message, /Invalid URL/i);
});

test('create_directory outside home -> ok:false', async () => {
  const r = await new ActionExecutor().execute('create_directory', { path: '../../etc/evil' });
  assert.equal(r.ok, false);
  assert.match(r.message, /Security violation/i);
});
