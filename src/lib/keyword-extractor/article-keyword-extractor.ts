// Automatically extracts primary + secondary keywords from a page without any user-provided topic.
// Uses agreement between URL slug, title, H1, and headings to determine what the article is about.

import type { PageMeta } from "./page-crawler";

// Generic words that should never be the primary keyword on their own
const FILLER_WORDS = new Set([
  "ideas","tips","ways","guide","guides","tutorial","tutorials","how","best",
  "top","easy","simple","quick","ultimate","complete","free","new","great",
  "good","perfect","beautiful","amazing","awesome","incredible","every","all",
  "most","more","your","our","my","these","those","this","that","just","make",
  "get","use","find","know","need","want","love","like","look","time","year",
  "home","house","room","life","things","stuff","list","post","blog","article",
  "what","why","when","where","which","who","can","do","does","did","will",
  "would","could","should","may","might","shall","is","are","was","were","be",
  "been","have","has","had","and","or","but","for","nor","so","yet",
  "a","an","the","of","in","on","at","to","by","as","it","up","out","into",
  // common verbs/prepositions/quantifiers that slip through stop-word filtering
  "much","many","move","moved","moving","choose","chosen","pick","keep","work",
  "works","working","look","looks","looking","help","helps","start","starts",
  "add","adds","turn","turns","become","makes","take","takes","show","shows",
  "give","gives","avoid","check","create","build","bring","feel","feel",
  "need","needs","want","wants","help","helps","tell","tells","let","lets",
  "come","goes","stay","stays","gone","done","said","seen","made","gave",
  "just","also","even","still","never","always","really","very","quite",
  "well","much","less","more","some","any","few","only","then","than",
]);

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","for","nor","so","yet","at","by","in",
  "of","on","to","up","as","is","it","its","from","with","this","that",
  "these","those","we","you","he","she","they","i","my","your","our","their",
  "what","how","why","when","where","which","who","all","any","each","more",
  "most","other","some","such","than","then","there","out","about","into",
  "through","own","same","too","very","just","now","here","both","few",
]);

export interface ArticleKeyword {
  primary: string;
  secondary: string[];
  confidence: number;       // 0–100
  cluster: string;          // derived topic cluster label
}

// ── Slug → clean phrase ───────────────────────────────────────────────────────

function slugToPhrase(url: string): string {
  try {
    const path = new URL(url).pathname;
    // Take the last non-numeric, non-year segment
    const segments = path.split("/").filter(Boolean);
    const meaningful = segments.filter(
      (s) => !/^\d{4}$/.test(s) && !/^\d+$/.test(s) && s.length > 2
    );
    const slug = meaningful.at(-1) ?? "";
    if (!slug) return "";
    return slug
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/[-_+]+/g, " ")
      .toLowerCase()
      .trim();
  } catch {
    return "";
  }
}

// ── Title → clean keyword phrase ─────────────────────────────────────────────

function titleToPhrase(title: string): string {
  if (!title) return "";
  let t = title
    .replace(/[-|:–—•·]/g, " ")   // split on separators (site name after dash, etc.)
    .split(/\s{2,}/)[0]            // take first chunk if double-space separated
    .trim();

  // Remove site name patterns: "Title | Site Name", "Title - Blog Name"
  const pipeIdx = t.lastIndexOf("|");
  const dashIdx = t.lastIndexOf(" - ");
  const splitAt = Math.max(pipeIdx, dashIdx);
  if (splitAt > 10) t = t.slice(0, splitAt).trim();

  // Remove leading numbers like "50 Small Kitchen Ideas…" → "Small Kitchen Ideas"
  t = t.replace(/^\d+\s+/, "").trim();

  return t.toLowerCase();
}

// ── Extract short phrase from title (stop-word trimmed) ──────────────────────

function extractCorePhrase(raw: string, maxWords = 5): string {
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  // Trim stop words from front and back
  let start = 0;
  let end = words.length - 1;
  while (start <= end && STOP_WORDS.has(words[start])) start++;
  while (end >= start && STOP_WORDS.has(words[end])) end--;
  const trimmed = words.slice(start, end + 1);
  // Cap at maxWords
  return trimmed.slice(0, maxWords).join(" ");
}

// ── Check if phrase appears in text ──────────────────────────────────────────

function phraseIn(phrase: string, text: string): boolean {
  if (!phrase || !text) return false;
  return text.toLowerCase().includes(phrase.toLowerCase());
}

// ── Confidence computation ────────────────────────────────────────────────────

function computeConfidence(
  primary: string,
  slug: string,
  titlePhrase: string,
  h1: string,
  headings: string,
): number {
  if (!primary) return 0;
  let score = 50;
  const p = primary.toLowerCase();
  if (phraseIn(p, slug)) score += 20;
  if (phraseIn(p, titlePhrase)) score += 15;
  if (phraseIn(p, h1)) score += 10;
  if (phraseIn(p, headings)) score += 5;
  // Extra if slug and title agree
  if (phraseIn(slug, titlePhrase) && slug.length > 5) score += 5;
  return Math.min(100, score);
}

// ── Secondary keyword extraction from headings ────────────────────────────────

