// src/llm/OrchestratorService.ts
import { RetrieverService } from '../retriever/RetrieverService';
import { LLMProvider, ToolDefinition, LLMHistoryMessage, ToolCall } from '../types';
import { ActionExecutor } from '../actions/ActionExecutor';

// Actions that mutate external state / send irreversible things — require explicit confirm
const DESTRUCTIVE_TOOLS = new Set([
  'send_email',
  'reply_to_email',
  'send_slack_message',
  'slack_reply_thread',
  'create_github_issue',
  'github_pr_comment',
  'github_assign_issue',
  'github_close_issue',
  'github_reopen_issue',
  'create_notion_page',
  'notion_edit_page',
  'notion_update_database',
  'create_calendar_event',
  'calendar_update_time',
  'calendar_delete_event',
  'create_directory',
]);

const AFFIRM = new Set(['yes', 'y', 'confirm', 'haan', 'ha', 'go ahead', 'do it']);
const DENY = new Set(['no', 'n', 'cancel', 'nahi', 'stop']);

export class OrchestratorService {
  private actionExecutor: ActionExecutor;
  private pendingCalls: ToolCall[] | null = null;

  constructor(
    private retriever: RetrieverService,
    private llm: LLMProvider
  ) {
    this.actionExecutor = new ActionExecutor();
  }

