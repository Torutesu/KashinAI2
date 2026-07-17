import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { browserUserDataDirs, profileHistoryPaths } from './browserPaths';
import { warnThrottled } from '../utils/logger';

const execAsync = promisify(exec);

// Unlikely-to-appear field separator for sqlite3 output.
const FIELD_SEP = String.fromCharCode(1);

export class BrowserHistoryCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  // Track the last URL seen per history DB so switching browsers/profiles
  // doesn't re-emit and each source is deduped independently.
  private lastUrlByDb: Map<string, string> = new Map();
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;

  constructor(private memoryService: MemoryService) {}

  /** Every Chromium history DB across installed browsers and their profiles. */
  private discoverHistoryDbs(): string[] {
    const specs = browserUserDataDirs(process.platform, os.homedir());
    const dbs: string[] = [];
    for (const spec of specs) {
      const listDir = (d: string) => fs.readdirSync(d);
      const exists = (p: string) => fs.existsSync(p);
      dbs.push(...profileHistoryPaths(spec.userDataDir, listDir, exists));
    }
    return dbs;
  }

  private tempPathFor(index: number): string {
    return path.join(os.tmpdir(), `kashinai_bh_${index}.db`);
  }

  // Copy the History file AND its -wal/-shm sidecars so we pick up visits the
  // browser hasn't checkpointed into the main file yet.
  private copyWithWal(dbPath: string, tempPath: string): void {
    for (const ext of ['', '-wal', '-shm']) {
      const src = dbPath + ext;
      const dest = tempPath + ext;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      } else if (fs.existsSync(dest)) {
        fs.unlinkSync(dest); // stale sidecar from a previous run
      }
    }
  }

  private cleanupTemp(tempPath: string): void {
    for (const ext of ['', '-wal', '-shm']) {
      const p = tempPath + ext;
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(async () => {
      try {
        const dbs = this.discoverHistoryDbs();
        if (dbs.length === 0) {
          warnThrottled('browser-collector-none', 300000, '[BrowserCollector] No Chromium browser history found.');
          return;
        }

        for (let i = 0; i < dbs.length; i++) {
          const dbPath = dbs[i];
          const tempPath = this.tempPathFor(i);
          try {
            this.copyWithWal(dbPath, tempPath);
            const query = `SELECT url, title FROM urls ORDER BY last_visit_time DESC LIMIT 1;`;
            const { stdout } = await execAsync(`sqlite3 -separator "${FIELD_SEP}" "${tempPath}" "${query}"`);

            const result = stdout.trim().split(FIELD_SEP);
            if (result.length === 2) {
              const [url, title] = result;
              if (url && url !== this.lastUrlByDb.get(dbPath)) {
                this.lastUrlByDb.set(dbPath, url);
                await this.memoryService.storeEvent({
                  type: 'BROWSER_HISTORY',
                  app: title,
                  content: url,
                  timestamp: new Date(),
                });
              }
            }
          } finally {
            this.cleanupTemp(tempPath);
          }
        }

        this.consecutiveFailures = 0;
      } catch (error) {
        this.consecutiveFailures++;
        warnThrottled(
          'browser-collector',
          300000,
          `[BrowserCollector] Error (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`,
          error instanceof Error ? error.message : error
        );
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          console.error('[BrowserCollector] Too many consecutive failures, stopping.');
          this.stop();
        }
      }
    }, 10000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    // Clean up any temp copies we may have left.
    for (let i = 0; i < 32; i++) this.cleanupTemp(this.tempPathFor(i));
  }
}
