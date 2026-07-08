// src/retriever/RetrieverService.ts
import { MemoryService } from '../memory/MemoryService';

export class RetrieverService {
  constructor(private memoryService: MemoryService) {}

  async retrieveContext(userPrompt: string): Promise<string> {
    const recent = await this.memoryService.getRecentContext(3);
    const searchResults = await this.memoryService.searchMemory(userPrompt);

    let contextString = "=== RECENT ACTIVITY ===\n";
    if (recent.recentApps?.length) contextString += `Active Window: ${recent.recentApps[0].app} - ${recent.recentApps[0].window}\n`;
    if (recent.recentBrowser?.length) contextString += `Last Browser Tab: ${recent.recentBrowser[0].title} (${recent.recentBrowser[0].url})\n`;
    if (recent.recentSelectedText?.length) contextString += `Last Highlighted Text: ${recent.recentSelectedText[0].text}\n`;
    
    contextString += "\n=== RELEVANT MEMORY ===\n";
    if (searchResults.clips?.length) {
      contextString += "Clipboard matches:\n";
      searchResults.clips.forEach(c => contextString += `- ${c.content}\n`);
    }
    if (searchResults.browser?.length) {
      contextString += "Browser matches:\n";
      searchResults.browser.forEach(b => contextString += `- ${b.title} (${b.url})\n`);
    }

    return contextString;
  }
}