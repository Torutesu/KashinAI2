// tests/notionIntegration.test.ts
//
// Covers the NOTION_API_KEY guard on every method (the audit found it was only
// on searchPages). No network needed — the guard short-circuits first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotionIntegration } from '../src/integrations/NotionIntegration';

function withoutKey(t: any) {
  const original = process.env.NOTION_API_KEY;
  delete process.env.NOTION_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.NOTION_API_KEY;
    else process.env.NOTION_API_KEY = original;
  });
}

test('every method guards a missing NOTION_API_KEY', async (t) => {
  withoutKey(t);
  const n = new NotionIntegration();
  const results = await Promise.all([
    n.searchPages('q'),
    n.readPage('id'),
    n.createPage('db', 'title'),
    n.editPage('id', 'text'),
    n.updateDatabase('db', 'title'),
  ]);
  for (const r of results) {
    assert.match(r, /NOTION_API_KEY not set/);
  }
});
