// src/integrations/DiscordIntegration.ts
//
// Send-only Discord notifications via an incoming webhook.
// Auth: DISCORD_WEBHOOK_URL.

import axios from 'axios';
import { IntegrationError } from '../types/result';

export class DiscordIntegration {
  readonly name = 'discord';
  private webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

  /** True when the incoming webhook URL is present. */
  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.webhookUrl) {
      throw new IntegrationError('DISCORD_WEBHOOK_URL not set in .env');
    }
    try {
      await axios.post(this.webhookUrl, { content: message.slice(0, 2000) });
      return 'Successfully sent Discord message.';
    } catch (error) {
      throw new IntegrationError('Failed to send Discord message', error);
    }
  }
}
