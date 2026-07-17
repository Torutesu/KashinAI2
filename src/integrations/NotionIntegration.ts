// src/integrations/NotionIntegration.ts
import { Client } from '@notionhq/client';
import { IntegrationError } from '../types/result';

export class NotionIntegration {
  private notion: Client;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY || '' });
  }

  private requireKey() {
    if (!process.env.NOTION_API_KEY) throw new IntegrationError('NOTION_API_KEY not set in .env');
  }

  // Extract plain text from any block type that carries rich_text.
  private blockText(block: any): string {
    const rich =
      block?.[block.type]?.rich_text ||
      block?.[block.type]?.text ||
      [];
    return Array.isArray(rich) ? rich.map((t: any) => t.plain_text || t.text?.content || '').join('') : '';
  }

  // 1. Search Pages
  async searchPages(query: string): Promise<string> {
    this.requireKey();
    try {
      const response = await this.notion.search({
        query: query,
        filter: { property: 'object', value: 'page' }
      });

      if (response.results.length === 0) return `No pages found matching: ${query}`;

      let result = `Found pages:\n`;
      for (const page of response.results) {
        const titleProp = (page as any).properties?.title?.title?.[0]?.plain_text ||
                          (page as any).properties?.Name?.title?.[0]?.plain_text ||
                          'Untitled';
        result += `- Title: ${titleProp} | ID: ${page.id}\n`;
      }
      return result;
    } catch (error) {
      throw new IntegrationError('Failed to search Notion', error);
    }
  }

  // 2. Read Page Content
  async readPage(pageId: string): Promise<string> {
    this.requireKey();
    try {
      const blocks = await this.notion.blocks.children.list({ block_id: pageId, page_size: 25 });

      if (blocks.results.length === 0) return `Page is empty or has no text blocks.`;

      let content = `Page Content:\n`;
      for (const block of blocks.results) {
        // Handle every common text-bearing block type, not just paragraphs.
        const text = this.blockText(block);
        if (text) content += `- ${text}\n`;
      }
      return content.trim() === 'Page Content:' ? 'Page has no readable text content.' : content;
    } catch (error) {
      throw new IntegrationError('Failed to read page', error);
    }
  }

  // 3. Create Page (in a database)
  async createPage(databaseId: string, title: string): Promise<string> {
    this.requireKey();
    try {
      // Discover the DB's actual title property name instead of assuming "Name".
      const db = await this.notion.databases.retrieve({ database_id: databaseId });
      const titlePropName =
        Object.entries((db as any).properties || {}).find(([, p]: [string, any]) => p.type === 'title')?.[0] || 'Name';

      await this.notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          [titlePropName]: { title: [{ text: { content: title } }] }
        }
      });
      return `Successfully created Notion page: ${title}`;
    } catch (error) {
      throw new IntegrationError('Failed to create Notion page', error);
    }
  }

  // 4. Edit Page (Append text block to bottom of page)
  async editPage(pageId: string, text: string): Promise<string> {
    this.requireKey();
    try {
      await this.notion.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [{ type: 'text', text: { content: text } }] }
          }
        ]
      });
      return `Successfully appended text to Notion page ${pageId}.`;
    } catch (error) {
      throw new IntegrationError('Failed to edit Notion page', error);
    }
  }

  // 5. Update Database (Change Database Title)
  async updateDatabase(databaseId: string, newTitle: string): Promise<string> {
    this.requireKey();
    try {
      await this.notion.databases.update({
        database_id: databaseId,
        title: [{ text: { content: newTitle } }]
      });
      return `Successfully updated Notion database title to: ${newTitle}`;
    } catch (error) {
      throw new IntegrationError('Failed to update Notion database', error);
    }
  }
}
