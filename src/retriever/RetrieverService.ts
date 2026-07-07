import { MemoryService } from '../memory/MemoryService';

type RecentApp = Awaited<ReturnType<MemoryService['getRecentContext']>>['recentApps'][number];
type ClipMatch = Awaited<ReturnType<MemoryService['searchMemory']>>['clips'][number];

export class RetrieverService {
  constructor(private memoryService: MemoryService) {}

  async retrieveContext(userPrompt: string): Promise<string> {
    const recent = await this.memoryService.getRecentContext(5);
    const searchResults = await this.memoryService.searchMemory(userPrompt);

    let contextString = "=== RECENT ACTIVITY ===\n";
    recent.recentApps.forEach((a: RecentApp) => contextString += `App: ${a.app}, Window: ${a.window}\n`);

    contextString += "\n=== RELEVANT MEMORY ===\n";
    if (searchResults.clips.length > 0) {
      contextString += "Clipboard history matches:\n";
      searchResults.clips.forEach((c: ClipMatch) => contextString += `- ${c.content}\n`);
    }

    return contextString;
  }
}