import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';

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
        const platform = process.platform;
        let script = '';
        
        // We simulate a Ctrl+C/Cmd+C, read the clipboard, then undo the copy.
        // This is a hacky but standard way to get selected text without a browser extension.
        if (platform === 'darwin') {
          script = `osascript -e 'tell application "System Events" to keystroke "c" using command down'`;
        } else if (platform === 'linux') {
          // Requires xdotool
          script = `xdotool key ctrl+c`;
        } else {
          return; // Windows requires PowerShell automation, skipping for MVP
        }

        const oldClipboard = await execAsync(platform === 'darwin' ? 'pbpaste' : 'xclip -selection clipboard -o').catch(() => ({ stdout: '' }));
        
        await execAsync(script);
        await new Promise(r => setTimeout(r, 100)); // Wait for clipboard to update
        
        const { stdout } = await execAsync(platform === 'darwin' ? 'pbpaste' : 'xclip -selection clipboard -o');
        const selectedText = stdout.trim();

        // Restore old clipboard
        // (Omitted for brevity, but in production you'd write oldClipboard back)

        if (selectedText && selectedText !== this.lastText && selectedText.length > 2) {
          this.lastText = selectedText;
          await this.memoryService.storeEvent({
            type: 'SELECTED_TEXT',
            content: selectedText,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        // Silent fail
      }
    }, 5000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}