// src/memory/MemoryService.ts
import { prisma } from '../db/prisma';
import { ContextEvent } from '../types';

export class MemoryService {
  async storeEvent(event: ContextEvent) {
    try {
      if (event.type === 'APP_ACTIVITY') {
        await prisma.appActivity.create({
          data: { app: event.app!, window: event.window || '' },
        });
      } else if (event.type === 'CLIPBOARD') {
        await prisma.clipboardHistory.create({
          data: { content: event.content! },
        });
      }
    } catch (error) {
      console.error('[MemoryService] Failed to store event:', error);
    }
  }

  async getRecentContext(limit: number = 10) {
    try {
      const apps = await prisma.appActivity.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
      });
      const clips = await prisma.clipboardHistory.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
      });
      return { recentApps: apps, recentClipboard: clips };
    } catch (error) {
      console.error('[MemoryService] Failed to fetch recent context:', error);
      return { recentApps: [], recentClipboard: [] };
    }
  }

  async searchMemory(query: string) {
    try {
      const apps = await prisma.appActivity.findMany({
        where: { window: { contains: query } },
      });
      const clips = await prisma.clipboardHistory.findMany({
        where: { content: { contains: query } },
      });
      return { apps, clips };
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return { apps: [], clips: [] };
    }
  }
}