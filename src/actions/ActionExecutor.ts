// src/actions/ActionExecutor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ActionExecutor {
  async execute(toolName: string, args: any): Promise<string> {
    try {
      switch (toolName) {
        case 'open_browser_url':
          return await this.openUrl(args.url);
        case 'execute_terminal_command':
          return await this.runCommand(args.command);
        // Future tools: send_slack_message, create_calendar_event, etc.
        default:
          return `Error: Tool '${toolName}' is not supported.`;
      }
    } catch (error) {
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async openUrl(url: string): Promise<string> {
    if (!url) return "Error: No URL provided.";
    
    const platform = process.platform;
    if (platform === 'darwin') await execAsync(`open "${url}"`);
    else if (platform === 'win32') await execAsync(`start "" "${url}"`);
    else if (platform === 'linux') await execAsync(`xdg-open "${url}"`);
    
    return `Successfully opened ${url} in the browser.`;
  }

  private async runCommand(command: string): Promise<string> {
    if (!command) return "Error: No command provided.";
    
    // SECURITY WARNING: In a real app, ask the user for confirmation before running this!
    const { stdout, stderr } = await execAsync(command);
    if (stderr) return `Command executed with warnings: ${stderr}`;
    return `Command executed successfully. Output: ${stdout.substring(0, 500)}`; // Limit output size
  }
}