// src/integrations/BrowserAutomationIntegration.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export class BrowserAutomationIntegration {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  // Lazy-load the browser so it only starts when the AI needs it
  private async init() {
    if (!this.browser) {
      // headless: false means it opens a visible window on your screen
      this.browser = await chromium.launch({ headless: false });
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
    }
    if (!this.page) {
      this.page = await this.context!.newPage();
    }
    return this.page;
  }

  // 1. Navigate current tab
  async navigate(url: string): Promise<string> {
    try {
      const page = await this.init();
      await page.goto(url);
      return `Successfully navigated to ${url}.`;
    } catch (error) {
      return `Error navigating: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2. Get Current Tab Info (URL and Title)
  async getCurrentTab(): Promise<string> {
    try {
      const page = await this.init();
      const url = page.url();
      const title = await page.title();
      return `Current Tab -> Title: "${title}" | URL: ${url}`;
    } catch (error) {
      return `Error getting current tab: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 3. Open New Tab
  async openNewTab(url: string): Promise<string> {
    try {
      if (!this.context) await this.init();
      const newPage = await this.context!.newPage();
      await newPage.goto(url);
      this.page = newPage; // Set focus to the new tab
      return `Successfully opened new tab at ${url}.`;
    } catch (error) {
      return `Error opening new tab: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 4. Close Tab
  async closeTab(): Promise<string> {
    try {
      const page = await this.init();
      await page.close();
      
      // Shift focus to the last available tab if any exist
      if (this.context && this.context.pages().length > 0) {
        this.page = this.context.pages()[this.context.pages().length - 1];
      } else {
        this.page = null;
      }
      return `Successfully closed the current tab.`;
    } catch (error) {
      return `Error closing tab: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 5. Read Content
  async readContent(): Promise<string> {
    try {
      const page = await this.init();
      const text = await page.innerText('body');
      return text.substring(0, 2000);
    } catch (error) {
      return `Error reading content: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 6. Click
  async click(selector: string): Promise<string> {
    try {
      const page = await this.init();
      await page.click(selector, { timeout: 5000 });
      return `Successfully clicked element: ${selector}`;
    } catch (error) {
      return `Error clicking: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 7. Fill Form
  async fill(selector: string, value: string): Promise<string> {
    try {
      const page = await this.init();
      await page.fill(selector, value, { timeout: 5000 });
      return `Successfully filled ${selector} with value: ${value}`;
    } catch (error) {
      return `Error filling form: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 8. Close Browser entirely
  async close(): Promise<string> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
      }
      return `Browser closed.`;
    } catch (error) {
      return `Error closing browser: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}