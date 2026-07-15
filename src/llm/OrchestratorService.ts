// src/llm/OrchestratorService.ts
import { RetrieverService } from '../retriever/RetrieverService';
import { LLMProvider, LLMHistoryMessage, ToolCall } from '../types';
import { ActionExecutor } from '../actions/ActionExecutor';
import { MemoryService } from '../memory/MemoryService';
import { selectRelevantToolsSemantic } from './Toolregistry';

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
  // Confirmation state is keyed per session so concurrent callers never mix
  // (one user's "yes" must not execute another user's pending action).
  private pendingCallsBySession: Map<string, ToolCall[]> = new Map();

  constructor(
    private retriever: RetrieverService,
    private llm: LLMProvider,
    private memoryService: MemoryService
  ) {
    this.actionExecutor = new ActionExecutor();
  }

  async processPrompt(prompt: string, sessionId: string = 'default'): Promise<string> {
    // 0. Handle a pending confirmation from the previous turn (per session)
    const pending = this.pendingCallsBySession.get(sessionId);
    if (pending) {
      const normalized = prompt.trim().toLowerCase();
      if (AFFIRM.has(normalized)) {
        this.pendingCallsBySession.delete(sessionId);
        const results = await this.runToolCalls(pending);
        return results + "\nAction confirmed and executed.";
      }
      if (DENY.has(normalized)) {
        this.pendingCallsBySession.delete(sessionId);
        return "Okay, cancelled. Nothing was executed.";
      }
      return `I still need a yes/no on the pending action(s):\n${this.describeCalls(pending)}\nReply "yes" to proceed or "no" to cancel.`;
    }

    // 1. Retrieve Context from SQLite
    const context = await this.retriever.retrieveContext(prompt);

    // 2. Select tools via embedding similarity (LanceDB), falling back to
    //    keyword matching internally if the vector index isn't ready.
    const tools = await selectRelevantToolsSemantic(this.memoryService, prompt);
    console.log(`[Orchestrator] Sending ${tools.length} tool(s) to LLM: ${tools.map(t => t.name).join(', ')}`);

    // 3. AGENTIC LOOP - Allows the AI to use multiple tools in sequence
    let currentPrompt = prompt;
    let history: LLMHistoryMessage[] = [{ role: 'user', parts: [{ text: prompt }] }];
    let steps = 0;
    const MAX_STEPS = 5; // Safety limit to prevent infinite loops
    let finalOutput = "";

    while (steps < MAX_STEPS) {
      steps++;
      // Call LLM
      const response = await this.llm.generateResponse(currentPrompt, context, history, tools);

      // If the AI didn't call any tools, it's done thinking.
      if (response.toolCalls.length === 0) {
        finalOutput += response.text || "";
        break; // Exit loop
      }

      // Categorize the tool calls the LLM requested
      const safeCalls = response.toolCalls.filter(c => !DESTRUCTIVE_TOOLS.has(c.name));
      const destructiveCalls = response.toolCalls.filter(c => DESTRUCTIVE_TOOLS.has(c.name));

      let toolResults = "";

      // Execute SAFE calls immediately and feed them back to the LLM
      if (safeCalls.length > 0) {
        const safeResults = await this.runToolCalls(safeCalls);
        finalOutput += safeResults;
        toolResults += safeResults + "\n";
      }

      // Execute DESTRUCTIVE calls? NO. Stop the loop and ask the user for confirmation!
      if (destructiveCalls.length > 0) {
        this.pendingCallsBySession.set(sessionId, destructiveCalls);
        finalOutput += `\nThe following action(s) need your confirmation before I run them:\n${this.describeCalls(destructiveCalls)}\nReply "yes" to proceed or "no" to cancel.`;
        break; // Stop the loop to wait for user's "yes"
      }

      // If there were no destructive calls, feed the safe tool results BACK to the LLM
      // so it can take the next step (e.g., use the timestamp it just found).
      if (safeCalls.length > 0) {
        currentPrompt = `You just executed the following tools:\n${toolResults}\nPlease continue with the user's original request based on these results. If you have completed the task, just reply with a short summary.`;
        history.push({ role: 'model', parts: [{ text: `I executed tools: ${safeCalls.map(c => c.name).join(', ')}` }] });
        history.push({ role: 'user', parts: [{ text: currentPrompt }] });
      } else {
        // Fallback just in case it returns no safe and no destructive calls
        break;
      }
    }

    if (steps === MAX_STEPS) {
      finalOutput += "\n(I reached the maximum number of steps for this task.)";
    }

    return finalOutput.trim() || "I couldn't process that request.";
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