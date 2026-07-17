// src/llm/OpenAIProvider.ts
//
// OpenAI implementation of LLMProvider, so the backend isn't hard-wired to
// Gemini. Selected via LLM_PROVIDER=openai (see providerFactory). Mirrors
// GeminiProvider's contract: takes prompt/context/history/tools, returns
// { text, toolCalls }.

import OpenAI from 'openai';
import { LLMProvider, LLMResponse, LLMHistoryMessage, ToolDefinition, ToolCall } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private readonly model: string;
  private readonly baseURL?: string;

  constructor(private apiKey: string) {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    // OPENAI_BASE_URL points at any OpenAI-compatible server (Ollama, LM Studio,
    // vLLM, …), enabling a fully local LLM behind the same provider.
    this.baseURL = process.env.OPENAI_BASE_URL || undefined;
  }

  // Lazy so constructing the provider (e.g. in the factory/tests) never throws
  // on a missing key — only an actual request does.
  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.apiKey || 'not-needed', // local servers often ignore the key
        ...(this.baseURL ? { baseURL: this.baseURL } : {}),
      });
    }
    return this.client;
  }

  async generateResponse(
    prompt: string,
    context: string,
    history: LLMHistoryMessage[],
    tools: ToolDefinition[]
  ): Promise<LLMResponse> {
    const systemPrompt = `You are a local AI assistant. Use the following local context to answer the user's question. If you need to execute an action, use the provided tools.\n\nCONTEXT:\n${context}`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts.map((p) => p.text).join(''),
        });
      }
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const openaiTools =
      tools.length > 0
        ? tools.map((t) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: { type: 'object', properties: t.parameters.properties, required: t.parameters.required || [] },
            },
          }))
        : undefined;

    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages,
        ...(openaiTools ? { tools: openaiTools as any } : {}),
      });

      const message = response.choices[0]?.message;
      const toolCalls: ToolCall[] = [];
      for (const tc of message?.tool_calls || []) {
        const fn = (tc as any).function;
        if (!fn) continue;
        let args: Record<string, string | number | boolean> = {};
        try {
          args = fn.arguments ? JSON.parse(fn.arguments) : {};
        } catch {
          args = {};
        }
        toolCalls.push({ name: fn.name || '', args });
      }

      return { text: message?.content || null, toolCalls };
    } catch (error) {
      console.error('[OpenAIProvider] API Error:', error);
      throw error;
    }
  }
}
