// src/integrations/VSCodeIntegration.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getVSCodeLiveState, isLiveStateFresh } from './vscodeLiveState';
import { IntegrationError } from '../types/result';

const execFileAsync = promisify(execFile);

export class VSCodeIntegration {
  private getStoragePath(): string | null {
    const platform = process.platform;
    const home = os.homedir();
    if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'storage.json');
    if (platform === 'win32') return path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'storage.json');
    if (platform === 'linux') return path.join(home, '.config', 'Code', 'User', 'globalStorage', 'storage.json');
    return null;
  }

  private readStorage(): any {
    const p = this.getStoragePath();
    if (!p || !fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return null;
    }
  }

  // 1. Open File
  async openFile(filePath: string): Promise<string> {
    if (!filePath || typeof filePath !== 'string') throw new IntegrationError('No file path provided.');
    try {
      // execFile passes the path as a single argv entry — no shell, so path
      // contents can't break out and run arbitrary commands. On Windows the
      // launcher is `code.cmd`, resolved via `cmd /c` (still argv-based).
      if (process.platform === 'win32') {
        await execFileAsync('cmd', ['/c', 'code', filePath], { shell: false });
      } else {
        await execFileAsync('code', [filePath], { shell: false });
      }
      return `Successfully opened ${filePath} in VS Code.`;
    } catch (error) {
      throw new IntegrationError("Could not open VS Code. Ensure the 'code' command is on your PATH", error);
    }
  }

  // 2. Current Workspace
  async getCurrentWorkspace(): Promise<string> {
    const storage = this.readStorage();
    if (!storage) return 'Could not read VS Code state.';
    
    // Parse the local storage.json to find the last active workspace
    const workspace = storage?.window?.lastActiveWindow?.folder || storage?.window?.lastActiveWindow?.workspace?.configPath;
    return workspace ? `Current workspace: ${workspace}` : 'No active workspace found.';
  }

  // 3. Current File (Most recently opened file)
  async getCurrentFile(): Promise<string> {
    const storage = this.readStorage();
    if (!storage) return 'Could not read VS Code state.';
    
    const recentPaths = storage?.window?.recentlyOpenedPaths || [];
    // Find the most recent entry that is a file, not a folder
    const recentFile = recentPaths.find((p: any) => p.fileUri);
    
    if (recentFile) {
      const filePath = recentFile.fileUri.replace('file://', '');
      return `Current/most recent file: ${filePath}`;
    }
    return 'No recent files found.';
  }

  // 4. Cursor Position & 5. Read Selected Code
  // Served from live state pushed by the KashinAI VS Code companion extension
  // (POST /vscode/state). Falls back to a helpful message when not connected.
  async getCursorPosition(): Promise<string> {
    const s = getVSCodeLiveState();
    if (isLiveStateFresh(Date.now()) && typeof s.line === 'number') {
      return `Cursor at ${s.file ?? 'unknown file'}:${s.line}:${s.column ?? 0}`;
    }
    return "Live cursor position requires the KashinAI VS Code companion extension to be connected.";
  }

  async readSelectedCode(): Promise<string> {
    const s = getVSCodeLiveState();
    if (isLiveStateFresh(Date.now()) && s.selectedText) {
      return s.selectedText;
    }
    return "No selected code available — connect the KashinAI VS Code companion extension.";
  }
}