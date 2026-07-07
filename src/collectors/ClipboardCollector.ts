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
      let content = '';

      if (platform === 'darwin') {
        // macOS
        const { stdout } = await execAsync('pbpaste');
        content = stdout.trim();
      } else if (platform === 'win32') {
        // Windows
        const psScript = `Get-Clipboard`;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`);
        content = stdout.trim();
      } else if (platform === 'linux') {
        // Linux
        if (sessionType === 'wayland') {
          // Wayland
          const { stdout } = await execAsync('wl-paste --no-newline');
          content = stdout.trim();
        } else {
          // X11
          const { stdout } = await execAsync('xclip -selection clipboard -o');
          content = stdout.trim();
        }
      }

      return content;
    } catch {
      return '';
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.interval = setInterval(async () => {
      const content = await this.getClipboardContent();
      
      if (content && content !== this.lastContent) {
        this.lastContent = content;
        await this.memoryService.storeEvent({
          type: 'CLIPBOARD',
          content,
          timestamp: new Date(),
        });
      }
    }, 3000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}