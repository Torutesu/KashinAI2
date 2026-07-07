// src/llm/GeminiProvider.ts
import { GoogleGenAI } from '@google/genai';
import { LLMProvider, LLMResponse, LLMHistoryMessage, ToolDefinition, ToolCall } from '../types';

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
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

      const response = await this.ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: { parts: [{ text: prompt }], role: 'user' },
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
      console.error('[GeminiProvider] API Error:', error);
      throw error;
    }
  }
}