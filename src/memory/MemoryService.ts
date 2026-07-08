// src/memory/MemoryService.ts
import { prisma } from '../db/prisma';
import { ContextEvent } from '../types';
import { VectorService } from './VectorService';

export class MemoryService {
  public vectorService: VectorService;

  constructor() {
    this.vectorService = new VectorService();
    // Initialize LanceDB and the embedding model in the background
    this.vectorService.initialize();
  }

  async storeEvent(event: ContextEvent) {
    try {
      // 1. Save to SQLite (for recent timeline)
      if (event.type === 'APP_ACTIVITY') {
        await prisma.appActivity.create({ data: { app: event.app!, window: event.window || '' } });
      } else if (event.type === 'CLIPBOARD') {
        await prisma.clipboardHistory.create({ data: { content: event.content! } });
        // 2. Save to LanceDB (for semantic search)
        await this.vectorService.storeMemory(event.content!, 'CLIPBOARD');
      } else if (event.type === 'BROWSER_HISTORY') {
        await prisma.browserHistory.create({ data: { url: event.content!, title: event.app || 'Unknown' } });
        await this.vectorService.storeMemory(`Browser: ${event.app} - ${event.content}`, 'BROWSER');
      } else if (event.type === 'SELECTED_TEXT') {
        await prisma.selectedText.create({ data: { text: event.content!, app: event.app } });
        await this.vectorService.storeMemory(event.content!, 'SELECTED_TEXT');
      } else if (event.type === 'SLACK_MESSAGE') {
        await prisma.slackMessage.create({ data: { channel: event.app!, user: event.window || 'Unknown', text: event.content! } });
        await this.vectorService.storeMemory(`Slack in ${event.app}: ${event.content}`, 'SLACK');
      } else if (event.type === 'CALENDAR_EVENT') {
        await prisma.calendarEvent.create({ data: { summary: event.app!, startTime: new Date(event.timestamp), endTime: event.timestamp } });
        await this.vectorService.storeMemory(`Calendar: ${event.app}`, 'CALENDAR');
      } else if (event.type === 'VSCODE_ACTIVITY') {
        await prisma.vSCodeActivity.create({ data: { workspace: event.app!, file: event.window } });
      } else if (event.type === 'SCREEN_OCR') {
        await prisma.screenOCR.create({ data: { text: event.content! } });
        await this.vectorService.storeMemory(event.content!, 'OCR');
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

  // Upgraded to use Vector Search instead of SQL LIKE
  async searchMemory(query: string) {
    try {
      // Now uses LanceDB for semantic concept matching!
      const semanticMatches = await this.vectorService.searchMemory(query, 5);
      return { semanticMatches };
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return { semanticMatches: [] };
    }
  }
}