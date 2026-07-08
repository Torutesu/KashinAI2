// src/retriever/RetrieverService.ts
import { MemoryService } from '../memory/MemoryService';

export class RetrieverService {
  constructor(private memoryService: MemoryService) {}

  async retrieveContext(userPrompt: string): Promise<string> {
    const recent = await this.memoryService.getRecentContext(3);
    const searchResults = await this.memoryService.searchMemory(userPrompt);

    let contextString = "=== RECENT ACTIVITY ===\n";
    if (recent.recentApps?.length) contextString += `Active Window: ${recent.recentApps[0].app} - ${recent.recentApps[0].window}\n`;
    if (recent.recentBrowser?.length) contextString += `Last Browser Tab: ${recent.recentBrowser[0].title}\n`;
    if (recent.recentSelectedText?.length) contextString += `Last Highlighted Text: ${recent.recentSelectedText[0].text}\n`;
    if (recent.recentVSCode?.length) contextString += `VS Code Workspace: ${recent.recentVSCode[0].workspace}\n`;
    if (recent.recentSlack?.length) contextString += `Last Slack Message: ${recent.recentSlack[0].text}\n`;
    if (recent.recentCalendar?.length) contextString += `Next Calendar Event: ${recent.recentCalendar[0].summary} at ${recent.recentCalendar[0].startTime}\n`;
    if (recent.recentOCR?.length) contextString += `Text currently on screen: ${recent.recentOCR[0].text.substring(0, 200)}...\n`;
    
    contextString += "\n=== RELEVANT MEMORY ===\n";
    if (searchResults.clips?.length) contextString += `Clipboard matches: ${searchResults.clips.map(c => c.content).join(', ')}\n`;
    if (searchResults.browser?.length) contextString += `Browser matches: ${searchResults.browser.map(b => b.title).join(', ')}\n`;
    if (searchResults.slack?.length) contextString += `Slack matches: ${searchResults.slack.map(s => s.text).join(', ')}\n`;

    return contextString;
  }
}