import { log } from '../utils/logger';
import { ToolDefinition } from '../types';
import type { MemoryService } from '../memory/MemoryService';

export type ToolCategory =
  | 'vscode'
  | 'github'
  | 'gmail'
  | 'calendar'
  | 'notion'
  | 'slack'
  | 'browser'
  | 'gdrive'
  | 'jira'
  | 'linear'
  | 'notify'
  | 'system';

interface RegisteredTool {
  category: ToolCategory;
  def: ToolDefinition;
}

const CATEGORY_KEYWORDS: Record<ToolCategory, string[]> = {
  vscode: ['vscode', 'vs code', 'editor', 'cursor position', 'selected code', 'workspace', 'ide', 'code file'],
  github: ['github', 'repo', 'repository', 'issue', 'pull request', ' pr ', 'pr#', 'commit', 'branch', 'assignee'],
  gmail: ['email', 'gmail', 'inbox', 'mail', 'draft', 'reply to', 'send mail', 'unread'],
  calendar: ['calendar', 'event', 'meeting', 'schedule', 'appointment', 'reschedule', 'agenda'],
  notion: ['notion', 'database', 'notion page'],
  slack: ['slack', 'channel', 'thread', 'dm ', 'workspace message'],
  browser: ['browser', 'website', 'webpage', 'web page', 'navigate', 'click', 'fill', 'tab', 'automate', 'scrape'],
  gdrive: ['google drive', 'gdrive', 'drive file', 'my drive', 'google doc', 'spreadsheet'],
  jira: ['jira', 'jira issue', 'jira ticket', 'sprint', 'epic'],
  linear: ['linear', 'linear issue', 'linear ticket'],
  notify: ['telegram', 'discord', 'notify me', 'send a notification', 'ping me'],
  system: ['folder', 'directory', 'mkdir', 'open url', 'open link'],
};

const FALLBACK_TOOL_NAMES = [
  'vscode_get_current_file',
  'browser_get_current_tab',
  'calendar_read_upcoming',
];

const MAX_TOOLS_PER_REQUEST = 12;

