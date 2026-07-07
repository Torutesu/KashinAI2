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
    const context = await this.retriever.retrieveContext(prompt);
    
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
      }
    ];

    const history: LLMHistoryMessage[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await this.llm.generateResponse(prompt, context, history, tools);

    if (response.toolCalls.length > 0) {
      let executionResults = "I executed the following actions:\n";
      
      for (const call of response.toolCalls) {
        console.log(`[Orchestrator] Executing tool: ${call.name} with args:`, call.args);
        const result = await this.actionExecutor.execute(call.name, call.args);
        executionResults += `- ${call.name}: ${result}\n`;
      }

      return executionResults;
    }

    return response.text || "I couldn't process that request.";
  }
}