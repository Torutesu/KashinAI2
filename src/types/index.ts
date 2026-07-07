// src/types/index.ts
export interface ContextEvent {
  app?: string;
  window?: string;
  content?: string;
  type: string;
  timestamp: Date;
}

export interface ToolCall {
  name: string;
  args: Record<string, string | number | boolean>;
}

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface LLMHistoryMessage {
  role: 'user' | 'model' | 'function';
  parts: Array<{ text: string }>;
}

export interface LLMProvider {
  generateResponse(prompt: string, context: string, history: LLMHistoryMessage[], tools: ToolDefinition[]): Promise<LLMResponse>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface Collector {
  start(): void;
  stop(): void;
}