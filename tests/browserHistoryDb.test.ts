// tests/browserHistoryDb.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { readLatestVisit } from '../src/collectors/browserHistoryDb';

function makeDb(name: string, rows: [string, string, number][]): string {
  const p = path.join(os.tmpdir(), name);
  fs.rmSync(p, { force: true });
  const db = new DatabaseSync(p);
  db.exec('CREATE TABLE urls(url TEXT, title TEXT, last_visit_time INTEGER)');
  const stmt = db.prepare('INSERT INTO urls VALUES(?,?,?)');
  for (const [url, title, t] of rows) stmt.run(url, title, t);
  db.close();
  return p;
}

test('reads the most recent visit by last_visit_time', () => {
  const p = makeDb(`kashinai_hist_${process.pid}.db`, [
    ['http://old.com', 'Old', 100],
    ['http://new.com', 'New', 200],
  ]);
  try {
    assert.deepEqual(readLatestVisit(p), { url: 'http://new.com', title: 'New' });
  } finally {
    fs.rmSync(p, { force: true });
  }
});

test('returns null on an empty urls table', () => {
  const p = makeDb(`kashinai_hist_empty_${process.pid}.db`, []);
  try {
    assert.equal(readLatestVisit(p), null);
  } finally {
    fs.rmSync(p, { force: true });
  }
});
