// src/routes/ops.ts
//
// Operational endpoints: /metrics (Prometheus counters) and /ready (readiness
// probe). Factored out of app.ts so they can be tested in isolation.

import { Request, Response } from 'express';
import { renderPrometheus } from '../utils/metrics';

export function metricsHandler(_req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderPrometheus());
}

/** Readiness probe: 200 when ready, 503 otherwise (e.g. vector DB still loading). */
export function createReadyHandler(isReady: () => boolean) {
  return (_req: Request, res: Response) => {
    if (isReady()) {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  };
}

/** Version/info endpoint (used by the dashboard header). */
export function createVersionHandler(version: string) {
  return (_req: Request, res: Response) => {
    res.json({ name: 'KashinAI2', version });
  };
}
