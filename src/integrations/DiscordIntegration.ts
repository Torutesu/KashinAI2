// src/integrations/DiscordIntegration.ts
//
// Send-only Discord notifications via an incoming webhook.
// Auth: DISCORD_WEBHOOK_URL.

import axios from 'axios';
import { IntegrationError } from '../types/result';
import { NotifyPayload, formatDiscordMarkdown } from './notifyFormat';

export class DiscordIntegration {
  readonly name = 'discord';
  private webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

  /** True when the incoming webhook URL is present. */
  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  private async post(content: string): Promise<string> {
    if (!this.webhookUrl) {
      throw new IntegrationError('DISCORD_WEBHOOK_URL not set in .env');
    }
    try {
      await axios.post(this.webhookUrl, { content: content.slice(0, 2000) });
      return 'Successfully sent Discord message.';
    } catch (error) {
      throw new IntegrationError('Failed to send Discord message', error);
    }
  }

  /** Plain send (used by the channel-specific tool). */
  async sendMessage(message: string): Promise<string> {
    return this.post(message);
  }

  /** Formatted send for the notify fan-out: bold title + emoji via Markdown. */
  async sendNotification(payload: NotifyPayload): Promise<string> {
    return this.post(formatDiscordMarkdown(payload));
  }
}
