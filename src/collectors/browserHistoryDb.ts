// src/collectors/browserHistoryDb.ts
//
// Reads the most recent visit from a (copied) Chromium history SQLite DB using
// Node's built-in node:sqlite — no external `sqlite3` CLI dependency. If the
// DB has a -wal sidecar alongside it, node:sqlite reads it automatically.

import { DatabaseSync } from 'node:sqlite';

export interface Visit {
  url: string;
  title: string;
}

export function readLatestVisit(dbPath: string): Visit | null {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db
      .prepare('SELECT url, title FROM urls ORDER BY last_visit_time DESC LIMIT 1')
      .get() as { url?: unknown; title?: unknown } | undefined;

    if (row && typeof row.url === 'string' && row.url.length > 0) {
      return { url: row.url, title: typeof row.title === 'string' ? row.title : '' };
    }
    return null;
  } finally {
    db.close();
  }
}
