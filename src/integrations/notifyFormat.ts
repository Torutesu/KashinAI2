// src/integrations/notifyFormat.ts
//
// Pure per-channel formatting for notifications. A NotifyPayload (optional
// title + severity + body) is rendered differently per channel so each uses its
// native styling: Telegram via HTML parse_mode, Discord via Markdown. Kept free
// of any network/SDK code so it is trivially unit-testable.

export type NotifyLevel = 'info' | 'warn' | 'error';

export interface NotifyPayload {
  body: string;
  title?: string;
  level?: NotifyLevel;
}

const EMOJI: Record<NotifyLevel, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '🚨',
};

/** Leading emoji for a severity level, or '' when unset/unknown. */
export function levelEmoji(level?: NotifyLevel): string {
  return level && EMOJI[level] ? EMOJI[level] : '';
}

/** Coerce arbitrary input into a valid NotifyLevel, or undefined. */
export function parseLevel(value: unknown): NotifyLevel | undefined {
  const v = String(value ?? '').toLowerCase();
  return v === 'info' || v === 'warn' || v === 'error' ? v : undefined;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render for Telegram's HTML parse_mode: emoji + bold title, escaped body. */
export function formatTelegramHtml(p: NotifyPayload): string {
  const prefix = [levelEmoji(p.level), p.title ? `<b>${escapeHtml(p.title)}</b>` : '']
    .filter(Boolean)
    .join(' ');
  const body = escapeHtml(p.body);
  return prefix ? `${prefix}\n${body}` : body;
}

/** Render for Discord Markdown: emoji + bold title, plain body (2000 char cap). */
export function formatDiscordMarkdown(p: NotifyPayload): string {
  const prefix = [levelEmoji(p.level), p.title ? `**${p.title}**` : '']
    .filter(Boolean)
    .join(' ');
  return (prefix ? `${prefix}\n${p.body}` : p.body).slice(0, 2000);
}

/** Plain-text fallback (no markup) used by generic channels. */
export function formatPlain(p: NotifyPayload): string {
  const prefix = [levelEmoji(p.level), p.title].filter(Boolean).join(' ');
  return prefix ? `${prefix}\n${p.body}` : p.body;
}
