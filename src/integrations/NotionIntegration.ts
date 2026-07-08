// src/integrations/NotionIntegration.ts
import { Client } from '@notionhq/client';

export class NotionIntegration {
  private notion: Client;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY || '' });
  }

  // 1. Search Pages
  async searchPages(query: string): Promise<string> {
    if (!process.env.NOTION_API_KEY) return 'Error: NOTION_API_KEY not set in .env';
    try {
      const response = await this.notion.search({
        query: query,
        filter: { property: 'object', value: 'page' }
      });

      if (response.results.length === 0) return `No pages found matching: ${query}`;

      let result = `Found pages:\n`;
      for (const page of response.results) {
        // Safely extract title from various possible page property structures
        const titleProp = (page as any).properties?.title?.title?.[0]?.plain_text || 
                          (page as any).properties?.Name?.title?.[0]?.plain_text || 
                          'Untitled';
        result += `- Title: ${titleProp} | ID: ${page.id}\n`;
      }
      return result;
    } catch (error) {
      return `Error searching Notion: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2. Read Page Content
  async readPage(pageId: string): Promise<string> {
    try {
      const blocks = await this.notion.blocks.children.list({
        block_id: pageId,
        page_size: 10, // Read first 10 blocks
      });

      if (blocks.results.length === 0) return `Page is empty or has no text blocks.`;

      let content = `Page Content:\n`;
      for (const block of blocks.results) {
        // Extract text from paragraph blocks (can be expanded for headings, lists, etc.)
        if ((block as any).type === 'paragraph') {
          const texts = (block as any).paragraph.rich_text;
          const plainText = texts.map((t: any) => t.plain_text).join('');
          if (plainText) content += `- ${plainText}\n`;
        }
      }
      return content;
    } catch (error) {
      return `Error reading page: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 3. Create Page (in a database)
  async createPage(databaseId: string, title: string): Promise<string> {
    try {
      await this.notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { // Assuming standard DB title property
            title: [{ text: { content: title } }]
          }
        }
      });
      return `Successfully created Notion page: ${title}`;
    } catch (error) {
      return `Error creating Notion page: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 4. Edit Page (Append text block to bottom of page)
  async editPage(pageId: string, text: string): Promise<string> {
    try {
      await this.notion.blocks.children.append({
        block_id: pageId, // Appends to the page's block tree
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: text } }]
            }
          }
        ]
      });
      return `Successfully appended text to Notion page ${pageId}.`;
    } catch (error) {
      return `Error editing Notion page: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 5. Update Database (Change Database Title)
  async updateDatabase(databaseId: string, newTitle: string): Promise<string> {
    try {
      await this.notion.databases.update({
        database_id: databaseId,
        title: [{ text: { content: newTitle } }]
      });
      return `Successfully updated Notion database title to: ${newTitle}`;
    } catch (error) {
      return `Error updating Notion database: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}