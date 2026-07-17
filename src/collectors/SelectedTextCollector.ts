import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import { warnThrottled } from '../utils/logger';
import { isCurrentAppExcluded } from './activeAppState';

const execAsync = promisify(exec);

export class SelectedTextCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastText = '';

  constructor(private memoryService: MemoryService) {}

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(async () => {
      try {
        const selectedText = await this.captureSelection();
        if (selectedText && selectedText !== this.lastText && selectedText.length > 2) {
          this.lastText = selectedText;
          if (isCurrentAppExcluded()) return; // sensitive app focused — skip capture
          await this.memoryService.storeEvent({
            type: 'SELECTED_TEXT',
            content: selectedText,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        warnThrottled('selectedtext-collector', 300000, '[SelectedTextCollector] capture failed:', error instanceof Error ? error.message : error);
      }
    }, 5000);
  }

  /**
   * Get the currently highlighted text.
   *
   * Linux exposes the highlighted text as the PRIMARY selection, so we read it
   * directly — no synthetic Ctrl+C, nothing clobbered. macOS/Windows have no
   * primary selection, so there we simulate a copy but save and RESTORE the
   * clipboard afterwards so the user's clipboard is left untouched.
   */
  private async captureSelection(): Promise<string> {
    const platform = process.platform;

    if (platform === 'linux') {
      if (process.env.WAYLAND_DISPLAY) {
        const { stdout } = await execAsync('wl-paste --primary --no-newline');
        return stdout.trim();
      }
      const { stdout } = await execAsync('xclip -selection primary -o');
      return stdout.trim();
    }

    if (platform === 'darwin' || platform === 'win32') {
      const original = await this.readClipboard(platform);
      try {
        await this.simulateCopy(platform);
        await new Promise((r) => setTimeout(r, 150));
        const selected = await this.readClipboard(platform);
        return selected ? selected.trim() : '';
      } finally {
        // Always put the user's clipboard back the way we found it.
        if (original !== null) {
          await this.writeClipboard(platform, original).catch(() => {});
        }
      }
    }

    return '';
  }

  private async simulateCopy(platform: NodeJS.Platform): Promise<void> {
    if (platform === 'darwin') {
      await execAsync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`);
    } else if (platform === 'win32') {
      await execAsync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`);
    }
  }

  private async readClipboard(platform: NodeJS.Platform): Promise<string | null> {
    try {
      if (platform === 'darwin') return (await execAsync('pbpaste')).stdout;
      if (platform === 'win32') return (await execAsync('powershell -NoProfile -Command "Get-Clipboard"')).stdout;
    } catch {
      return null;
    }
    return null;
  }

  /** Write text to the clipboard via stdin (no shell — value never hits a command line). */
  private writeClipboard(platform: NodeJS.Platform, text: string): Promise<void> {
    let cmd: string;
    let args: string[] = [];
    if (platform === 'darwin') cmd = 'pbcopy';
    else if (platform === 'win32') cmd = 'clip';
    else return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, args, { shell: false });
      child.on('error', reject);
      child.on('close', () => resolve());
      if (!child.stdin) return resolve();
      child.stdin.write(text);
      child.stdin.end();
    });
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}
