import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';

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

        // Take screenshot
        if (platform === 'darwin') await execAsync(`screencapture -x "${tempImg}"`);
        else if (platform === 'linux') await execAsync(`gnome-screenshot -f "${tempImg}"`);
        else return; // Windows requires different tools

        if (!fs.existsSync(tempImg)) return;

        // Run OCR (Requires 'tesseract' CLI installed)
        const { stdout } = await execAsync(`tesseract "${tempImg}" stdout`);
        text = stdout.trim();

        if (text) {
          await this.memoryService.storeEvent({
            type: 'SCREEN_OCR',
            content: text.substring(0, 1000), // Limit size
            timestamp: new Date()
          });
        }

        fs.unlinkSync(tempImg); // Cleanup
      } catch (error) {
        // Silent fail (usually tesseract isn't installed)
      }
    }, 120000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}