  async processPrompt(prompt: string): Promise<string> {
    // 0. Handle a pending confirmation from the previous turn
    if (this.pendingCalls) {
      const normalized = prompt.trim().toLowerCase();
      if (AFFIRM.has(normalized)) {
        const calls = this.pendingCalls;
        this.pendingCalls = null;
        return this.runToolCalls(calls);
      }
      if (DENY.has(normalized)) {
        this.pendingCalls = null;
        return "Okay, cancelled. Nothing was executed.";
      }
      return `I still need a yes/no on the pending action(s):\n${this.describeCalls(this.pendingCalls)}\nReply "yes" to proceed or "no" to cancel.`;
    }

    // 1. Retrieve Context from SQLite
    const context = await this.retriever.retrieveContext(prompt);

    // 2. Define Available Tools for the LLM
    const tools: ToolDefinition[] = [
      {
        name: 'open_browser_url',
        description: 'Open a specific URL in the user\'s default web browser.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to open (must include http/https)' }
          },
          required: ['url']
        }
      },
      {
        name: 'create_directory',
        description: 'Safely create a new directory inside the user\'s home folder.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The path/name of the folder to create' }
          },
          required: ['path']
        }
      },
      {
        name: 'open_vscode_file',
        description: 'Open a specific file or folder in VS Code.',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'The path to the file or folder to open' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'vscode_open_file',
        description: 'Open a specific file or folder in VS Code.',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'The path to the file or folder to open' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'vscode_get_workspace',
        description: 'Get the path of the currently active VS Code workspace.',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'vscode_get_current_file',
        description: 'Get the path of the most recently opened file in VS Code.',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'vscode_get_cursor_position',
        description: 'Get the live cursor position in VS Code.',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'vscode_read_selected_code',
        description: 'Read the currently highlighted/selected code in VS Code.',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'create_github_issue',
        description: 'Create an issue in a GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format (e.g. octocat/hello-world)' },
            title: { type: 'string', description: 'The title of the issue' },
            body: { type: 'string', description: 'The body content of the issue' }
          },
          required: ['repo', 'title']
        }
      },
      {
        name: 'create_gmail_draft',
        description: 'Create a draft email in the user\'s Gmail account.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Email address of the recipient' },
            subject: { type: 'string', description: 'Subject of the email' },
            body: { type: 'string', description: 'Body text of the email' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'create_calendar_event',
        description: 'Create an event on the user\'s primary Google Calendar.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Title of the event' },
            startTime: { type: 'string', description: 'Start time in ISO 8601 format (e.g. 2026-07-07T10:00:00-07:00)' },
            endTime: { type: 'string', description: 'End time in ISO 8601 format (e.g. 2026-07-07T11:00:00-07:00)' }
          },
          required: ['summary', 'startTime', 'endTime']
        }
      },
      // 👇 yahan add karo
      {
        name: 'calendar_read_upcoming',
        description: 'Read the 5 most upcoming events on the user\'s Google Calendar.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'calendar_update_time',
        description: 'Update the start and end time of a specific Google Calendar event.',
        parameters: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'The ID of the event to update' },
            startTime: { type: 'string', description: 'New start time in ISO 8601 format' },
            endTime: { type: 'string', description: 'New end time in ISO 8601 format' }
          },
          required: ['eventId', 'startTime', 'endTime']
        }
      },
      {
        name: 'calendar_delete_event',
        description: 'Delete an event from the user\'s Google Calendar.',
        parameters: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'The ID of the event to delete' }
          },
          required: ['eventId']
        }
      },
      {
        name: 'create_notion_page',
        description: 'Create a new page in a Notion database.',
        parameters: {
          type: 'object',
          properties: {
            databaseId: { type: 'string', description: 'The ID of the Notion database' },
            title: { type: 'string', description: 'The title of the new page' }
          },
          required: ['databaseId', 'title']
        }
      },
      {
        name: 'browser_navigate',
        description: 'Navigate the automated browser to a specific URL.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to visit' }
          },
          required: ['url']
        }
      },
      {
        name: 'browser_read_content',
        description: 'Read the visible text content of the currently open browser page.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'browser_click',
        description: 'Click an element on the current browser page.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Playwright CSS or Text selector (e.g. "text=Login" or "button#submit")' }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_fill',
        description: 'Fill an input field on the current browser page.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Playwright CSS selector for the input field' },
            value: { type: 'string', description: 'The text to type into the field' }
          },
          required: ['selector', 'value']
        }
      },
      {
        name: 'browser_close',
        description: 'Close the automated browser session.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'browser_get_current_tab',
        description: 'Get the title and URL of the currently active browser tab.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'browser_open_new_tab',
        description: 'Open a new tab in the browser and navigate to a URL.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to open in the new tab' }
          },
          required: ['url']
        }
      },
      {
        name: 'browser_close_tab',
        description: 'Close the currently active browser tab.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },

      {
        name: 'send_email',
        description: 'Send an email directly from the user\'s Gmail account.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Email address of the recipient' },
            subject: { type: 'string', description: 'Subject of the email' },
            body: { type: 'string', description: 'Body text of the email' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'search_emails',
        description: 'Search the user\'s Gmail inbox for specific emails.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query (e.g. "from:elon@musk.com subject:rocket" or "meeting notes")' }
          },
          required: ['query']
        }
      },
      {
        name: 'read_recent_emails',
        description: 'Read the 5 most recent emails in the user\'s Gmail inbox.',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'reply_to_email',
        description: 'Reply to a specific email in a Gmail thread.',
        parameters: {
          type: 'object',
          properties: {
            messageId: { type: 'string', description: 'The ID of the email message to reply to' },
            body: { type: 'string', description: 'The body text of the reply' }
          },
          required: ['messageId', 'body']
        }
      },
      {
        name: 'slack_reply_thread',
        description: 'Reply to a specific message thread in Slack.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name or ID' },
            threadTs: { type: 'string', description: 'The timestamp (ts) of the parent message' },
            message: { type: 'string', description: 'The reply text' }
          },
          required: ['channel', 'threadTs', 'message']
        }
      },
      {
        name: 'slack_read_recent',
        description: 'Read the 5 most recent messages in a Slack channel.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name or ID' }
          },
          required: ['channel']
        }
      },
      {
        name: 'slack_search_channels',
        description: 'Search for Slack channels by name.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The channel name to search for' }
          },
          required: ['query']
        }
      },
      {
        name: 'slack_search_conversations',
        description: 'Search for specific messages across all Slack conversations.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query (e.g. "deploy failed")' }
          },
          required: ['query']
        }
      },
      {
        name: 'github_read_issues',
        description: 'Read the 5 most recent open issues in a GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' }
          },
          required: ['repo']
        }
      },
      {
        name: 'github_read_prs',
        description: 'Read the 5 most recent open pull requests in a GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' }
          },
          required: ['repo']
        }
      },
      {
        name: 'github_pr_comment',
        description: 'Add a comment to a specific pull request.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' },
            prNumber: { type: 'number', description: 'The pull request number' },
            body: { type: 'string', description: 'The comment text' }
          },
          required: ['repo', 'prNumber', 'body']
        }
      },
      {
        name: 'github_assign_issue',
        description: 'Assign a GitHub issue to a user.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' },
            issueNumber: { type: 'number', description: 'The issue number' },
            assignee: { type: 'string', description: 'The GitHub username to assign the issue to' }
          },
          required: ['repo', 'issueNumber', 'assignee']
        }
      },
      {
        name: 'github_close_issue',
        description: 'Close an existing issue in a GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' },
            issueNumber: { type: 'number', description: 'The issue number to close' }
          },
          required: ['repo', 'issueNumber']
        }
      },
      {
        name: 'github_reopen_issue',
        description: 'Reopen a closed issue in a GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The repository in owner/repo format' },
            issueNumber: { type: 'number', description: 'The issue number to reopen' }
          },
          required: ['repo', 'issueNumber']
        }
      },
      {
        name: 'notion_search_pages',
        description: 'Search for pages in the user\'s Notion workspace.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' }
          },
          required: ['query']
        }
      },
      {
        name: 'notion_read_page',
        description: 'Read the text content of a specific Notion page.',
        parameters: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'The ID of the Notion page' }
          },
          required: ['pageId']
        }
      },
      {
        name: 'notion_edit_page',
        description: 'Append a new paragraph of text to an existing Notion page.',
        parameters: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'The ID of the Notion page to edit' },
            text: { type: 'string', description: 'The text to append to the page' }
          },
          required: ['pageId', 'text']
        }
      },
      {
        name: 'notion_update_database',
        description: 'Update the title of a Notion database.',
        parameters: {
          type: 'object',
          properties: {
            databaseId: { type: 'string', description: 'The ID of the Notion database' },
            newTitle: { type: 'string', description: 'The new title for the database' }
          },
          required: ['databaseId', 'newTitle']
        }
      }
    ];

    // 3. Send to LLM
    const history: LLMHistoryMessage[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await this.llm.generateResponse(prompt, context, history, tools);

    if (response.toolCalls.length === 0) {
      return response.text || "I couldn't process that request.";
    }

    // 4. Split safe vs destructive calls
    const safeCalls = response.toolCalls.filter(c => !DESTRUCTIVE_TOOLS.has(c.name));
    const destructiveCalls = response.toolCalls.filter(c => DESTRUCTIVE_TOOLS.has(c.name));

    let output = '';
    if (safeCalls.length > 0) {
      output += await this.runToolCalls(safeCalls);
    }

    if (destructiveCalls.length > 0) {
      this.pendingCalls = destructiveCalls;
      output += `\nThe following action(s) need your confirmation before I run them:\n${this.describeCalls(destructiveCalls)}\nReply "yes" to proceed or "no" to cancel.`;
    }

    return output.trim();
  }

  private async runToolCalls(calls: ToolCall[]): Promise<string> {
    let executionResults = "I executed the following actions:\n";
    for (const call of calls) {
      console.log(`[Orchestrator] Executing tool: ${call.name} with args:`, call.args);
      const result = await this.actionExecutor.execute(call.name, call.args);
      executionResults += `- ${call.name}: ${result}\n`;
    }
    return executionResults;
  }

  private describeCalls(calls: ToolCall[]): string {
    return calls.map(c => `- ${c.name}(${JSON.stringify(c.args)})`).join('\n');
  }
}