const TOOL_KEYWORDS: Record<string, string[]> = {
  // system
  open_browser_url: ['open in browser', 'open the website', 'open this url', 'open link'],
  create_directory: ['create folder', 'make a directory', 'new folder', 'mkdir'],

  // vscode
  open_vscode_file: ['open in a new vscode window', 'launch vscode', 'open with the code cli', 'open a new vscode'],
  vscode_open_file: ['open this file in vscode', 'open in my current vscode window', 'open in the editor'],
  vscode_get_workspace: ['workspace path', 'current workspace', 'which workspace'],
  vscode_get_current_file: ['current file', 'which file is open', 'open file name'],
  vscode_get_cursor_position: ['cursor position', 'where is my cursor'],
  vscode_read_selected_code: ['selected code', 'highlighted code', 'my selection'],

  // github
  create_github_issue: ['create an issue', 'open an issue', 'file an issue', 'new issue'],
  github_read_issues: ['read issues', 'list issues', 'show issues', 'recent issues'],
  github_read_prs: ['read prs', 'list prs', 'show pull requests', 'recent prs', 'pull requests'],
  github_pr_comment: ['comment on the pr', 'comment on pr', 'pr comment'],
  github_assign_issue: ['assign issue', 'assign this issue'],
  github_close_issue: ['close issue', 'close this issue'],
  github_reopen_issue: ['reopen issue', 'reopen this issue'],

  // gmail
  create_gmail_draft: ['draft an email', 'create a draft', 'draft email', 'save as draft'],
  send_email: ['send an email', 'send email', 'send mail', 'send this email'],
  search_emails: ['search email', 'find an email', 'search inbox', 'find email about'],
  read_recent_emails: ['recent emails', 'check my email', 'check inbox', 'read my email', 'unread emails'],
  reply_to_email: ['reply to', 'reply to email', 'reply to this', 'respond to email'],

  // calendar
  create_calendar_event: ['create event', 'schedule a meeting', 'add event', 'book a meeting', 'new event'],
  calendar_read_upcoming: ['upcoming events', "what's on my calendar", 'whats on my calendar', 'next meeting', 'my schedule'],
  calendar_update_time: ['reschedule', 'change the time', 'move the meeting', 'update event time'],
  calendar_delete_event: ['delete event', 'cancel event', 'cancel the meeting', 'remove event'],

  // notion
  create_notion_page: ['create a page', 'new notion page', 'add a page'],
  notion_search_pages: ['search notion', 'find page', 'search pages'],
  notion_read_page: ['read page', 'open notion page', 'read this page'],
  notion_edit_page: ['append to page', 'add to page', 'edit page', 'update page text'],
  notion_update_database: ['rename database', 'update database title'],

  // slack
  send_slack_message: ['send a message', 'send message to', 'post in slack', 'post a message', 'message the channel', 'send this to slack', 'saying:'],
  slack_reply_thread: ['reply in slack', 'reply to thread', 'reply on slack'],
  slack_read_recent: ['recent slack messages', 'check slack', 'read slack channel'],
  slack_search_channels: ['find channel', 'search channel'],
  slack_search_conversations: ['search slack', 'find message in slack', 'search conversations'],

  // browser automation
  browser_navigate: ['navigate the browser', 'automate', 'go to this page and'],
  browser_read_content: ['read the page', 'what does this page say', 'read page content'],
  browser_click: ['click on', 'click the button', 'click "'],
  browser_fill: ['fill in', 'type into', 'fill the form', 'enter text into'],
  browser_close: ['close the browser', 'close browser session'],
  browser_get_current_tab: ['current tab', 'which tab', 'active tab'],
  browser_open_new_tab: ['open new tab', 'new tab'],
  browser_close_tab: ['close tab', 'close this tab'],

  // gdrive
  gdrive_search_files: ['search drive', 'find in drive', 'google drive file', 'search google drive'],
  gdrive_read_file: ['read drive file', 'open drive file', 'read the google doc'],

  // jira
  jira_search_issues: ['search jira', 'find jira issue', 'jira tickets'],
  jira_read_issue: ['read jira issue', 'show jira issue', 'jira issue details'],
  jira_create_issue: ['create jira issue', 'new jira ticket', 'file a jira issue'],
  jira_comment_issue: ['comment on jira', 'add jira comment'],

  // linear
  linear_search_issues: ['search linear', 'find linear issue', 'linear tickets'],
  linear_create_issue: ['create linear issue', 'new linear ticket'],

  // notify
  send_telegram_message: ['send telegram', 'telegram me', 'notify on telegram'],
  send_discord_message: ['send discord', 'discord me', 'notify on discord', 'post to discord'],
};

const MULTI_INTENT_SIGNALS = [' and then ', ' then ', ' also ', ' aur ', ' phir ', 'uske baad', 'as well as'];

function hasMultiIntentSignal(lower: string): boolean {
  return MULTI_INTENT_SIGNALS.some((sig) => lower.includes(sig));
}

