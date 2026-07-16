// src/memory/noiseFilter.ts
//
// Decide whether a piece of captured text is worth embedding into the vector
// store. Collectors fire frequently (window titles every few seconds), so
// embedding everything both floods the index and pollutes semantic search with
// low-signal noise. Pure so it can be unit tested.

const GENERIC_TITLES = new Set([
  'new tab',
  'untitled',
  'loading',
  'about:blank',
  'home',
  'start page',
]);

/** True when `text` is too low-signal to be worth embedding. */
export function isLowSignalText(text: string): boolean {
  const t = (text || '').trim();
  if (t.length < 4) return true;
  // No letters at all (pure digits/punctuation/whitespace) → not useful to search.
  if (!/[a-zA-ZÀ-￿]/.test(t)) return true;
  if (GENERIC_TITLES.has(t.toLowerCase())) return true;
  return false;
}
