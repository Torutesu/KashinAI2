// src/routes/manage.ts
//
// Dashboard management handlers (token-gated at the route level in app.ts).
// Factored out with injected dependencies so they're testable without the DB /
// embedding stack.

import { Request, Response } from 'express';
import { getExcludeApps, setExcludeApps } from '../collectors/activeAppState';
import { recentActions } from '../utils/actionLog';
import { CLEARABLE_SOURCES } from '../memory/sources';

export function privacyGetHandler(_req: Request, res: Response) {
  res.json({ captureExcludeApps: getExcludeApps() });
}

/** PUT privacy list: live effect + persist via the injected persist fn. */
export function createPrivacyPutHandler(persist: (value: string) => Promise<void>) {
  return async (req: Request, res: Response) => {
    const value = typeof req.body?.captureExcludeApps === 'string' ? req.body.captureExcludeApps : '';
    setExcludeApps(value); // live, no restart
    try {
      await persist(value);
    } catch {
      return res.status(500).json({ error: 'Failed to persist setting' });
    }
    res.json({ captureExcludeApps: getExcludeApps() });
  };
}

export function actionsHistoryHandler(_req: Request, res: Response) {
  res.json({ actions: recentActions(50) });
}

/** POST memory clear: validates the source, delegates to the injected clearer. */
export function createMemoryClearHandler(clearSource: (source: string) => Promise<{ deleted: number; vectorsDeleted: number }>) {
  return async (req: Request, res: Response) => {
    const source = String(req.body?.source || '');
    if (!(CLEARABLE_SOURCES as readonly string[]).includes(source)) {
      return res.status(400).json({ error: `source must be one of: ${CLEARABLE_SOURCES.join(', ')}` });
    }
    const result = await clearSource(source);
    res.json({ source, ...result });
  };
}
