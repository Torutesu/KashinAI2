import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class BrowserHistoryCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastUrl = '';
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;
  private readonly tempPath = path.join(os.tmpdir(), 'chrome_history_temp.db');

  constructor(private memoryService: MemoryService) {}

  private getChromeHistoryPath(): string {
    const platform = process.platform;
    const home = os.homedir();
    if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'History');
    if (platform === 'win32') return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'History');
    if (platform === 'linux') return path.join(home, '.config', 'google-chrome', 'Default', 'History');
    return '';
  }

  // Copies the base History file AND its -wal/-shm sidecars, so we pick up
  // visits Chrome hasn't checkpointed into the main file yet.
  private copyWithWal(dbPath: string): void {
    for (const ext of ['', '-wal', '-shm']) {
      const src = dbPath + ext;
      const dest = this.tempPath + ext;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      } else if (fs.existsSync(dest)) {
        fs.unlinkSync(dest); // stale sidecar from a previous run
      }
    }
  }

  private cleanupTemp(): void {
    for (const ext of ['', '-wal', '-shm']) {
      const p = this.tempPath + ext;
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[BrowserCollector] Started.');

    this.interval = setInterval(async () => {
      try {
        const dbPath = this.getChromeHistoryPath();
        if (!dbPath) {
          console.error('[BrowserCollector] No Chrome history path for this platform.');
          return;
        }

        this.copyWithWal(dbPath);

        const query = `SELECT url, title FROM urls ORDER BY last_visit_time DESC LIMIT 1;`;
        const { stdout } = await execAsync(
          `sqlite3 -separator "\u0001" "${this.tempPath}" "${query}"`
        );

        const result = stdout.trim().split('\u0001');
        if (result.length === 2) {
          const [url, title] = result;
          if (url && url !== this.lastUrl) {
            this.lastUrl = url;
            await this.memoryService.storeEvent({
              type: 'BROWSER_HISTORY',
              app: title,
              content: url,
              timestamp: new Date(),
            });
            console.log(`[BrowserCollector] Stored: ${url}`);
          }
        }

        this.consecutiveFailures = 0;
      } catch (error) {
        this.consecutiveFailures++;
        console.error(
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
    this.cleanupTemp();
  }
}