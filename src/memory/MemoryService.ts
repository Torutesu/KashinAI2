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
      } else if (event.type === 'SLACK_MESSAGE') {
        await prisma.slackMessage.create({ data: { channel: event.app!, user: event.window || 'Unknown', text: event.content! } });
      } else if (event.type === 'CALENDAR_EVENT') {
        await prisma.calendarEvent.create({ data: { summary: event.app!, startTime: new Date(event.timestamp), endTime: event.timestamp } });
      } else if (event.type === 'VSCODE_ACTIVITY') {
        await prisma.vSCodeActivity.create({ data: { workspace: event.app!, file: event.window } });
      } else if (event.type === 'SCREEN_OCR') {
        await prisma.screenOCR.create({ data: { text: event.content! } });
      }
    } catch (error) {
      console.error('[MemoryService] Failed to store event:', error);
    }
  }

  async getRecentContext(limit: number = 3) {
    try {
      const [apps, clips, browser, selected, slack, calendar, vscode, ocr] = await Promise.all([
        prisma.appActivity.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.clipboardHistory.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.browserHistory.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.selectedText.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.slackMessage.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.calendarEvent.findMany({ take: limit, orderBy: { startTime: 'desc' } }),
        prisma.vSCodeActivity.findMany({ take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.screenOCR.findMany({ take: 1, orderBy: { timestamp: 'desc' } })
      ]);
      return { recentApps: apps, recentClipboard: clips, recentBrowser: browser, recentSelectedText: selected, recentSlack: slack, recentCalendar: calendar, recentVSCode: vscode, recentOCR: ocr };
    } catch (error) {
      console.error('[MemoryService] Failed to fetch context:', error);
      return {};
    }
  }

  async searchMemory(query: string) {
    try {
      const [apps, clips, browser, slack, ocr] = await Promise.all([
        prisma.appActivity.findMany({ where: { window: { contains: query } } }),
        prisma.clipboardHistory.findMany({ where: { content: { contains: query } } }),
        prisma.browserHistory.findMany({ where: { OR: [{ url: { contains: query } }, { title: { contains: query } }] } }),
        prisma.slackMessage.findMany({ where: { text: { contains: query } } }),
        prisma.screenOCR.findMany({ where: { text: { contains: query } } })
      ]);
      return { apps, clips, browser, slack, ocr };
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return {};
    }
  }
}