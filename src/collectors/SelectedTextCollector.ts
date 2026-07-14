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
        let clipCmd = '';
        
        if (platform === 'darwin') {
          script = `osascript -e 'tell application "System Events" to keystroke "c" using command down'`;
          clipCmd = 'pbpaste';
        } else if (platform === 'linux') {
          script = `xdotool key ctrl+c`;
          clipCmd = 'xclip -selection clipboard -o';
        } else if (platform === 'win32') {
          // Windows PowerShell script to simulate Ctrl+C
          script = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`;
          clipCmd = `powershell -NoProfile -Command "Get-Clipboard"`;
        } else {
          return;
        }

        // Save old clipboard to restore later (omitted for MVP, but good practice)
        // const oldClipboard = await execAsync(clipCmd).catch(() => ({ stdout: '' }));
        
        await execAsync(script);
        await new Promise(r => setTimeout(r, 150)); // Wait for clipboard to update
        
        const { stdout } = await execAsync(clipCmd);
        const selectedText = stdout.trim();

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