function extractSecondaryFromHeadings(headings: string, primary: string): string[] {
  if (!headings) return [];
  const results: string[] = [];
  const seen = new Set<string>([primary.toLowerCase()]);

  for (const part of headings.split(/\|/)) {
    const phrase = extractCorePhrase(part, 5);
    if (!phrase || phrase.length < 5) continue;
    const norm = phrase.toLowerCase();
    if (seen.has(norm)) continue;
    // Must differ from primary
    if (phraseIn(primary.toLowerCase(), norm) || phraseIn(norm, primary.toLowerCase())) {
      seen.add(norm);
      continue;
    }
    if (FILLER_WORDS.has(norm)) continue;
    seen.add(norm);
    results.push(phrase);
    if (results.length >= 5) break;
  }
  return results;
}

// ── Cluster name from primary keyword ────────────────────────────────────────

function deriveCluster(primary: string): string {
  const words = primary.toLowerCase().split(/\s+/).filter(Boolean);
  // Pick the longest non-filler, non-stop word — longer words are more specific nouns
  let best = "";
  for (const w of words) {
    if (!FILLER_WORDS.has(w) && !STOP_WORDS.has(w) && w.length >= 4) {
      if (w.length > best.length) best = w;
    }
  }
  if (best) return best.charAt(0).toUpperCase() + best.slice(1);
  return words[0]
    ? words[0].charAt(0).toUpperCase() + words[0].slice(1)
    : "General";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function extractArticleKeyword(meta: PageMeta): ArticleKeyword {
  const slug = slugToPhrase(meta.url);
  const titlePhrase = titleToPhrase(meta.title || meta.ogTitle || "");
  const h1 = (meta.h1 || "").toLowerCase().trim();

  let primary = "";
  let confidence = 40;

  // Strategy 1: slug phrase appears verbatim in title → highest confidence
  if (slug.split(" ").length >= 2 && phraseIn(slug, titlePhrase)) {
    primary = slug;
    confidence = computeConfidence(primary, slug, titlePhrase, h1, meta.headings || "");
  }

  // Strategy 2: slug phrase appears in H1
  if (!primary && slug.split(" ").length >= 2 && phraseIn(slug, h1)) {
    primary = slug;
    confidence = computeConfidence(primary, slug, titlePhrase, h1, meta.headings || "");
  }

  // Strategy 3: derive from title directly (clean stop-word-trimmed phrase)
  if (!primary) {
    const coreFromTitle = extractCorePhrase(titlePhrase, 5);
    if (coreFromTitle.split(" ").length >= 2) {
      primary = coreFromTitle;
      confidence = computeConfidence(primary, slug, titlePhrase, h1, meta.headings || "");
    }
  }

  // Strategy 4: fall back to slug
  if (!primary && slug) {
    primary = slug;
    confidence = 45;
  }

  // Strategy 5: last resort, use title first 5 non-stop words
  if (!primary) {
    const fromTitle = titlePhrase.split(/\s+/).filter((w) => !STOP_WORDS.has(w)).slice(0, 4).join(" ");
    primary = fromTitle || "unknown";
    confidence = 30;
  }

  const secondary = extractSecondaryFromHeadings(meta.headings || "", primary);
  // Also pull from meta description
  if (meta.metaDescription) {
    const metaPhrase = extractCorePhrase(meta.metaDescription, 5);
    const metaNorm = metaPhrase.toLowerCase();
    if (
      metaPhrase.split(" ").length >= 2 &&
      !phraseIn(primary.toLowerCase(), metaNorm) &&
      !phraseIn(metaNorm, primary.toLowerCase()) &&
      secondary.length < 5
    ) {
      secondary.push(metaPhrase);
    }
  }

  const cluster = deriveCluster(primary);

  return { primary, secondary: secondary.slice(0, 5), confidence, cluster };
}

// ── Aggregate duplicate keywords across articles ──────────────────────────────

export interface KeywordAggregate {
  keyword: string;
  articleCount: number;
  avgConfidence: number;
  cluster: string;
  articles: Array<{ url: string; title: string }>;
}

export function aggregateKeywords(
  articles: Array<{ url: string; title: string; primary: string; confidence: number; cluster: string }>
): KeywordAggregate[] {
  const map = new Map<string, { items: typeof articles; cluster: string }>();
  for (const a of articles) {
    const key = a.primary.toLowerCase().trim();
    if (!key) continue;
    const entry = map.get(key) ?? { items: [], cluster: a.cluster };
    entry.items.push(a);
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([keyword, { items, cluster }]) => ({
      keyword,
      articleCount: items.length,
      avgConfidence: Math.round(items.reduce((s, i) => s + i.confidence, 0) / items.length),
      cluster,
      articles: items.slice(0, 5).map((i) => ({ url: i.url, title: i.title })),
    }))
    .sort((a, b) => b.articleCount - a.articleCount || b.avgConfidence - a.avgConfidence);
}

// ── Build topic clusters from aggregated keywords ────────────────────────────

export interface TopicCluster {
  name: string;
  keywords: string[];
  totalArticles: number;
}

export function buildClusters(aggregates: KeywordAggregate[]): TopicCluster[] {
  const clusterMap = new Map<string, { keywords: string[]; articles: number }>();
  for (const agg of aggregates) {
    const name = agg.cluster;
    const entry = clusterMap.get(name) ?? { keywords: [], articles: 0 };
    entry.keywords.push(agg.keyword);
    entry.articles += agg.articleCount;
    clusterMap.set(name, entry);
  }
  return Array.from(clusterMap.entries())
    .map(([name, { keywords, articles }]) => ({
      name,
      keywords: keywords.slice(0, 10),
      totalArticles: articles,
    }))
    .sort((a, b) => b.totalArticles - a.totalArticles);
}
