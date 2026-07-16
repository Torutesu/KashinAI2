// src/retriever/ranking.ts
//
// Pure hybrid-ranking logic for retrieval: merge vector (semantic) and keyword
// (exact-substring) candidates, dedupe, and score by relevance + recency, with a
// small bonus when a memory is surfaced by BOTH signals. Kept dependency-free so
// it can be unit tested without a DB or embedding model.

export type CandidateSource = 'vector' | 'keyword';

export interface Candidate {
  text: string;
  type: string;
  source: CandidateSource;
  distance?: number; // vector distance (lower = closer); ignored for keyword
  timestamp?: string; // ISO timestamp; missing → neutral recency
}

export interface RankedItem {
  text: string;
  type: string;
  sources: CandidateSource[];
  score: number;
}

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // recency half-life ~1 week
const BOTH_SOURCES_BONUS = 0.05;

function relevanceScore(c: Candidate): number {
  if (c.source === 'vector') {
    const d = typeof c.distance === 'number' ? Math.max(0, c.distance) : 1;
    return 1 / (1 + d);
  }
  return 1; // an exact keyword substring hit is treated as fully relevant
}

function recencyScore(timestamp: string | undefined, now: number): number {
  if (!timestamp) return 0.5;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return 0.5;
  const age = Math.max(0, now - t);
  return Math.exp(-age / HALF_LIFE_MS);
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Merge, dedupe, and rank candidates. Returns the top `limit` by combined score. */
export function rankCandidates(candidates: Candidate[], now: number, limit = 5): RankedItem[] {
  const byKey = new Map<string, RankedItem>();

  for (const c of candidates) {
    if (!c.text || !c.text.trim()) continue;
    const key = normalize(c.text);
    const score = 0.6 * relevanceScore(c) + 0.4 * recencyScore(c.timestamp, now);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { text: c.text, type: c.type, sources: [c.source], score });
      continue;
    }
    const wasSingleSource = existing.sources.length === 1;
    if (!existing.sources.includes(c.source)) existing.sources.push(c.source);
    existing.score = Math.max(existing.score, score);
    // Surfaced by both vector AND keyword — a stronger signal.
    if (wasSingleSource && existing.sources.length === 2) existing.score += BOTH_SOURCES_BONUS;
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
