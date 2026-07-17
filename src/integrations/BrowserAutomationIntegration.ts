// src/integrations/BrowserAutomationIntegration.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { isSafeHttpUrl } from '../security/inputValidation';
import { IntegrationError } from '../types/result';

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
    if (!isSafeHttpUrl(url)) {
      throw new IntegrationError('Only http:// and https:// URLs are allowed.');
    }
    try {
      const page = await this.init();
      await page.goto(url);
      return `Successfully navigated to ${url}.`;
    } catch (error) {
      throw new IntegrationError('Failed to navigate', error);
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
      throw new IntegrationError('Failed to get current tab', error);
    }
  }

  // 3. Open New Tab
  async openNewTab(url: string): Promise<string> {
    if (!isSafeHttpUrl(url)) {
      throw new IntegrationError('Only http:// and https:// URLs are allowed.');
    }
    try {
      if (!this.context) await this.init();
      const newPage = await this.context!.newPage();
      await newPage.goto(url);
      this.page = newPage; // Set focus to the new tab
      return `Successfully opened new tab at ${url}.`;
    } catch (error) {
      throw new IntegrationError('Failed to open new tab', error);
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
      throw new IntegrationError('Failed to close tab', error);
    }
  }

  // 5. Read Content
  async readContent(): Promise<string> {
    try {
      const page = await this.init();
      const text = await page.innerText('body');
      return text.substring(0, 2000);
    } catch (error) {
      throw new IntegrationError('Failed to read content', error);
    }
  }

  // 6. Click
  async click(selector: string): Promise<string> {
    try {
      const page = await this.init();
      await page.click(selector, { timeout: 5000 });
      return `Successfully clicked element: ${selector}`;
    } catch (error) {
      throw new IntegrationError('Failed to click', error);
    }
  }

  // 7. Fill Form
  async fill(selector: string, value: string): Promise<string> {
    try {
      const page = await this.init();
      await page.fill(selector, value, { timeout: 5000 });
      // Do NOT echo `value` back — it may be a password or other secret that
      // would otherwise leak into logs and the model's context.
      return `Successfully filled ${selector}.`;
    } catch (error) {
      throw new IntegrationError('Failed to fill form', error);
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
      throw new IntegrationError('Failed to close browser', error);
    }
  }
}
