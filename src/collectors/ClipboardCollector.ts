import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';

const execAsync = promisify(exec);

export class ClipboardCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastContent = '';

  constructor(private memoryService: MemoryService) {}

  private async getClipboardContent(): Promise<string> {
    const platform = process.platform;
    const sessionType = process.env.XDG_SESSION_TYPE || '';

    try {
      if (platform === 'darwin') {
        const { stdout } = await execAsync('pbpaste');
        return stdout.trim();
      } else if (platform === 'win32') {
        const { stdout } = await execAsync(`powershell -NoProfile -Command "Get-Clipboard"`);
        return stdout.trim();
      } else if (platform === 'linux') {
        if (sessionType === 'wayland') {
          const { stdout } = await execAsync('wl-paste --no-newline');
          return stdout.trim();
        } else {
          const { stdout } = await execAsync('xclip -selection clipboard -o');
          return stdout.trim();
        }
      }
      return '';
    } catch (error) {
      // Silent fail if clipboard is empty
      return '';
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Changed to 5 seconds as per review
    this.interval = setInterval(async () => {
      try {
        const content = await this.getClipboardContent();
        if (content && content !== this.lastContent) {
          this.lastContent = content;
          await this.memoryService.storeEvent({
            type: 'CLIPBOARD',
            content,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('[ClipboardCollector] Interval crashed:', error);
      }
    }, 5000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}