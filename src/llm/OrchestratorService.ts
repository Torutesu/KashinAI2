// src/llm/OrchestratorService.ts
import { RetrieverService } from '../retriever/RetrieverService';
import { LLMProvider, ToolDefinition, LLMHistoryMessage } from '../types';
import { ActionExecutor } from '../actions/ActionExecutor';

export class OrchestratorService {
  private actionExecutor: ActionExecutor;

  constructor(
    private retriever: RetrieverService,
    private llm: LLMProvider
  ) {
    this.actionExecutor = new ActionExecutor();
  }

  async processPrompt(prompt: string): Promise<string> {
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
        name: 'send_slack_message',
        description: 'Send a message to a Slack channel.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name or ID (e.g. #general)' },
            message: { type: 'string', description: 'The message text to send' }
          },
          required: ['channel', 'message']
        }
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
      }
    ];

    // 3. Send to LLM
    const history: LLMHistoryMessage[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await this.llm.generateResponse(prompt, context, history, tools);

    // 4. Check if LLM wants to execute an action
    if (response.toolCalls.length > 0) {
      let executionResults = "I executed the following actions:\n";
      
      for (const call of response.toolCalls) {
        console.log(`[Orchestrator] Executing tool: ${call.name} with args:`, call.args);
        const result = await this.actionExecutor.execute(call.name, call.args);
        executionResults += `- ${call.name}: ${result}\n`;
      }

      return executionResults;
    }

    // 5. If no tool calls, just return the text
    return response.text || "I couldn't process that request.";
  }
}