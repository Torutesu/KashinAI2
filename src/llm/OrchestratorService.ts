// src/llm/OrchestratorService.ts
import { RetrieverService } from '../retriever/RetrieverService';
import { LLMProvider } from '../types';
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
    // 1. Retrieve Context
    const context = await this.retriever.retrieveContext(prompt);
    
    // 2. Define Available Tools
    const tools = [
      {
        name: 'open_browser_url',
        description: 'Open a specific URL in the user\'s default web browser.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to open' }
          },
          required: ['url']
        }
      },
      {
        name: 'execute_terminal_command',
        description: 'Execute a terminal command on the user\'s local machine.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The terminal command to run' }
          },
          required: ['command']
        }
      }
    ];

    // 3. Send to LLM
    const history: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await this.llm.generateResponse(prompt, context, history, tools);

    // 4. Check if LLM wants to execute an action
    if (response.toolCalls.length > 0) {
      let executionResults = "I executed the following actions:\n";
      
      for (const call of response.toolCalls) {
        console.log(`[Orchestrator] Executing tool: ${call.name} with args:`, call.args);
        
        // Execute the action
        const result = await this.actionExecutor.execute(call.name, call.args);
        executionResults += `- ${call.name}: ${result}\n`;
      }

      // Optional: Send the tool results back to the LLM for a final summary
      // For MVP, we will just return the execution results directly to the frontend.
      return executionResults;
    }

    // 5. If no tool calls, just return the text
    return response.text || "I couldn't process that request.";
  }
}