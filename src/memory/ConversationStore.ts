// src/memory/ConversationStore.ts
//
// Abstraction over per-session conversation history so the orchestrator doesn't
// care where it lives. The in-memory store is the default (and what tests use);
// the Prisma-backed store (separate file, imported only by app.ts) survives
// restarts.

import { LLMHistoryMessage } from '../types';

export const MAX_HISTORY_MESSAGES = 20; // ~10 turns

export interface ConversationStore {
  load(sessionId: string): Promise<LLMHistoryMessage[]>;
  append(sessionId: string, messages: LLMHistoryMessage[]): Promise<void>;
}

/** Process-local history. Lost on restart; fine for tests and dev. */
export class InMemoryConversationStore implements ConversationStore {
  private map: Map<string, LLMHistoryMessage[]> = new Map();

  async load(sessionId: string): Promise<LLMHistoryMessage[]> {
    return this.map.get(sessionId) ?? [];
  }

  async append(sessionId: string, messages: LLMHistoryMessage[]): Promise<void> {
    const updated = [...(this.map.get(sessionId) ?? []), ...messages];
    this.map.set(sessionId, updated.slice(-MAX_HISTORY_MESSAGES));
  }
}
