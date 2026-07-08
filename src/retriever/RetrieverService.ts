// src/retriever/RetrieverService.ts
import { MemoryService } from '../memory/MemoryService';

export class RetrieverService {
  constructor(private memoryService: MemoryService) {}

  async retrieveContext(userPrompt: string): Promise<string> {
    // 1. Get Recent Timeline (from SQLite)
    const recent = await this.memoryService.getRecentContext(3);
    
    // 2. Get Semantic Matches (from LanceDB)
    const searchResults = await this.memoryService.searchMemory(userPrompt);

    let contextString = "=== RECENT ACTIVITY ===\n";
    if (recent.recentApps?.length) contextString += `Active Window: ${recent.recentApps[0].app} - ${recent.recentApps[0].window}\n`;
    if (recent.recentBrowser?.length) contextString += `Last Browser Tab: ${recent.recentBrowser[0].title}\n`;
    if (recent.recentSelectedText?.length) contextString += `Last Highlighted Text: ${recent.recentSelectedText[0].text}\n`;
    if (recent.recentVSCode?.length) contextString += `VS Code Workspace: ${recent.recentVSCode[0].workspace}\n`;
    if (recent.recentSlack?.length) contextString += `Last Slack Message: ${recent.recentSlack[0].text}\n`;
    if (recent.recentCalendar?.length) contextString += `Next Calendar Event: ${recent.recentCalendar[0].summary} at ${recent.recentCalendar[0].startTime}\n`;
    if (recent.recentOCR?.length) contextString += `Text currently on screen: ${recent.recentOCR[0].text.substring(0, 200)}...\n`;
    
    // Add Semantic Search Results
    contextString += "\n=== RELEVANT SEMANTIC MEMORY ===\n";
    if (searchResults.semanticMatches && searchResults.semanticMatches.length > 0) {
      searchResults.semanticMatches.forEach((match: any) => {
        // match.text and match.type come directly from our LanceDB VectorService
        contextString += `- (Type: ${match.type}) ${match.text}\n`;
      });
    } else {
      contextString += "No semantic matches found.\n";
    }

    return contextString;
  }
}