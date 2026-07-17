// src/integrations/TelegramIntegration.ts
//
// Send-only Telegram notifications via the Bot API.
// Auth: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.

import axios from 'axios';
import { IntegrationError } from '../types/result';
import { NotifyPayload, formatTelegramHtml } from './notifyFormat';

export class TelegramIntegration {
  readonly name = 'telegram';
  private token = process.env.TELEGRAM_BOT_TOKEN || '';
  private chatId = process.env.TELEGRAM_CHAT_ID || '';

  /** True when the bot token and chat id are both present. */
  isConfigured(): boolean {
    return !!(this.token && this.chatId);
  }

  private async post(text: string, parseMode?: string): Promise<string> {
    if (!this.token || !this.chatId) {
      throw new IntegrationError('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set in .env');
    }
    try {
      await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        chat_id: this.chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
      return 'Successfully sent Telegram message.';
    } catch (error) {
      throw new IntegrationError('Failed to send Telegram message', error);
    }
  }

  /** Plain send (used by the channel-specific tool). */
  async sendMessage(message: string): Promise<string> {
    return this.post(message);
  }

  /** Formatted send for the notify fan-out: bold title + emoji via HTML. */
  async sendNotification(payload: NotifyPayload): Promise<string> {
    return this.post(formatTelegramHtml(payload), 'HTML');
  }
}
