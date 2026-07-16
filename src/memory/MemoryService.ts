// src/memory/MemoryService.ts
import { prisma } from '../db/prisma';
import { ContextEvent } from '../types';
import { VectorService } from './VectorService';
import { retentionCutoff } from './retention';
import { redactSecrets } from '../security/redaction';
import { isLowSignalText } from './noiseFilter';

// Content from these sources is raw user data that routinely contains secrets
// (passwords copied to the clipboard, API keys on screen). Redact before storing.
const REDACTED_TYPES = new Set(['CLIPBOARD', 'SELECTED_TEXT', 'SCREEN_OCR']);

export class MemoryService {
  public vectorService: VectorService;
  // Last embedded text per vector-type, to drop consecutive duplicates
  // (e.g. an unchanged window title captured on every poll).
  private lastEmbedded: Map<string, string> = new Map();

  constructor() {
    this.vectorService = new VectorService();
    // Initialize LanceDB and the embedding model in the background
    this.vectorService.initialize();
  }

  /** Embed `text` under `vectorType`, skipping low-signal and duplicate content. */
  private async maybeEmbed(text: string, vectorType: string): Promise<void> {
    if (isLowSignalText(text)) return;
    if (this.lastEmbedded.get(vectorType) === text) return;
    this.lastEmbedded.set(vectorType, text);
    await this.vectorService.storeMemory(text, vectorType);
  }

  async storeEvent(event: ContextEvent) {
    try {
      // 0. Redact obvious secrets from high-risk sources before persisting,
      //    unless explicitly disabled.
      if (
        event.content &&
        REDACTED_TYPES.has(event.type) &&
        process.env.DISABLE_SECRET_REDACTION !== 'true'
      ) {
        event = { ...event, content: redactSecrets(event.content) };
      }

      // 1. Save to SQLite (for recent timeline)
      // 2. Embed into LanceDB for semantic search (noise-filtered & deduped).
      if (event.type === 'APP_ACTIVITY') {
        await prisma.appActivity.create({ data: { app: event.app!, window: event.window || '' } });
        await this.maybeEmbed(`App: ${event.app}${event.window ? ` - ${event.window}` : ''}`, 'APP_ACTIVITY');
      } else if (event.type === 'CLIPBOARD') {
        await prisma.clipboardHistory.create({ data: { content: event.content! } });
        await this.maybeEmbed(event.content!, 'CLIPBOARD');
      } else if (event.type === 'BROWSER_HISTORY') {
        await prisma.browserHistory.create({ data: { url: event.content!, title: event.app || 'Unknown' } });
        await this.maybeEmbed(`Browser: ${event.app} - ${event.content}`, 'BROWSER');
      } else if (event.type === 'SELECTED_TEXT') {
        await prisma.selectedText.create({ data: { text: event.content!, app: event.app } });
        await this.maybeEmbed(event.content!, 'SELECTED_TEXT');
      } else if (event.type === 'SLACK_MESSAGE') {
        await prisma.slackMessage.create({ data: { channel: event.app!, user: event.window || 'Unknown', text: event.content! } });
        await this.maybeEmbed(`Slack in ${event.app}: ${event.content}`, 'SLACK');
      } else if (event.type === 'CALENDAR_EVENT') {
        await prisma.calendarEvent.create({ data: { summary: event.app!, startTime: new Date(event.timestamp), endTime: event.timestamp } });
        await this.maybeEmbed(`Calendar: ${event.app}`, 'CALENDAR');
      } else if (event.type === 'VSCODE_ACTIVITY') {
        await prisma.vSCodeActivity.create({ data: { workspace: event.app!, file: event.window } });
        await this.maybeEmbed(`VS Code: ${event.app}${event.window ? ` / ${event.window}` : ''}`, 'VSCODE');
      } else if (event.type === 'SCREEN_OCR') {
        await prisma.screenOCR.create({ data: { text: event.content! } });
        await this.maybeEmbed(event.content!, 'OCR');
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

  /**
   * Keyword (exact-substring) search across the text-bearing SQLite tables.
   * Complements vector search in the hybrid retriever — catches exact terms
   * (names, IDs, error codes) that embeddings can miss.
   */
  async keywordSearch(query: string, limit: number = 5): Promise<{ text: string; type: string; timestamp: string }[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const [clips, selected, browser, slack, ocr] = await Promise.all([
        prisma.clipboardHistory.findMany({ where: { content: { contains: q } }, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.selectedText.findMany({ where: { text: { contains: q } }, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.browserHistory.findMany({ where: { OR: [{ title: { contains: q } }, { url: { contains: q } }] }, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.slackMessage.findMany({ where: { text: { contains: q } }, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.screenOCR.findMany({ where: { text: { contains: q } }, take: limit, orderBy: { timestamp: 'desc' } }),
      ]);
      const out: { text: string; type: string; timestamp: string }[] = [];
      clips.forEach((r) => out.push({ text: r.content, type: 'CLIPBOARD', timestamp: r.timestamp.toISOString() }));
      selected.forEach((r) => out.push({ text: r.text, type: 'SELECTED_TEXT', timestamp: r.timestamp.toISOString() }));
      browser.forEach((r) => out.push({ text: `${r.title} (${r.url})`, type: 'BROWSER', timestamp: r.timestamp.toISOString() }));
      slack.forEach((r) => out.push({ text: r.text, type: 'SLACK', timestamp: r.timestamp.toISOString() }));
      ocr.forEach((r) => out.push({ text: r.text, type: 'OCR', timestamp: r.timestamp.toISOString() }));
      return out;
    } catch (error) {
      console.error('[MemoryService] keywordSearch failed:', error);
      return [];
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

  async initToolIndex(tools: { name: string; text: string }[]): Promise<void> {
    return this.vectorService.initToolIndex(tools);
  }

  async searchTools(query: string, limit: number = 6): Promise<{ name: string; distance: number }[]> {
    return this.vectorService.searchTools(query, limit);
  }

  /**
   * Enforce the retention policy: delete SQLite rows and memory vectors older
   * than `retentionDays`. Prevents the local stores from growing without bound.
   */
  async pruneOldMemories(retentionDays: number): Promise<void> {
    if (retentionDays <= 0) return;
    const cutoff = retentionCutoff(retentionDays, new Date());
    const where = { timestamp: { lt: cutoff } };
    try {
      const results = await Promise.all([
        prisma.appActivity.deleteMany({ where }),
        prisma.clipboardHistory.deleteMany({ where }),
        prisma.browserHistory.deleteMany({ where }),
        prisma.selectedText.deleteMany({ where }),
        prisma.slackMessage.deleteMany({ where }),
        prisma.calendarEvent.deleteMany({ where }),
        prisma.vSCodeActivity.deleteMany({ where }),
        prisma.screenOCR.deleteMany({ where }),
      ]);
      const sqliteDeleted = results.reduce((sum, r) => sum + r.count, 0);
      const vectorsDeleted = await this.vectorService.pruneOlderThan(cutoff.toISOString());
      console.log(
        `[MemoryService] Retention: pruned ${sqliteDeleted} SQLite rows and ${vectorsDeleted} vectors older than ${retentionDays}d.`
      );
    } catch (error) {
      console.error('[MemoryService] Retention prune failed:', error);
    }
  }
}