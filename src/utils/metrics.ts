// src/utils/metrics.ts
//
// Tiny in-memory counter registry for basic observability (events collected,
// tool calls, failures). No dependency; rendered in Prometheus text format at
// GET /metrics. Pure and resettable so it's unit testable.

const counters: Record<string, number> = {};

export function increment(name: string, by = 1): void {
  counters[name] = (counters[name] || 0) + by;
}

export function snapshot(): Record<string, number> {
  return { ...counters };
}

/** Render counters in Prometheus text exposition format. */
export function renderPrometheus(): string {
  const lines = Object.entries(counters).map(([name, value]) => `${name} ${value}`);
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

export function resetMetrics(): void {
  for (const key of Object.keys(counters)) delete counters[key];
}
