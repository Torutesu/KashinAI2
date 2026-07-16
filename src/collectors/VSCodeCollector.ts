import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import { warnThrottled } from '../utils/logger';

export class VSCodeCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastWorkspace = '';

  constructor(private memoryService: MemoryService) {}

  private getVSCodeStoragePath(): string | null {
    const platform = process.platform;
    const home = os.homedir();
    if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'storage.json');
    if (platform === 'win32') return path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'storage.json');
    if (platform === 'linux') return path.join(home, '.config', 'Code', 'User', 'globalStorage', 'storage.json');
    return null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.interval = setInterval(async () => {
      try {
        const storagePath = this.getVSCodeStoragePath();
        if (!storagePath || !fs.existsSync(storagePath)) return;

        const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
        const workspace = data?.window?.lastActiveWindow?.folder;
        
        if (workspace && workspace !== this.lastWorkspace) {
          this.lastWorkspace = workspace;
          await this.memoryService.storeEvent({
            type: 'VSCODE_ACTIVITY',
            app: workspace,
            window: 'Active Workspace',
            timestamp: new Date()
          });
        }
      } catch (error) {
        warnThrottled('vscode-collector', 300000, '[VSCodeCollector] poll failed:', error instanceof Error ? error.message : error);
      }
    }, 10000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}