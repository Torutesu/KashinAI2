// src/actions/ActionExecutor.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export class ActionExecutor {
  async execute(toolName: string, args: Record<string, string | number | boolean>): Promise<string> {
    try {
      switch (toolName) {
        case 'open_browser_url':
          return await this.openUrl(String(args.url));
        case 'create_directory':
          return await this.createDirectory(String(args.path));
        default:
          return `Error: Tool '${toolName}' is not supported.`;
      }
    } catch (error) {
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async openUrl(url: string): Promise<string> {
    if (!url || !url.match(/^https?:\/\//)) {
      return "Error: Invalid URL. Must start with http:// or https://";
    }
    
    const platform = process.platform;
    if (platform === 'darwin') await execAsync(`open "${url}"`);
    else if (platform === 'win32') await execAsync(`start "" "${url}"`);
    else if (platform === 'linux') await execAsync(`xdg-open "${url}"`);
    
    return `Successfully opened ${url} in the browser.`;
  }

  // Safe alternative to arbitrary terminal execution
  private async createDirectory(dirPath: string): Promise<string> {
    if (!dirPath) return "Error: No path provided.";
    
    // Resolve to absolute path and prevent path traversal outside home directory
    const homeDir = os.homedir();
    const resolvedPath = path.resolve(homeDir, dirPath);
    
    if (!resolvedPath.startsWith(homeDir)) {
      return "Error: Security violation. Cannot create directories outside your home folder.";
    }

    const platform = process.platform;
    if (platform === 'win32') {
      await execAsync(`powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${resolvedPath}'"`);
    } else {
      await execAsync(`mkdir -p "${resolvedPath}"`);
    }
    
    return `Successfully created directory at ${resolvedPath}`;
  }
}