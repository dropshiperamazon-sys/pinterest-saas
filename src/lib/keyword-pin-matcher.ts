/**
 * Keyword-to-Pin matching service.
 *
 * Pinterest does NOT expose which pins "rank" for a keyword.
 * We associate pins with a tracked keyword using text matching on
 * the pin's own title and description fields.
 *
 * Match types (in descending precision):
 *   EXACT  — pin text contains the keyword as a complete word boundary match
 *   PHRASE — pin text contains all words of the keyword (order-insensitive)
 *
 * The architecture is centralised here so smarter matching (semantic,
 * Pinterest autocomplete signal, etc.) can be plugged in later without
 * touching the UI or API routes.
 */

import type { PinAssociation, MatchType } from "./track-keywords-db";

interface PinText {
  pinId: string;
  title: string;
  description: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreExact(pinText: string, keyword: string): number {
  const norm = normalize(pinText);
  const kw = normalize(keyword);
  // Word-boundary-aware: check the normalised text contains the keyword as a substring
  // (both surrounded by word separators or start/end)
  const pattern = new RegExp(`(^|\\s)${kw.replace(/\s+/g, "\\s+")}(\\s|$)`);
  return pattern.test(norm) ? 100 : 0;
}

function scorePhrase(pinText: string, keyword: string): number {
  const norm = normalize(pinText);
  const words = normalize(keyword).split(" ").filter(Boolean);
  if (!words.length) return 0;
  const matched = words.filter(w => norm.includes(w));
  const ratio = matched.length / words.length;
  if (ratio < 0.5) return 0;
  // Partial phrase match — score proportionally
  return Math.round(ratio * 80);
}

/**
 * Match a single keyword against an array of pins.
 * Returns associations sorted by matchScore descending.
 */
export function matchPinsToKeyword(keyword: string, pins: PinText[]): PinAssociation[] {
  const results: PinAssociation[] = [];
  const now = Date.now();

  for (const pin of pins) {
    const combinedText = `${pin.title} ${pin.description}`;

    const exactScore = Math.max(
      scoreExact(pin.title, keyword),
      scoreExact(pin.description, keyword)
    );
    if (exactScore > 0) {
      results.push({ pinId: pin.pinId, matchType: "EXACT", matchScore: exactScore, createdAt: now });
      continue;
    }

    const phraseScore = Math.max(
      scorePhrase(pin.title, keyword),
      scorePhrase(pin.description, keyword),
      scorePhrase(combinedText, keyword)
    );
    if (phraseScore > 0) {
      results.push({ pinId: pin.pinId, matchType: "PHRASE", matchScore: phraseScore, createdAt: now });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

export type { PinText, MatchType };
