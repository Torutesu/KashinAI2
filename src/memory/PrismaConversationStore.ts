// src/memory/PrismaConversationStore.ts
//
// Durable conversation history backed by SQLite (Conversation table). Imported
// only by app.ts so the rest of the code (and tests) can stay Prisma-free.

import { log } from '../utils/logger';
import { prisma } from '../db/prisma';
import { LLMHistoryMessage } from '../types';
import { ConversationStore, MAX_HISTORY_MESSAGES } from './ConversationStore';

export class PrismaConversationStore implements ConversationStore {
  async load(sessionId: string): Promise<LLMHistoryMessage[]> {
    try {
      // Most recent MAX rows, returned oldest-first for the model.
      const rows = await prisma.conversation.findMany({
        where: { sessionId },
        orderBy: { id: 'desc' },
        take: MAX_HISTORY_MESSAGES,
      });
      return rows
        .reverse()
        .map((r) => ({ role: r.role === 'model' ? 'model' : 'user', parts: [{ text: r.content }] }));
    } catch (error) {
      log.error('[PrismaConversationStore] load failed:', error);
      return [];
    }
  }

  async append(sessionId: string, messages: LLMHistoryMessage[]): Promise<void> {
    try {
      await prisma.conversation.createMany({
        data: messages.map((m) => ({
          sessionId,
          role: m.role,
          content: m.parts.map((p) => p.text).join(''),
        })),
      });
      // Trim to the most recent MAX rows for this session.
      const stale = await prisma.conversation.findMany({
        where: { sessionId },
        orderBy: { id: 'desc' },
        skip: MAX_HISTORY_MESSAGES,
        select: { id: true },
      });
      if (stale.length > 0) {
        await prisma.conversation.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
      }
    } catch (error) {
      log.error('[PrismaConversationStore] append failed:', error);
    }
  }
}
