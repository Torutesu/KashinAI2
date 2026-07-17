// src/actions/ActionExecutor.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { isSafeHttpUrl } from '../security/inputValidation';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { GithubIntegration } from '../integrations/GithubIntegration';
import { GmailIntegration } from '../integrations/GmailIntegration';
import { CalendarIntegration } from '../integrations/CalendarIntegration';
import { NotionIntegration } from '../integrations/NotionIntegration';
import { BrowserAutomationIntegration } from '../integrations/BrowserAutomationIntegration';
import { VSCodeIntegration } from '../integrations/VSCodeIntegration';
import { GoogleDriveIntegration } from '../integrations/GoogleDriveIntegration';
import { JiraIntegration } from '../integrations/JiraIntegration';
import { LinearIntegration } from '../integrations/LinearIntegration';
import { TelegramIntegration } from '../integrations/TelegramIntegration';
import { DiscordIntegration } from '../integrations/DiscordIntegration';
import { NotifyService } from '../integrations/NotifyService';
import { ToolResult, IntegrationError } from '../types/result';

const execFileAsync = promisify(execFile);

export class ActionExecutor {
  private slack: SlackIntegration;
  private github: GithubIntegration;
  private gmail: GmailIntegration;
  private calendar: CalendarIntegration;
  private notion: NotionIntegration;
  private browserAutomation: BrowserAutomationIntegration;
  private vscode: VSCodeIntegration;
  private gdrive: GoogleDriveIntegration;
  private jira: JiraIntegration;
  private linear: LinearIntegration;
  private telegram: TelegramIntegration;
  private discord: DiscordIntegration;
  private notify: NotifyService;

  constructor() {
    this.slack = new SlackIntegration();
    this.github = new GithubIntegration();
    this.gmail = new GmailIntegration();
    this.calendar = new CalendarIntegration();
    this.notion = new NotionIntegration();
    this.browserAutomation = new BrowserAutomationIntegration();
    this.vscode = new VSCodeIntegration();
    this.gdrive = new GoogleDriveIntegration();
    this.jira = new JiraIntegration();
    this.linear = new LinearIntegration();
    this.telegram = new TelegramIntegration();
    this.discord = new DiscordIntegration();
    this.notify = new NotifyService([this.telegram, this.discord]);
  }

