// src/middleware/rateLimit.ts
//
// Lightweight in-memory fixed-window rate limiter. The action layer can trigger
// real side effects, so an unbounded request rate is a liability. Keyed by
// client IP; configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX
// (set RATE_LIMIT_MAX=0 to disable). The core RateLimiter is pure (takes `now`)
// so it can be unit tested without timers.

import { Request, Response, NextFunction } from 'express';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private buckets: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(opts: { windowMs: number; max: number }) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  hit(key: string, now: number): RateLimitDecision {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }
    if (bucket.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }
    bucket.count++;
    return { allowed: true, remaining: this.max - bucket.count, resetAt: bucket.resetAt };
  }
}

/** Express middleware wrapping a RateLimiter. Disabled entirely when max <= 0. */
export function createRateLimiter(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const max = opts?.max ?? parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

  if (!Number.isFinite(max) || max <= 0) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const limiter = new RateLimiter({ windowMs, max });

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const decision = limiter.hit(key, Date.now());

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, decision.remaining)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

    if (!decision.allowed) {
      const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Slow down.' });
    }
    next();
  };
}
