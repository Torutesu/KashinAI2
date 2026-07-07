// src/llm/GeminiProvider.ts
import { GoogleGenAI } from '@google/genai';
import { LLMProvider, LLMResponse, ToolCall } from '../types';

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateResponse(prompt: string, context: string, history: any[], tools: any[]): Promise<LLMResponse> {
  const systemPrompt = `
    You are a local AI assistant. Use the following local context to answer the user's question.
    If you need to execute an action, use the provided tools.
    
    CONTEXT:
    ${context}
  `;

  try {
    const response = await this.ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: { parts: [{ text: prompt }], role: 'user' },
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: tools }],
      },
    });

    const toolCalls: ToolCall[] = [];

    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        if (!call.name) continue;
        toolCalls.push({
          name: call.name,
          args: call.args || {}
        });
      }
    }

    return {
      text: response.text || null,
      toolCalls
    };
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
}