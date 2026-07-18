// src/integrations/NotifyScheduler.ts
//
// In-process scheduler for delayed notifications ("remind me in 30 minutes").
// Timers are transient — pending schedules are lost on restart, like the other
// in-memory state (metrics, action log). The clock and timer functions are
// injectable so the logic is unit-testable without real time.

import { IntegrationError } from '../types/result';
import { NotifyPayload } from './notifyFormat';

export interface ScheduledItem {
  id: string;
  fireAt: number; // epoch ms
  payload: NotifyPayload;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface SchedulerDeps {
  setTimer?: (cb: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  now?: () => number;
}

export class NotifyScheduler {
  static readonly MIN_MS = 60_000; // 1 minute
  static readonly MAX_MS = 24 * 60 * 60 * 1000; // 24 hours

  private readonly pending = new Map<string, { item: ScheduledItem; handle: TimerHandle }>();
  private seq = 0;
  private readonly setTimer: (cb: () => void, ms: number) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;
  private readonly now: () => number;

  constructor(private readonly send: (payload: NotifyPayload) => Promise<unknown>, deps: SchedulerDeps = {}) {
    this.setTimer = deps.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h));
    this.now = deps.now ?? (() => Date.now());
  }

  /** Schedule a payload to be sent after delayMs; returns the queued item. */
  schedule(payload: NotifyPayload, delayMs: number): ScheduledItem {
    if (!payload.body || !payload.body.trim()) {
      throw new IntegrationError('notify_later: message is empty');
    }
    if (!Number.isFinite(delayMs) || delayMs < NotifyScheduler.MIN_MS || delayMs > NotifyScheduler.MAX_MS) {
      throw new IntegrationError('notify_later: delay must be between 1 minute and 24 hours');
    }
    const id = `n${++this.seq}`;
    const item: ScheduledItem = { id, fireAt: this.now() + delayMs, payload };
    const handle = this.setTimer(() => {
      this.pending.delete(id);
      void Promise.resolve(this.send(payload)).catch(() => { /* best-effort */ });
    }, delayMs);
    // Don't keep the event loop alive just for a pending reminder.
    (handle as { unref?: () => void })?.unref?.();
    this.pending.set(id, { item, handle });
    return item;
  }

  /** Pending schedules, soonest first. */
  list(): ScheduledItem[] {
    return [...this.pending.values()].map((v) => v.item).sort((a, b) => a.fireAt - b.fireAt);
  }

  count(): number {
    return this.pending.size;
  }

  /** Cancel a pending schedule by id; returns true if one was removed. */
  cancel(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.clearTimer(entry.handle);
    this.pending.delete(id);
    return true;
  }

  clearAll(): void {
    for (const entry of this.pending.values()) this.clearTimer(entry.handle);
    this.pending.clear();
  }
}