  /**
   * Execute a tool and return a typed result. A thrown IntegrationError (or any
   * Error) becomes ok:false; integrations not yet migrated to throwing still use
   * the legacy "Error…" string convention, which is classified as a fallback.
   */
  async execute(toolName: string, args: Record<string, string | number | boolean>): Promise<ToolResult> {
    try {
      const message = await this.executeRaw(toolName, args);
      const ok = !/^\s*error\b/i.test(message);
      if (!ok) this.maybeAlertFailure(toolName, message);
      return { ok, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.maybeAlertFailure(toolName, message);
      return { ok: false, message };
    }
  }

  // Notification tools alert about failures themselves — never alert on their
  // own failure, or a broken channel would recurse.
  private static readonly NOTIFY_TOOLS = new Set(['notify', 'send_telegram_message', 'send_discord_message']);

  /**
   * Proactively notify the user when a tool fails, if NOTIFY_ON_TOOL_FAILURE is
   * enabled and a channel is configured. Fire-and-forget: alerting must never
   * block or throw into the caller, and never recurse on notification tools.
   */
  private maybeAlertFailure(toolName: string, message: string): void {
    if (process.env.NOTIFY_ON_TOOL_FAILURE !== 'true') return;
    if (ActionExecutor.NOTIFY_TOOLS.has(toolName)) return;
    const text = `⚠️ Tool "${toolName}" failed: ${message}`.slice(0, 1000);
    void this.notify.notify(text).catch(() => { /* best-effort; swallow */ });
  }

  private async executeRaw(toolName: string, args: Record<string, string | number | boolean>): Promise<string> {
    switch (toolName) {
        // Local OS Actions
        case 'open_browser_url':
          return await this.openUrl(String(args.url));
        case 'create_directory':
          return await this.createDirectory(String(args.path));
        case 'open_vscode_file':
          return await this.openVsCode(String(args.filePath));

        // Integration Actions (calendar has no duplicate elsewhere, kept here)
        case 'create_calendar_event':
          return await this.calendar.createEvent(String(args.summary), String(args.startTime), String(args.endTime));

        // Browser Automation Actions
        case 'browser_navigate':
          return await this.browserAutomation.navigate(String(args.url));
        case 'browser_click':
          return await this.browserAutomation.click(String(args.selector));
        case 'browser_fill':
          return await this.browserAutomation.fill(String(args.selector), String(args.value));
        case 'browser_read_content':
          return await this.browserAutomation.readContent();
        case 'browser_close':
          return await this.browserAutomation.close();

        // Gmail Actions
        case 'create_gmail_draft':
          return await this.gmail.createDraft(String(args.to), String(args.subject), String(args.body));
        case 'send_email':
          return await this.gmail.sendEmail(String(args.to), String(args.subject), String(args.body));
        case 'search_emails':
          return await this.gmail.searchEmails(String(args.query));
        case 'read_recent_emails':
          return await this.gmail.readRecentEmails();
        case 'reply_to_email':
          return await this.gmail.replyToEmail(String(args.messageId), String(args.body));

        // Slack Actions
        case 'send_slack_message':
          return await this.slack.sendMessage(String(args.channel), String(args.message));
        case 'slack_reply_thread':
          return await this.slack.replyToThread(String(args.channel), String(args.threadTs), String(args.message));
        case 'slack_read_recent':
          return await this.slack.readRecentMessages(String(args.channel));
        case 'slack_search_channels':
          return await this.slack.searchChannels(String(args.query));
        case 'slack_search_conversations':
          return await this.slack.searchConversations(String(args.query));

        // GitHub Actions
        case 'create_github_issue':
          return await this.github.createIssue(String(args.repo), String(args.title), String(args.body || ''));
        case 'github_read_issues':
          return await this.github.readIssues(String(args.repo));
        case 'github_read_prs':
          return await this.github.readPullRequests(String(args.repo));
        case 'github_pr_comment':
          return await this.github.createPRComment(String(args.repo), Number(args.prNumber), String(args.body));
        case 'github_assign_issue':
          return await this.github.assignIssue(String(args.repo), Number(args.issueNumber), String(args.assignee));
        case 'github_close_issue':
          return await this.github.closeIssue(String(args.repo), Number(args.issueNumber));
        case 'github_reopen_issue':
          return await this.github.reopenIssue(String(args.repo), Number(args.issueNumber));

        // Notion Actions
        case 'create_notion_page':
          return await this.notion.createPage(String(args.databaseId), String(args.title));
        case 'notion_search_pages':
          return await this.notion.searchPages(String(args.query));
        case 'notion_read_page':
          return await this.notion.readPage(String(args.pageId));
        case 'notion_edit_page':
          return await this.notion.editPage(String(args.pageId), String(args.text));
        case 'notion_update_database':
          return await this.notion.updateDatabase(String(args.databaseId), String(args.newTitle));

        // Chrome Tab Actions
        case 'browser_get_current_tab':
          return await this.browserAutomation.getCurrentTab();
        case 'browser_open_new_tab':
          return await this.browserAutomation.openNewTab(String(args.url));
        case 'browser_close_tab':
          return await this.browserAutomation.closeTab();

        // Calendar Actions (create_calendar_event handled above)
        case 'calendar_read_upcoming':
          return await this.calendar.readUpcomingEvents();
        case 'calendar_update_time':
          return await this.calendar.updateEventTime(String(args.eventId), String(args.startTime), String(args.endTime));
        case 'calendar_delete_event':
          return await this.calendar.deleteEvent(String(args.eventId));

        // Google Drive (read-only)
        case 'gdrive_search_files': return await this.gdrive.searchFiles(String(args.query));
        case 'gdrive_read_file': return await this.gdrive.readFile(String(args.fileId));

        // Jira
        case 'jira_search_issues': return await this.jira.searchIssues(String(args.query));
        case 'jira_read_issue': return await this.jira.readIssue(String(args.issueKey));
        case 'jira_create_issue': return await this.jira.createIssue(String(args.projectKey), String(args.summary), String(args.description || ''));
        case 'jira_comment_issue': return await this.jira.commentIssue(String(args.issueKey), String(args.comment));

        // Linear
        case 'linear_search_issues': return await this.linear.searchIssues(String(args.query));
        case 'linear_create_issue': return await this.linear.createIssue(String(args.teamId), String(args.title), String(args.description || ''));

        // Notifications
        case 'notify': return await this.notify.notify(String(args.message));
        case 'send_telegram_message': return await this.telegram.sendMessage(String(args.message));
        case 'send_discord_message': return await this.discord.sendMessage(String(args.message));

        // VS Code Actions (NEW)
        case 'vscode_open_file': return await this.vscode.openFile(String(args.filePath));
        case 'vscode_get_workspace': return await this.vscode.getCurrentWorkspace();
        case 'vscode_get_current_file': return await this.vscode.getCurrentFile();
        case 'vscode_get_cursor_position': return await this.vscode.getCursorPosition();
        case 'vscode_read_selected_code': return await this.vscode.readSelectedCode();

        default:
          throw new IntegrationError(`Tool '${toolName}' is not supported.`);
      }
  }

  private async openUrl(url: string): Promise<string> {
    // Validate the scheme (blocks file://, javascript:, etc.) AND pass the URL
    // as a single argv entry via execFile so no shell can interpret it.
    if (!isSafeHttpUrl(url)) {
      throw new IntegrationError('Invalid URL. Must be an http:// or https:// URL.');
    }

    const platform = process.platform;
    if (platform === 'darwin') await execFileAsync('open', [url], { shell: false });
    else if (platform === 'win32') await execFileAsync('rundll32', ['url.dll,FileProtocolHandler', url], { shell: false });
    else if (platform === 'linux') await execFileAsync('xdg-open', [url], { shell: false });

    return `Successfully opened ${url} in the browser.`;
  }

  private async createDirectory(dirPath: string): Promise<string> {
    if (!dirPath) throw new IntegrationError('No path provided.');

    const homeDir = os.homedir();
    const resolvedPath = path.resolve(homeDir, dirPath);

    // Ensure the target stays inside the home directory (path.sep guards
    // against a sibling dir like `/home/userEVIL` matching a `/home/user` prefix).
    if (resolvedPath !== homeDir && !resolvedPath.startsWith(homeDir + path.sep)) {
      throw new IntegrationError('Security violation. Cannot create directories outside your home folder.');
    }

    // No shell — fs.mkdir takes the path literally, so metacharacters are inert.
    await fs.promises.mkdir(resolvedPath, { recursive: true });

    return `Successfully created directory at ${resolvedPath}`;
  }

  private async openVsCode(filePath: string): Promise<string> {
    if (!filePath) throw new IntegrationError('No file path provided.');
    try {
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
}