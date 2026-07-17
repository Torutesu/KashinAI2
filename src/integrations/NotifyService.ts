// src/integrations/NotifyService.ts
//
// Fan-out notification router. A single `notify` tool delivers one message to
// every configured channel (Telegram, Discord, …) so the assistant doesn't have
// to pick one. Which channels are eligible is controlled by NOTIFY_CHANNELS
// (comma-separated names, e.g. "telegram,discord"); unset means "all configured".

import { IntegrationError } from '../types/result';

/** A send-only notification channel the router can fan a message out to. */
export interface NotifyChannel {
  readonly name: string;
  isConfigured(): boolean;
  sendMessage(message: string): Promise<string>;
}

export class NotifyService {
  constructor(private readonly channels: NotifyChannel[]) {}

  /**
   * Channels the operator has opted into via NOTIFY_CHANNELS. An empty/unset
   * value means "every channel"; unknown names are ignored.
   */
  private selected(envValue: string | undefined): NotifyChannel[] {
    const wanted = (envValue || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (wanted.length === 0) return this.channels;
    return this.channels.filter((c) => wanted.includes(c.name));
  }

  /**
   * Deliver `message` to all selected, configured channels concurrently.
   * Succeeds if at least one channel accepts it; throws only when nothing is
   * eligible or every attempt fails.
   */
  async notify(message: string, envValue = process.env.NOTIFY_CHANNELS): Promise<string> {
    if (!message || !message.trim()) {
      throw new IntegrationError('notify: message is empty');
    }
    const targets = this.selected(envValue).filter((c) => c.isConfigured());
    if (targets.length === 0) {
      throw new IntegrationError(
        'notify: no configured channels. Set TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID and/or DISCORD_WEBHOOK_URL, and optionally NOTIFY_CHANNELS.'
      );
    }

    const results = await Promise.allSettled(targets.map((c) => c.sendMessage(message)));
    const ok: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      (r.status === 'fulfilled' ? ok : failed).push(targets[i].name);
    });

    if (ok.length === 0) {
      throw new IntegrationError(`notify: all channels failed (${failed.join(', ')})`);
    }
    let summary = `Notified via ${ok.join(', ')}.`;
    if (failed.length) summary += ` Failed: ${failed.join(', ')}.`;
    return summary;
  }
}
