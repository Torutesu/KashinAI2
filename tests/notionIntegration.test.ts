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

test('every method throws when NOTION_API_KEY is missing', async (t) => {
  withoutKey(t);
  const n = new NotionIntegration();
  await assert.rejects(() => n.searchPages('q'), /NOTION_API_KEY not set/);
  await assert.rejects(() => n.readPage('id'), /NOTION_API_KEY not set/);
  await assert.rejects(() => n.createPage('db', 'title'), /NOTION_API_KEY not set/);
  await assert.rejects(() => n.editPage('id', 'text'), /NOTION_API_KEY not set/);
  await assert.rejects(() => n.updateDatabase('db', 'title'), /NOTION_API_KEY not set/);
});
