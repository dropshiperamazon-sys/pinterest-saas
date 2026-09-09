// Category Relevance Engine — generic, multi-signal, weighted scoring
// Works for any topic without hard-coded category rules.

import type { TopicProfile } from "./topic-profiler";

export const CATEGORIES = [
  "Home Decor",
  "Interior Design",
  "Fashion",
  "Beauty",
  "Food",
  "Fitness",
  "Travel",
  "Parenting",
  "Wedding",
  "DIY",
  "Lifestyle",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number] | string;

// ── Score weights (must sum to 1.0) ─────────────────────────────────────────
const WEIGHTS = {
  urlSlug:         0.20,
  pageTitle:       0.25,
  h1:              0.15,
  headings:        0.15,
  metaDescription: 0.10,
  bodyText:        0.10,
  phraseBonus:     0.05,  // extra credit when multi-word phrases from profile match
} as const;

export interface ScoredSignal {
  field: keyof typeof WEIGHTS;
  raw: number;        // 0–100
  weighted: number;
}

export interface RelevanceResult {
  score: number;        // 0–100 overall
  matchReason: string;  // human-readable explanation
  signals: ScoredSignal[];
}

// ── Tokenization ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1);
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ── Core scoring for a single field ─────────────────────────────────────────
// Returns 0–100 for how well the text matches the topic profile.

function scoreField(text: string, profile: TopicProfile): number {
  if (!text.trim()) return 0;

  const norm = normalizeText(text);
  const tokens = tokenize(text);

  if (tokens.length === 0) return 0;

  let score = 0;

  // 1. Primary terms — each term that appears adds significant score
  const primaryHits = profile.primaryTerms.filter((t) => norm.includes(t));
  const primaryRatio = profile.primaryTerms.length > 0
    ? primaryHits.length / profile.primaryTerms.length
    : 0;
  score += primaryRatio * 50; // up to 50 points for primary term coverage

  // 2. Phrase matches — multi-word phrases score higher than individual words
  let phraseBonus = 0;
  for (const phrase of profile.phrases) {
    if (phrase.split(" ").length >= 2 && norm.includes(phrase)) {
      phraseBonus = Math.max(phraseBonus, 30);
    }
  }
  score += phraseBonus;

  // 3. Synonym hits — each synonym that appears adds modest score
  const synHits = profile.synonyms.filter((s) => norm.includes(s));
  const synScore = Math.min(20, synHits.length * 5);
  score += synScore;

  // 4. Anti-term penalty — if an anti-term appears and primary coverage is low,
  //    reduce score to avoid false positives
  const antiHits = profile.antiTerms.filter((a) => norm.includes(a));
  if (antiHits.length > 0 && primaryRatio < 0.5) {
    score *= 0.4; // heavy penalty for anti-term without primary coverage
  }

  // Clamp 0–100
  return Math.min(100, Math.round(score));
}

// ── URL slug scoring ─────────────────────────────────────────────────────────

function scoreUrlSlug(url: string, profile: TopicProfile): number {
  try {
    const parsed = new URL(url);
    // Use the full path, not just the final segment, to capture category paths
    const text = parsed.pathname.replace(/\//g, " ").replace(/[-_]/g, " ");
    return scoreField(text, profile);
  } catch {
    return 0;
  }
}

// ── Aggregated scoring from all signals ─────────────────────────────────────

export interface PageSignals {
  url: string;
  title?: string;
  h1?: string;
  headings?: string;   // concatenated H2/H3 text
  metaDescription?: string;
  bodySnippet?: string; // first ~500 chars of body text
}

export function scoreRelevanceFull(signals: PageSignals, profile: TopicProfile): RelevanceResult {
  const slug = scoreUrlSlug(signals.url, profile);
  const title = scoreField(signals.title ?? "", profile);
  const h1 = scoreField(signals.h1 ?? "", profile);
  const headings = scoreField(signals.headings ?? "", profile);
  const meta = scoreField(signals.metaDescription ?? "", profile);
  const body = scoreField(signals.bodySnippet ?? "", profile);

  // Phrase bonus: did any multi-word phrase hit in ANY field?
  const allText = [signals.title, signals.h1, signals.headings, signals.metaDescription, signals.bodySnippet]
    .filter(Boolean).join(" ");
  const norm = normalizeText(allText);
  const phraseBonusRaw = profile.phrases.some(
    (p) => p.split(" ").length >= 2 && norm.includes(p)
  ) ? 100 : 0;

  const overall = Math.round(
    slug        * WEIGHTS.urlSlug +
    title       * WEIGHTS.pageTitle +
    h1          * WEIGHTS.h1 +
    headings    * WEIGHTS.headings +
    meta        * WEIGHTS.metaDescription +
    body        * WEIGHTS.bodyText +
    phraseBonusRaw * WEIGHTS.phraseBonus
  );

  // Build match reason
  const reasons: string[] = [];
  if (title >= 60) reasons.push("title");
  if (h1 >= 60) reasons.push("H1");
  if (slug >= 60) reasons.push("URL slug");
  if (headings >= 60) reasons.push("headings");
  if (meta >= 40) reasons.push("meta description");
  if (body >= 40) reasons.push("page content");
  if (phraseBonusRaw > 0) reasons.push("phrase match");

  const matchReason = reasons.length > 0
    ? `Matched via: ${reasons.join(", ")}`
    : overall >= 30
    ? "Weak match — partial keyword overlap"
    : "Low relevance";

  return {
    score: Math.min(100, overall),
    matchReason,
    signals: [
      { field: "urlSlug",         raw: slug,           weighted: Math.round(slug        * WEIGHTS.urlSlug) },
      { field: "pageTitle",       raw: title,          weighted: Math.round(title       * WEIGHTS.pageTitle) },
      { field: "h1",              raw: h1,             weighted: Math.round(h1          * WEIGHTS.h1) },
      { field: "headings",        raw: headings,       weighted: Math.round(headings    * WEIGHTS.headings) },
      { field: "metaDescription", raw: meta,           weighted: Math.round(meta        * WEIGHTS.metaDescription) },
      { field: "bodyText",        raw: body,           weighted: Math.round(body        * WEIGHTS.bodyText) },
      { field: "phraseBonus",     raw: phraseBonusRaw, weighted: Math.round(phraseBonusRaw * WEIGHTS.phraseBonus) },
    ],
  };
}

// Stage-1 fast pre-filter: URL slug only, no page fetch
export function scoreUrlOnly(url: string, profile: TopicProfile): number {
  return scoreUrlSlug(url, profile);
}

// ── Article URL detection ────────────────────────────────────────────────────

import { classifyUrl } from "./article-classifier";

export function isArticleUrl(url: string): boolean {
  return classifyUrl(url).pass;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function relevanceLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Highly Relevant",   color: "bg-green-100 text-green-700" };
  if (score >= 65) return { label: "Relevant",           color: "bg-blue-100 text-blue-700" };
  if (score >= 50) return { label: "Possibly Relevant",  color: "bg-yellow-100 text-yellow-700" };
  return                  { label: "Low Relevance",      color: "bg-gray-100 text-gray-500" };
}