export const TOOL_REGISTRY: RegisteredTool[] = [
  // ---------- system ----------
  {
    category: 'system',
    def: {
      name: 'open_browser_url',
      description: "Open a URL in the user's default web browser.",
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to open (must include http/https)' } },
        required: ['url'],
      },
    },
  },
  {
    category: 'system',
    def: {
      name: 'create_directory',
      description: "Create a new directory inside the user's home folder.",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path/name of the folder to create' } },
        required: ['path'],
      },
    },
  },

  // ---------- vscode ----------
  // These two are NOT duplicates despite near-identical original wording —
  // they hit different code paths in ActionExecutor:
  //   open_vscode_file -> shells out to the `code` CLI (works standalone,
  //                       opens a new window if none is running)
  //   vscode_open_file -> goes through the live VSCodeIntegration connection
  //                       (same channel as vscode_get_current_file etc.,
  //                       opens in the already-running connected window)
  {
    category: 'vscode',
    def: {
      name: 'open_vscode_file',
      description: "Open a file or folder in VS Code via the 'code' CLI command. Launches a new window if none is open; does not require the live VS Code companion connection.",
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Path to the file or folder to open' } },
        required: ['filePath'],
      },
    },
  },
  {
    category: 'vscode',
    def: {
      name: 'vscode_open_file',
      description: 'Open a file in the currently active, already-running VS Code window via the live VS Code companion connection.',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Path to the file or folder to open' } },
        required: ['filePath'],
      },
    },
  },
  {
    category: 'vscode',
    def: { name: 'vscode_get_workspace', description: 'Get the path of the currently active VS Code workspace.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'vscode',
    def: { name: 'vscode_get_current_file', description: 'Get the path of the most recently opened file in VS Code.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'vscode',
    def: { name: 'vscode_get_cursor_position', description: 'Get the live cursor position in VS Code.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'vscode',
    def: { name: 'vscode_read_selected_code', description: 'Read the currently highlighted/selected code in VS Code.', parameters: { type: 'object', properties: {} } },
  },

  // ---------- github ----------
  {
    category: 'github',
    def: {
      name: 'create_github_issue',
      description: 'Create an issue in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'owner/repo' },
          title: { type: 'string', description: 'Title of the issue' },
          body: { type: 'string', description: 'Body content of the issue' },
        },
        required: ['repo', 'title'],
      },
    },
  },
  {
    category: 'github',
    def: { name: 'github_read_issues', description: 'Read the 5 most recent open issues in a repo.', parameters: { type: 'object', properties: { repo: { type: 'string', description: 'owner/repo' } }, required: ['repo'] } },
  },
  {
    category: 'github',
    def: { name: 'github_read_prs', description: 'Read the 5 most recent open PRs in a repo.', parameters: { type: 'object', properties: { repo: { type: 'string', description: 'owner/repo' } }, required: ['repo'] } },
  },
  {
    category: 'github',
    def: {
      name: 'github_pr_comment',
      description: 'Add a comment to a specific pull request.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'owner/repo' },
          prNumber: { type: 'number', description: 'The pull request number' },
          body: { type: 'string', description: 'The comment text' },
        },
        required: ['repo', 'prNumber', 'body'],
      },
    },
  },
  {
    category: 'github',
    def: {
      name: 'github_assign_issue',
      description: 'Assign a GitHub issue to a user.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'owner/repo' },
          issueNumber: { type: 'number', description: 'The issue number' },
          assignee: { type: 'string', description: 'GitHub username to assign' },
        },
        required: ['repo', 'issueNumber', 'assignee'],
      },
    },
  },
  {
    category: 'github',
    def: {
      name: 'github_close_issue',
      description: 'Close an issue in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: 'owner/repo' }, issueNumber: { type: 'number', description: 'The issue number to close' } },
        required: ['repo', 'issueNumber'],
      },
    },
  },
  {
    category: 'github',
    def: {
      name: 'github_reopen_issue',
      description: 'Reopen a closed issue in a GitHub repository.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: 'owner/repo' }, issueNumber: { type: 'number', description: 'The issue number to reopen' } },
        required: ['repo', 'issueNumber'],
      },
    },
  },

  // ---------- gmail ----------
  {
    category: 'gmail',
    def: {
      name: 'create_gmail_draft',
      description: "Create a draft email in the user's Gmail account.",
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Subject of the email' },
          body: { type: 'string', description: 'Body text of the email' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    category: 'gmail',
    def: {
      name: 'send_email',
      description: "Send an email directly from the user's Gmail account.",
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Subject of the email' },
          body: { type: 'string', description: 'Body text of the email' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    category: 'gmail',
    def: { name: 'search_emails', description: "Search the user's Gmail inbox.", parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query, e.g. "from:x subject:y"' } }, required: ['query'] } },
  },
  {
    category: 'gmail',
    def: { name: 'read_recent_emails', description: 'Read the 5 most recent emails in the inbox.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'gmail',
    def: {
      name: 'reply_to_email',
      description: 'Reply to a specific email in a Gmail thread.',
      parameters: {
        type: 'object',
        properties: { messageId: { type: 'string', description: 'ID of the email message to reply to' }, body: { type: 'string', description: 'Body text of the reply' } },
        required: ['messageId', 'body'],
      },
    },
  },

  // ---------- calendar ----------
  {
    category: 'calendar',
    def: {
      name: 'create_calendar_event',
      description: "Create an event on the user's primary Google Calendar.",
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Title of the event' },
          startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
          endTime: { type: 'string', description: 'End time in ISO 8601 format' },
        },
        required: ['summary', 'startTime', 'endTime'],
      },
    },
  },
  {
    category: 'calendar',
    def: { name: 'calendar_read_upcoming', description: 'Read the 5 most upcoming calendar events.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'calendar',
    def: {
      name: 'calendar_update_time',
      description: 'Update the start/end time of a calendar event.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to update' },
          startTime: { type: 'string', description: 'New start time in ISO 8601 format' },
          endTime: { type: 'string', description: 'New end time in ISO 8601 format' },
        },
        required: ['eventId', 'startTime', 'endTime'],
      },
    },
  },
  {
    category: 'calendar',
    def: { name: 'calendar_delete_event', description: 'Delete a calendar event.', parameters: { type: 'object', properties: { eventId: { type: 'string', description: 'ID of the event to delete' } }, required: ['eventId'] } },
  },

  // ---------- notion ----------
  {
    category: 'notion',
    def: {
      name: 'create_notion_page',
      description: 'Create a new page in a Notion database.',
      parameters: {
        type: 'object',
        properties: { databaseId: { type: 'string', description: 'ID of the Notion database' }, title: { type: 'string', description: 'Title of the new page' } },
        required: ['databaseId', 'title'],
      },
    },
  },
  {
    category: 'notion',
    def: { name: 'notion_search_pages', description: "Search the user's Notion workspace.", parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
  },
  {
    category: 'notion',
    def: { name: 'notion_read_page', description: 'Read the text content of a Notion page.', parameters: { type: 'object', properties: { pageId: { type: 'string', description: 'ID of the Notion page' } }, required: ['pageId'] } },
  },
  {
    category: 'notion',
    def: {
      name: 'notion_edit_page',
      description: 'Append a paragraph of text to a Notion page.',
      parameters: {
        type: 'object',
        properties: { pageId: { type: 'string', description: 'ID of the Notion page to edit' }, text: { type: 'string', description: 'Text to append to the page' } },
        required: ['pageId', 'text'],
      },
    },
  },
  {
    category: 'notion',
    def: {
      name: 'notion_update_database',
      description: 'Update the title of a Notion database.',
      parameters: {
        type: 'object',
        properties: { databaseId: { type: 'string', description: 'ID of the Notion database' }, newTitle: { type: 'string', description: 'New title for the database' } },
        required: ['databaseId', 'newTitle'],
      },
    },
  },

  // ---------- slack ----------
  {
    category: 'slack',
    def: {
      name: 'send_slack_message',
      description: 'Post a new message to a Slack channel (not a reply — for replying to an existing thread use slack_reply_thread).',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name or ID' },
          message: { type: 'string', description: 'The message text to post' },
        },
        required: ['channel', 'message'],
      },
    },
  },
  {
    category: 'slack',
    def: {
      name: 'slack_reply_thread',
      description: 'Reply to a message thread in Slack.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name or ID' },
          threadTs: { type: 'string', description: 'Timestamp (ts) of the parent message' },
          message: { type: 'string', description: 'The reply text' },
        },
        required: ['channel', 'threadTs', 'message'],
      },
    },
  },
  {
    category: 'slack',
    def: { name: 'slack_read_recent', description: 'Read the 5 most recent messages in a Slack channel.', parameters: { type: 'object', properties: { channel: { type: 'string', description: 'Channel name or ID' } }, required: ['channel'] } },
  },
  {
    category: 'slack',
    def: { name: 'slack_search_channels', description: 'Search for Slack channels by name.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Channel name to search for' } }, required: ['query'] } },
  },
  {
    category: 'slack',
    def: { name: 'slack_search_conversations', description: 'Search for messages across all Slack conversations.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query, e.g. "deploy failed"' } }, required: ['query'] } },
  },

  // ---------- browser automation ----------
  {
    category: 'browser',
    def: { name: 'browser_navigate', description: 'Navigate the automated browser to a URL.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The URL to visit' } }, required: ['url'] } },
  },
  {
    category: 'browser',
    def: { name: 'browser_read_content', description: 'Read the visible text of the current browser page.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'browser',
    def: { name: 'browser_click', description: 'Click an element on the current page.', parameters: { type: 'object', properties: { selector: { type: 'string', description: 'Playwright CSS or text selector' } }, required: ['selector'] } },
  },
  {
    category: 'browser',
    def: {
      name: 'browser_fill',
      description: 'Fill an input field on the current page.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string', description: 'Playwright CSS selector for the input field' }, value: { type: 'string', description: 'Text to type into the field' } },
        required: ['selector', 'value'],
      },
    },
  },
  {
    category: 'browser',
    def: { name: 'browser_close', description: 'Close the automated browser session.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'browser',
    def: { name: 'browser_get_current_tab', description: 'Get the title and URL of the active browser tab.', parameters: { type: 'object', properties: {} } },
  },
  {
    category: 'browser',
    def: { name: 'browser_open_new_tab', description: 'Open a new tab and navigate to a URL.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to open in the new tab' } }, required: ['url'] } },
  },
  {
    category: 'browser',
    def: { name: 'browser_close_tab', description: 'Close the active browser tab.', parameters: { type: 'object', properties: {} } },
  },

  // ---------- google drive (read-only) ----------
  {
    category: 'gdrive',
    def: {
      name: 'gdrive_search_files',
      description: "Search the user's Google Drive by file name.",
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Text to match in file names' } }, required: ['query'] },
    },
  },
  {
    category: 'gdrive',
    def: {
      name: 'gdrive_read_file',
      description: 'Read the text content of a Google Drive file (Docs exported as text).',
      parameters: { type: 'object', properties: { fileId: { type: 'string', description: 'The Drive file ID' } }, required: ['fileId'] },
    },
  },

  // ---------- jira ----------
  {
    category: 'jira',
    def: {
      name: 'jira_search_issues',
      description: 'Search Jira issues by text or JQL.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Free text or a JQL query' } }, required: ['query'] },
    },
  },
  {
    category: 'jira',
    def: {
      name: 'jira_read_issue',
      description: 'Read a Jira issue by key (e.g. ABC-123).',
      parameters: { type: 'object', properties: { issueKey: { type: 'string', description: 'Issue key, e.g. ABC-123' } }, required: ['issueKey'] },
    },
  },
  {
    category: 'jira',
    def: {
      name: 'jira_create_issue',
      description: 'Create a Jira issue (Task) in a project.',
      parameters: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'Project key, e.g. ABC' },
          summary: { type: 'string', description: 'Issue summary/title' },
          description: { type: 'string', description: 'Issue description' },
        },
        required: ['projectKey', 'summary'],
      },
    },
  },
  {
    category: 'jira',
    def: {
      name: 'jira_comment_issue',
      description: 'Add a comment to a Jira issue.',
      parameters: {
        type: 'object',
        properties: { issueKey: { type: 'string', description: 'Issue key, e.g. ABC-123' }, comment: { type: 'string', description: 'Comment text' } },
        required: ['issueKey', 'comment'],
      },
    },
  },

  // ---------- linear ----------
  {
    category: 'linear',
    def: {
      name: 'linear_search_issues',
      description: 'Search Linear issues by title.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Text to match in issue titles' } }, required: ['query'] },
    },
  },
  {
    category: 'linear',
    def: {
      name: 'linear_create_issue',
      description: 'Create a Linear issue in a team.',
      parameters: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Linear team ID' },
          title: { type: 'string', description: 'Issue title' },
          description: { type: 'string', description: 'Issue description' },
        },
        required: ['teamId', 'title'],
      },
    },
  },

  // ---------- notifications ----------
  {
    category: 'notify',
    def: {
      name: 'send_telegram_message',
      description: 'Send a notification message to the configured Telegram chat.',
      parameters: { type: 'object', properties: { message: { type: 'string', description: 'The message text' } }, required: ['message'] },
    },
  },
  {
    category: 'notify',
    def: {
      name: 'send_discord_message',
      description: 'Send a notification message to the configured Discord channel (webhook).',
      parameters: { type: 'object', properties: { message: { type: 'string', description: 'The message text' } }, required: ['message'] },
    },
  },
];

