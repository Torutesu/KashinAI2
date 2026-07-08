// src/memory/MemoryService.ts
import { prisma } from '../db/prisma';
import { ContextEvent } from '../types';

export class MemoryService {
  async storeEvent(event: ContextEvent) {
    try {
      if (event.type === 'APP_ACTIVITY') {
        await prisma.appActivity.create({ data: { app: event.app!, window: event.window || '' } });
      } else if (event.type === 'CLIPBOARD') {
        await prisma.clipboardHistory.create({ data: { content: event.content! } });
      } else if (event.type === 'BROWSER_HISTORY') {
        await prisma.browserHistory.create({ data: { url: event.content!, title: event.app || 'Unknown' } });
      } else if (event.type === 'SELECTED_TEXT') {
        await prisma.selectedText.create({ data: { text: event.content!, app: event.app } });
      }
    } catch (error) {
      console.error('[MemoryService] Failed to store event:', error);
    }
  }

  async getRecentContext(limit: number = 5) {
    try {
      const [apps, clips, browser, selected] = await Promise.all([
        prisma.appActivity.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.clipboardHistory.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.browserHistory.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.selectedText.findMany({ take: limit, orderBy: { timestamp: 'desc' } })
      ]);
      return { recentApps: apps, recentClipboard: clips, recentBrowser: browser, recentSelectedText: selected };
    } catch (error) {
      console.error('[MemoryService] Failed to fetch context:', error);
      return {};
    }
  }

  async searchMemory(query: string) {
    try {
      const [apps, clips, browser] = await Promise.all([
        prisma.appActivity.findMany({ where: { window: { contains: query } } }),
        prisma.clipboardHistory.findMany({ where: { content: { contains: query } } }),
        prisma.browserHistory.findMany({ where: { OR: [{ url: { contains: query } }, { title: { contains: query } }] } })
      ]);
      return { apps, clips, browser };
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return {};
    }
  }
}