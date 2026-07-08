// src/actions/ActionExecutor.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { GithubIntegration } from '../integrations/GithubIntegration';
import { GmailIntegration } from '../integrations/GmailIntegration';
import { CalendarIntegration } from '../integrations/CalendarIntegration';

const execAsync = promisify(exec);

export class ActionExecutor {
  private slack: SlackIntegration;
  private github: GithubIntegration;
  private gmail: GmailIntegration;
  private calendar: CalendarIntegration;

  constructor() {
    this.slack = new SlackIntegration();
    this.github = new GithubIntegration();
    this.gmail = new GmailIntegration();
    this.calendar = new CalendarIntegration();
  }

  async execute(toolName: string, args: Record<string, string | number | boolean>): Promise<string> {
    try {
      switch (toolName) {
        // Local OS Actions
        case 'open_browser_url':
          return await this.openUrl(String(args.url));
        case 'create_directory':
          return await this.createDirectory(String(args.path));
        case 'open_vscode_file':
          return await this.openVsCode(String(args.filePath));
          
        // Integration Actions
        case 'send_slack_message':
          return await this.slack.sendMessage(String(args.channel), String(args.message));
        case 'create_github_issue':
          return await this.github.createIssue(String(args.repo), String(args.title), String(args.body || ''));
        case 'create_gmail_draft':
          return await this.gmail.createDraft(String(args.to), String(args.subject), String(args.body));
        case 'create_calendar_event':
          return await this.calendar.createEvent(String(args.summary), String(args.startTime), String(args.endTime));
          
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

  private async createDirectory(dirPath: string): Promise<string> {
    if (!dirPath) return "Error: No path provided.";
    
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

  private async openVsCode(filePath: string): Promise<string> {
    if (!filePath) return "Error: No file path provided.";
    try {
      await execAsync(`code "${filePath}"`);
      return `Successfully opened ${filePath} in VS Code.`;
    } catch (error) {
      return `Error opening VS Code. Ensure the 'code' command is installed in your PATH.`;
    }
  }
}