/**
 * Two-tier selection:
 *
 * Tier 1 (tool-level): score every individual tool against TOOL_KEYWORDS.
 * If exactly one tool is the clear top scorer AND the prompt doesn't look
 * like a multi-step ask, send just that ONE tool.
 *
 * Tier 2 (category-level, the old behaviour): used whenever tier 1 is
 * ambiguous (a tie at the top), multi-intent, or nothing matched at the
 * tool level — widen to the matched categories instead of guessing wrong.
 */
export function selectRelevantTools(prompt: string): ToolDefinition[] {
  const lower = prompt.toLowerCase();

  const toolScores = TOOL_REGISTRY.map((t) => ({
    tool: t,
    hits: (TOOL_KEYWORDS[t.def.name] || []).filter((kw) => lower.includes(kw)).length,
  }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (toolScores.length > 0) {
    const topHits = toolScores[0].hits;
    const contenders = toolScores.filter((s) => s.hits === topHits);

    if (contenders.length === 1 && !hasMultiIntentSignal(lower)) {
      // Confident single match — this is the token-minimal path.
      return [contenders[0].tool.def];
    }

    // Ambiguous (tie at top) or multi-intent — send the top few instead of
    // guessing which single tool is right.
    return toolScores.slice(0, Math.min(toolScores.length, 4)).map((s) => s.tool.def);
  }

  // Nothing matched at the tool level — fall back to the broader
  // category net (same behaviour as before this change).
  return selectByCategory(lower);
}

function selectByCategory(lower: string): ToolDefinition[] {
  const scored = (Object.keys(CATEGORY_KEYWORDS) as ToolCategory[])
    .map((cat) => ({ cat, hits: CATEGORY_KEYWORDS[cat].filter((kw) => lower.includes(kw)).length }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) {
    return TOOL_REGISTRY.filter((t) => FALLBACK_TOOL_NAMES.includes(t.def.name)).map((t) => t.def);
  }

  const matchedCategories = new Set(scored.map((s) => s.cat));
  const selected = TOOL_REGISTRY.filter((t) => matchedCategories.has(t.category)).map((t) => t.def);

  return selected.length > MAX_TOOLS_PER_REQUEST ? selected.slice(0, MAX_TOOLS_PER_REQUEST) : selected;
}

// ---------------------------------------------------------------------
// Semantic selection (embedding-based, on top of the keyword tiers above)
// ---------------------------------------------------------------------

/** name+description text embedded once per tool to build the LanceDB tool index. */
export function getToolEmbeddingCorpus(): { name: string; text: string }[] {
  return TOOL_REGISTRY.map((t) => ({ name: t.def.name, text: `${t.def.name}: ${t.def.description}` }));
}

export function getToolDefByName(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.def.name === name)?.def;
}

const SEMANTIC_CONFIDENCE_GAP = 0.05;

const SEMANTIC_RELEVANCE_FLOOR = 1.3;

export async function selectRelevantToolsSemantic(
  memoryService: MemoryService,
  prompt: string
): Promise<ToolDefinition[]> {
  const lower = prompt.toLowerCase();

  try {
    const results = await memoryService.searchTools(prompt, 6);

    if (results.length === 0) {

      return selectRelevantTools(prompt);
    }

    const sorted = [...results].sort((a, b) => a.distance - b.distance);
    log.info('[toolRegistry] Semantic tool distances:', sorted.map((r) => `${r.name}:${r.distance.toFixed(3)}`).join(', '));

    const top = sorted[0];

    if (top.distance > SEMANTIC_RELEVANCE_FLOOR) {
 
      log.info(`[toolRegistry] Top match ${top.name} (${top.distance.toFixed(3)}) is past the relevance floor (${SEMANTIC_RELEVANCE_FLOOR}) — sending no tools.`);
      return [];
    }

    const second = sorted[1];
    const confidentSingle = second === undefined || second.distance - top.distance > SEMANTIC_CONFIDENCE_GAP;

    if (confidentSingle && !hasMultiIntentSignal(lower)) {
      const def = getToolDefByName(top.name);
      return def ? [def] : selectRelevantTools(prompt);
    }

    // Ambiguous or multi-intent — widen to the top few instead of guessing.
    const widened = sorted
      .slice(0, Math.min(sorted.length, 4))
      .map((r) => getToolDefByName(r.name))
      .filter((d): d is ToolDefinition => !!d);

    return widened.length > 0 ? widened : selectRelevantTools(prompt);
  } catch (error) {
    log.error('[toolRegistry] Semantic tool selection failed, falling back to keywords:', error);
    return selectRelevantTools(prompt);
  }
}