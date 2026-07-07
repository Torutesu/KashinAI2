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
  args: any;
}

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  generateResponse(prompt: string, context: string, history: any[], tools: any[]): Promise<LLMResponse>;
}

export interface Collector {
  start(): void;
  stop(): void;
}