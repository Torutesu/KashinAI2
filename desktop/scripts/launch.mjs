// engine/launch.mjs — entrypoint for the bundled Node engine.
//
// Applies pending Prisma migrations (idempotent) against the app-data DATABASE_URL,
// then starts the server. server.js is CommonJS and begins listening on import.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prismaCli = path.join(dir, 'node_modules', 'prisma', 'build', 'index.js');

const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: dir,
  stdio: 'inherit',
});
if (migrate.status !== 0) {
  console.error('[launch] prisma migrate deploy exited with', migrate.status, '(continuing anyway)');
}

await import(path.join(dir, 'dist', 'server.js'));
