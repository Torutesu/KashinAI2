// tests/ranking.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates, Candidate } from '../src/retriever/ranking';

const NOW = Date.parse('2026-07-15T00:00:00.000Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 24 * 3600 * 1000).toISOString();

test('closer vector distance ranks higher (all else equal)', () => {
  const cands: Candidate[] = [
    { text: 'far match', type: 'OCR', source: 'vector', distance: 0.9, timestamp: iso(0) },
    { text: 'near match', type: 'OCR', source: 'vector', distance: 0.1, timestamp: iso(0) },
  ];
  const ranked = rankCandidates(cands, NOW, 5);
  assert.equal(ranked[0].text, 'near match');
});

test('recency breaks ties between equally relevant items', () => {
  const cands: Candidate[] = [
    { text: 'old note', type: 'CLIPBOARD', source: 'keyword', timestamp: iso(30) },
    { text: 'fresh note', type: 'CLIPBOARD', source: 'keyword', timestamp: iso(0) },
  ];
  const ranked = rankCandidates(cands, NOW, 5);
  assert.equal(ranked[0].text, 'fresh note');
});

test('a memory found by both vector and keyword is merged and boosted', () => {
  const cands: Candidate[] = [
    { text: 'Deploy failed on prod', type: 'SLACK', source: 'vector', distance: 0.4, timestamp: iso(1) },
    { text: 'deploy failed on prod', type: 'SLACK', source: 'keyword', timestamp: iso(1) },
    { text: 'unrelated', type: 'OCR', source: 'vector', distance: 0.4, timestamp: iso(1) },
  ];
  const ranked = rankCandidates(cands, NOW, 5);
  // The dual-source item dedupes to one entry listing both sources, ranked first.
  const dual = ranked.find((r) => r.sources.length === 2);
  assert.ok(dual, 'expected a merged dual-source item');
  assert.equal(dual!.sources.sort().join(','), 'keyword,vector');
  assert.equal(ranked[0].text.toLowerCase(), 'deploy failed on prod');
});

test('blank candidates are dropped and limit is respected', () => {
  const cands: Candidate[] = [
    { text: '   ', type: 'OCR', source: 'keyword', timestamp: iso(0) },
    { text: 'a', type: 'OCR', source: 'keyword', timestamp: iso(0) },
    { text: 'b', type: 'OCR', source: 'keyword', timestamp: iso(1) },
    { text: 'c', type: 'OCR', source: 'keyword', timestamp: iso(2) },
  ];
  const ranked = rankCandidates(cands, NOW, 2);
  assert.equal(ranked.length, 2);
  assert.ok(!ranked.some((r) => r.text.trim() === ''));
});
