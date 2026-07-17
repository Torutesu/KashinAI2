// src/utils/metricsHistory.ts
//
// In-memory time series of metric snapshots, sampled periodically so the
// dashboard can graph counters over time. Ring buffer; transient (cleared on
// restart), like the metrics themselves.

export interface MetricSample {
  t: number; // epoch ms
  values: Record<string, number>;
}

const MAX_SAMPLES = 120; // e.g. 120 samples * 30s ≈ 1 hour
const samples: MetricSample[] = [];

export function recordSample(values: Record<string, number>, at: number): void {
  samples.push({ t: at, values: { ...values } });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

export function getSeries(): MetricSample[] {
  return samples.slice();
}

export function clearSeries(): void {
  samples.length = 0;
}
