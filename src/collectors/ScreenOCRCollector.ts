import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import { warnThrottled } from '../utils/logger';
import { isCurrentAppExcluded } from './activeAppState';

const execAsync = promisify(exec);

export class ScreenOCRCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private memoryService: MemoryService) {}

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Run every 2 minutes (OCR is heavy)
    this.interval = setInterval(async () => {
      try {
        const platform = process.platform;
        const tempImg = path.join(os.tmpdir(), 'ai_screen.png');
        let text = '';

        // Take screenshot based on OS
        if (platform === 'darwin') {
          await execAsync(`screencapture -x "${tempImg}"`);
        } else if (platform === 'linux') {
          await execAsync(`gnome-screenshot -f "${tempImg}"`);
        } else if (platform === 'win32') {
          // Windows PowerShell script to capture screen
          const psScript = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('${tempImg.replace(/\\/g, '\\\\')}'); $g.Dispose(); $bmp.Dispose();`;
          await execAsync(`powershell -NoProfile -Command "${psScript}"`);
        } else {
          return;
        }

        if (!fs.existsSync(tempImg)) return;

        // Run OCR (Requires 'tesseract' CLI installed on the OS)
        const { stdout } = await execAsync(`tesseract "${tempImg}" stdout`);
        text = stdout.trim();

        if (text && !isCurrentAppExcluded()) { // skip while a sensitive app is focused
          await this.memoryService.storeEvent({
            type: 'SCREEN_OCR',
            content: text.substring(0, 1000), // Limit size
            timestamp: new Date()
          });
        }

        fs.unlinkSync(tempImg); // Cleanup
      } catch (error) {
        warnThrottled('screenocr-collector', 300000, '[ScreenOCRCollector] capture/OCR failed (is tesseract installed?):', error instanceof Error ? error.message : error);
      }
    }, 120000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}