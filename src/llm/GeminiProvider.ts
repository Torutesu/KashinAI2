// src/llm/GeminiProvider.ts
import { log } from '../utils/logger';
import { GoogleGenAI } from '@google/genai';
import { LLMProvider, LLMResponse, LLMHistoryMessage, ToolDefinition, ToolCall } from '../types';

export class GeminiProvider implements LLMProvider {
  private ai?: GoogleGenAI;
  private currentKey = '';
  private readonly getKey: () => string;

  // Accept a static key or a resolver so a key set at runtime (dashboard) takes
  // effect without a restart — the client is rebuilt when the key changes.
  constructor(apiKey: string | (() => string)) {
    this.getKey = typeof apiKey === 'function' ? apiKey : () => apiKey;
  }

  private client(): GoogleGenAI {
    const key = this.getKey();
    if (!this.ai || key !== this.currentKey) {
      this.ai = new GoogleGenAI({ apiKey: key });
      this.currentKey = key;
    }
    return this.ai;
  }

  async generateResponse(prompt: string, context: string, history: LLMHistoryMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const systemPrompt = `
      You are a local AI assistant. Use the following local context to answer the user's question.
      If you need to execute an action, use the provided tools.
      
      CONTEXT:
      ${context}
    `;

    try {
      // 1. Map our ToolDefinition[] to the Gemini SDK's expected format
      const sdkTools = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT', // SDK expects uppercase string enum
          properties: t.parameters.properties,
          required: t.parameters.required || []
        }
      }));

      // Build multi-turn contents from history so the model sees prior turns.
      // Falls back to the single prompt when no history is supplied (e.g. /llm/query).
      const contents =
        history && history.length > 0
          ? history.map((h) => ({ role: h.role === 'model' ? 'model' : 'user', parts: h.parts }))
          : [{ role: 'user', parts: [{ text: prompt }] }];

      const response = await this.client().models.generateContent({
        model: 'gemini-flash-latest',
        contents,
        config: {
          systemInstruction: systemPrompt,
          // Cast to any to bypass strict SDK structural typing on the nested parameters
          tools: [{ functionDeclarations: sdkTools as any }],
        },
      });

      // 2. Parse the response back into our strict ToolCall[] type
      const toolCalls: ToolCall[] = [];
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          toolCalls.push({
            name: call.name || '',
            args: (call.args || {}) as Record<string, string | number | boolean>
          });
        }
      }

      return {
        text: response.text || null,
        toolCalls
      };
    } catch (error) {
      log.error('[GeminiProvider] API Error:', error);
      throw error;
    }
  }
}