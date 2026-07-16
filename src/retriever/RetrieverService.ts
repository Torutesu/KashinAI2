// src/retriever/RetrieverService.ts
import { MemoryService } from '../memory/MemoryService';
import { Candidate, rankCandidates } from './ranking';

export class RetrieverService {
  constructor(private memoryService: MemoryService) {}

  async retrieveContext(userPrompt: string): Promise<string> {
    // 1. Recent timeline (SQLite)
    const recent = await this.memoryService.getRecentContext(3);

    // 2. Hybrid recall: vector (semantic) + keyword (exact substring), merged
    //    and reranked by relevance + recency.
    const [vectorRes, keywordHits] = await Promise.all([
      this.memoryService.searchMemory(userPrompt),
      this.memoryService.keywordSearch(userPrompt, 5),
    ]);

    const candidates: Candidate[] = [
      ...(vectorRes.semanticMatches || []).map((m: any) => ({
        text: m.text,
        type: m.type,
        source: 'vector' as const,
        distance: m._distance,
        timestamp: m.timestamp,
      })),
      ...keywordHits.map((k) => ({
        text: k.text,
        type: k.type,
        source: 'keyword' as const,
        timestamp: k.timestamp,
      })),
    ];

    const ranked = rankCandidates(candidates, Date.now(), 5);

    let contextString = '=== RECENT ACTIVITY ===\n';
    if (recent.recentApps?.length) contextString += `Active Window: ${recent.recentApps[0].app} - ${recent.recentApps[0].window}\n`;
    if (recent.recentBrowser?.length) contextString += `Last Browser Tab: ${recent.recentBrowser[0].title}\n`;
    if (recent.recentSelectedText?.length) contextString += `Last Highlighted Text: ${recent.recentSelectedText[0].text}\n`;
    if (recent.recentVSCode?.length) contextString += `VS Code Workspace: ${recent.recentVSCode[0].workspace}\n`;
    if (recent.recentSlack?.length) contextString += `Last Slack Message: ${recent.recentSlack[0].text}\n`;
    if (recent.recentCalendar?.length) contextString += `Next Calendar Event: ${recent.recentCalendar[0].summary} at ${recent.recentCalendar[0].startTime}\n`;
    if (recent.recentOCR?.length) contextString += `Text currently on screen: ${recent.recentOCR[0].text.substring(0, 200)}...\n`;

    contextString += '\n=== RELEVANT MEMORY (hybrid) ===\n';
    if (ranked.length > 0) {
      ranked.forEach((item) => {
        contextString += `- (${item.type}, ${item.sources.join('+')}) ${item.text}\n`;
      });
    } else {
      contextString += 'No relevant memories found.\n';
    }

    return contextString;
  }
}
