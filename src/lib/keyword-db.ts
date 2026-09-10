// Keyword Knowledge Store — Redis-backed persistent keyword database
//
// Key schema:
//   kwdb:seq                          → integer auto-increment ID
//   kwdb:kw:{id}                      → JSON KeywordRecord
//   kwdb:lookup:{norm_kw}:{country}   → keyword ID string
//   kwdb:idx:all                      → Sorted set (score=created_at ms, member=id)
//   kwdb:idx:country:{country}        → Set of IDs
//   kwdb:idx:cat:{category}           → Set of IDs
//   kwdb:rel:{id}                     → Hash: relatedId → JSON KeywordRelationship
//   kwdb:gap:{id}                     → JSON DataGapRequest
//   kwdb:gap:lookup:{norm_kw}:{cc}    → gap ID (dedup)
//   kwdb:gap:idx                      → Sorted set (score=request_count desc proxy)
//   kwdb:import:{id}                  → JSON ImportRecord
//   kwdb:import:idx                   → Sorted set (score=imported_at ms, member=id)
//   kwdb:search:{date}                → Sorted set (score=count, member=norm_kw:country)

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type DataSource =
  | "PINTEREST_API"
  | "PINTEREST_RELATED"
  | "GOOGLE_KEYWORD_PLANNER"
  | "SEMRUSH"
  | "AHREFS"
  | "ADMIN_IMPORTED"
  | "USER_SEARCH_SIGNAL"
  | "AI_INFERRED";

export type ConfidenceStatus = "VERIFIED" | "ESTIMATED" | "UNVERIFIED" | "STALE";
export type RelationshipType = "RELATED" | "PHRASE_MATCH" | "SEMANTIC" | "CATEGORY" | "PINTEREST_API" | "HUMAN_VERIFIED";
export type GapStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

// Pinterest-sourced data must not be stored indefinitely (Pinterest API ToS).
// These sources get a 7-day TTL on their Redis keys.
const PINTEREST_SOURCES = new Set<DataSource>(["PINTEREST_API", "PINTEREST_RELATED"]);
const PINTEREST_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Source priority — lower number = higher authority. Never overwrite higher with lower.
export const SOURCE_PRIORITY: Record<DataSource, number> = {
  PINTEREST_API: 1,
  GOOGLE_KEYWORD_PLANNER: 2,
  SEMRUSH: 2,
  AHREFS: 2,
  ADMIN_IMPORTED: 3,
  PINTEREST_RELATED: 4,
  USER_SEARCH_SIGNAL: 9,
  AI_INFERRED: 10,
};

export interface KeywordRecord {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  country: string;           // ISO-2: US, GB, CA, AU, ...
  language: string;          // en, de, fr, ...
  monthlySearches: number | null;
  competition: "low" | "medium" | "high" | null;
  avgCpc: number | null;
  trend: number | null;      // percentage, e.g. 12 means +12%
  category: string | null;
  source: DataSource;
  sourceReference: string | null;
  confidence: ConfidenceStatus;
  lastVerifiedAt: number | null; // ms timestamp
  createdAt: number;
  updatedAt: number;
}

export interface KeywordRelationship {
  sourceKeywordId: string;
  relatedKeywordId: string;
  relatedKeyword: string;    // denormalized for fast reads
  relationshipType: RelationshipType;
  relevanceScore: number;    // 0-100
  source: DataSource;
  createdAt: number;
}

export interface DataGapRequest {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  country: string;
  missingFields: string[];
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: GapStatus;
  requestCount: number;
  createdAt: number;
  lastRequestedAt: number;
}

export interface ImportRecord {
  id: string;
  filename: string;
  importedBy: string;
  source: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newKeywords: number;
  updatedKeywords: number;
  duplicateRows: number;
  errors: string[];
  importedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalizeKeyword(kw: string): string {
  return kw.toLowerCase().replace(/\s+/g, " ").trim();
}

function kwKey(id: string) { return `kwdb:kw:${id}`; }
function lookupKey(norm: string, country: string) { return `kwdb:lookup:${norm}:${country.toUpperCase()}`; }
function relKey(id: string) { return `kwdb:rel:${id}`; }
function gapKey(id: string) { return `kwdb:gap:${id}`; }
function gapLookupKey(norm: string, country: string) { return `kwdb:gap:lookup:${norm}:${country.toUpperCase()}`; }
function importKey(id: string) { return `kwdb:import:${id}`; }

async function nextId(prefix: string): Promise<string> {
  const seq = await redis.incr(`kwdb:seq:${prefix}`);
  return `${prefix}_${seq}`;
}

// ── Keyword CRUD ──────────────────────────────────────────────────────────────

export async function getKeyword(id: string): Promise<KeywordRecord | null> {
  const raw = await redis.get(kwKey(id));
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as KeywordRecord;
}

export async function getKeywordByNorm(normalizedKeyword: string, country: string): Promise<KeywordRecord | null> {
  const id = await redis.get<string>(lookupKey(normalizedKeyword, country));
  if (!id) return null;
  return getKeyword(id);
}

// Upsert a keyword record respecting source priority.
// Returns { action: "created" | "updated" | "skipped" (lower priority data rejected) }
export async function upsertKeyword(
  data: Omit<KeywordRecord, "id" | "normalizedKeyword" | "createdAt" | "updatedAt"> & { normalizedKeyword?: string }
): Promise<{ action: "created" | "updated" | "skipped"; id: string }> {
  const norm = data.normalizedKeyword ?? normalizeKeyword(data.keyword);
  const country = data.country.toUpperCase();
  const now = Date.now();

  const existingId = await redis.get<string>(lookupKey(norm, country));

  if (existingId) {
    const existing = await getKeyword(existingId);
    if (existing) {
      const incomingPriority = SOURCE_PRIORITY[data.source] ?? 10;
      const existingPriority = SOURCE_PRIORITY[existing.source] ?? 10;

      const isPinterestUpdate = PINTEREST_SOURCES.has(data.source);
      const updateOpts = isPinterestUpdate ? { ex: PINTEREST_TTL_SECONDS } : undefined;

      if (incomingPriority > existingPriority) {
        // Incoming data has lower quality — only update null fields
        const merged: KeywordRecord = {
          ...existing,
          monthlySearches: existing.monthlySearches ?? data.monthlySearches,
          competition: existing.competition ?? data.competition,
          avgCpc: existing.avgCpc ?? data.avgCpc,
          trend: existing.trend ?? data.trend,
          category: existing.category ?? data.category,
          updatedAt: now,
        };
        await redis.set(kwKey(existingId), JSON.stringify(merged), updateOpts);
        return { action: "skipped", id: existingId };
      }

      // Incoming data is same or higher quality — update all provided non-null fields
      const updated: KeywordRecord = {
        ...existing,
        keyword: data.keyword,
        normalizedKeyword: norm,
        country,
        language: data.language || existing.language,
        monthlySearches: data.monthlySearches ?? existing.monthlySearches,
        competition: data.competition ?? existing.competition,
        avgCpc: data.avgCpc ?? existing.avgCpc,
        trend: data.trend ?? existing.trend,
        category: data.category ?? existing.category,
        source: data.source,
        sourceReference: data.sourceReference ?? existing.sourceReference,
        confidence: data.confidence,
        lastVerifiedAt: data.lastVerifiedAt ?? now,
        updatedAt: now,
      };
      await redis.set(kwKey(existingId), JSON.stringify(updated), updateOpts);
      return { action: "updated", id: existingId };
    }
  }

  // New keyword
  const id = await nextId("kw");
  const record: KeywordRecord = {
    id,
    keyword: data.keyword,
    normalizedKeyword: norm,
    country,
    language: data.language || "en",
    monthlySearches: data.monthlySearches ?? null,
    competition: data.competition ?? null,
    avgCpc: data.avgCpc ?? null,
    trend: data.trend ?? null,
    category: data.category ?? null,
    source: data.source,
    sourceReference: data.sourceReference ?? null,
    confidence: data.confidence,
    lastVerifiedAt: data.lastVerifiedAt ?? now,
    createdAt: now,
    updatedAt: now,
  };

  const isPinterestSource = PINTEREST_SOURCES.has(data.source);
  const setOpts = isPinterestSource ? { ex: PINTEREST_TTL_SECONDS } : undefined;

  await Promise.all([
    redis.set(kwKey(id), JSON.stringify(record), setOpts),
    redis.set(lookupKey(norm, country), id, setOpts),
    redis.zadd("kwdb:idx:all", { score: now, member: id }),
    redis.sadd(`kwdb:idx:country:${country}`, id),
    ...(data.category ? [redis.sadd(`kwdb:idx:cat:${data.category.toLowerCase().replace(/\s+/g, "_")}`, id)] : []),
  ]);

  return { action: "created", id };
}

// Search keyword knowledge store — returns matching records
export async function searchKeywords(opts: {
  query: string;
  country: string;
  limit?: number;
}): Promise<KeywordRecord[]> {
  const norm = normalizeKeyword(opts.query);
  const country = opts.country.toUpperCase();
  const limit = opts.limit ?? 50;

  // 1. Exact match
  const exact = await getKeywordByNorm(norm, country);
  const results: KeywordRecord[] = [];
  const seen = new Set<string>();

  if (exact) {
    results.push(exact);
    seen.add(exact.id);
  }

  // 2. Prefix scan via country index — find keywords that start with the query
  // Redis doesn't support full-text; we scan IDs in the country set and check prefix
  const countryIds = await redis.smembers(`kwdb:idx:country:${country}`);
  const batchSize = 100;
  const normWords = norm.split(" ");

  for (let i = 0; i < Math.min(countryIds.length, 500) && results.length < limit; i += batchSize) {
    const batch = countryIds.slice(i, i + batchSize);
    const records = await Promise.all(batch.map(id => getKeyword(id)));
    for (const rec of records) {
      if (!rec || seen.has(rec.id)) continue;
      const recNorm = rec.normalizedKeyword;
      const isMatch =
        recNorm.startsWith(norm) ||
        recNorm.includes(norm) ||
        normWords.every(w => recNorm.includes(w));
      if (isMatch) {
        results.push(rec);
        seen.add(rec.id);
        if (results.length >= limit) break;
      }
    }
  }

  // Sort: exact first, then by monthly_searches desc, then by source priority
  results.sort((a, b) => {
    if (a.normalizedKeyword === norm) return -1;
    if (b.normalizedKeyword === norm) return 1;
    const volDiff = (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0);
    if (volDiff !== 0) return volDiff;
    return (SOURCE_PRIORITY[a.source] ?? 10) - (SOURCE_PRIORITY[b.source] ?? 10);
  });

  return results.slice(0, limit);
}

// ── Keyword Relationships ─────────────────────────────────────────────────────

export async function addRelationship(rel: Omit<KeywordRelationship, "createdAt">): Promise<void> {
  const key = relKey(rel.sourceKeywordId);
  const record: KeywordRelationship = { ...rel, createdAt: Date.now() };
  await redis.hset(key, { [rel.relatedKeywordId]: JSON.stringify(record) });
}

export async function getRelationships(sourceKeywordId: string): Promise<KeywordRelationship[]> {
  const raw = await redis.hgetall(relKey(sourceKeywordId));
  if (!raw) return [];
  return Object.values(raw).map(v => (typeof v === "string" ? JSON.parse(v) : v) as KeywordRelationship)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ── Data Gap Management ────────────────────────────────────────────────────────

export async function recordDataGap(opts: {
  keyword: string;
  country: string;
  missingFields: string[];
}): Promise<DataGapRequest> {
  const norm = normalizeKeyword(opts.keyword);
  const country = opts.country.toUpperCase();
  const lookupK = gapLookupKey(norm, country);
  const now = Date.now();

  const existingId = await redis.get<string>(lookupK);
  if (existingId) {
    const existing = (await redis.get(gapKey(existingId))) as DataGapRequest | null;
    if (existing) {
      // Merge missing fields and increment counter
      const mergedFields = Array.from(new Set([...existing.missingFields, ...opts.missingFields]));
      const updated: DataGapRequest = {
        ...existing,
        missingFields: mergedFields,
        requestCount: existing.requestCount + 1,
        lastRequestedAt: now,
        priority: existing.requestCount >= 9 ? "HIGH" : existing.requestCount >= 4 ? "MEDIUM" : existing.priority,
      };
      await redis.set(gapKey(existingId), JSON.stringify(updated));
      return updated;
    }
  }

  const id = await nextId("gap");
  const gap: DataGapRequest = {
    id,
    keyword: opts.keyword,
    normalizedKeyword: norm,
    country,
    missingFields: opts.missingFields,
    priority: "LOW",
    status: "PENDING",
    requestCount: 1,
    createdAt: now,
    lastRequestedAt: now,
  };

  await Promise.all([
    redis.set(gapKey(id), JSON.stringify(gap)),
    redis.set(lookupK, id),
    redis.zadd("kwdb:gap:idx", { score: now, member: id }),
  ]);

  return gap;
}

export async function listDataGaps(opts: { limit?: number; offset?: number; status?: GapStatus }): Promise<DataGapRequest[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const ids = await redis.zrange("kwdb:gap:idx", offset, offset + limit - 1, { rev: true });
  const gaps = await Promise.all(ids.map(id => redis.get(gapKey(id as string))));
  const results = gaps
    .filter(Boolean)
    .map(r => (typeof r === "string" ? JSON.parse(r) : r) as DataGapRequest);

  return opts.status ? results.filter(g => g.status === opts.status) : results;
}

export async function updateGapStatus(id: string, status: GapStatus): Promise<void> {
  const raw = await redis.get(gapKey(id));
  if (!raw) return;
  const gap = (typeof raw === "string" ? JSON.parse(raw) : raw) as DataGapRequest;
  await redis.set(gapKey(id), JSON.stringify({ ...gap, status }));
}

// ── Import History ────────────────────────────────────────────────────────────

export async function recordImport(rec: Omit<ImportRecord, "id" | "importedAt">): Promise<ImportRecord> {
  const id = await nextId("imp");
  const record: ImportRecord = { ...rec, id, importedAt: Date.now() };
  await Promise.all([
    redis.set(importKey(id), JSON.stringify(record)),
    redis.zadd("kwdb:import:idx", { score: record.importedAt, member: id }),
  ]);
  return record;
}

export async function listImports(limit = 20): Promise<ImportRecord[]> {
  const ids = await redis.zrange("kwdb:import:idx", 0, limit - 1, { rev: true });
  const recs = await Promise.all(ids.map(id => redis.get(importKey(id as string))));
  return recs.filter(Boolean).map(r => (typeof r === "string" ? JSON.parse(r) : r) as ImportRecord);
}

// ── Search signal logging ─────────────────────────────────────────────────────

export async function logSearchSignal(keyword: string, country: string): Promise<void> {
  const norm = normalizeKeyword(keyword);
  const d = new Date();
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const member = `${norm}:::${country.toUpperCase()}`;
  await redis.zincrby(`kwdb:search:${day}`, 1, member);
  await redis.expire(`kwdb:search:${day}`, 60 * 60 * 24 * 30);
}

export interface TopSearchedEntry {
  keyword: string;
  country: string;
  searchCount: number;
  hasData: boolean; // whether keyword exists in knowledge store
}

// Aggregate search signals across the last N days and return top keywords
export async function getTopSearched(opts: { days?: number; limit?: number } = {}): Promise<TopSearchedEntry[]> {
  const days = opts.days ?? 30;
  const limit = opts.limit ?? 50;

  // Collect all day keys within range
  const scores = new Map<string, number>();
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const entries = await redis.zrange(`kwdb:search:${day}`, 0, -1, { withScores: true });
    // entries alternates [member, score, member, score, ...]
    for (let j = 0; j < entries.length - 1; j += 2) {
      const member = entries[j] as string;
      const score = Number(entries[j + 1]);
      scores.set(member, (scores.get(member) ?? 0) + score);
    }
  }

  // Sort by total count desc
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Check which have KB data
  const results: TopSearchedEntry[] = await Promise.all(
    sorted.map(async ([member, count]) => {
      const [norm, country] = member.split(":::");
      const existing = await getKeywordByNorm(norm, country ?? "US");
      return {
        keyword: norm,
        country: country ?? "US",
        searchCount: count,
        hasData: existing !== null && (
          existing.monthlySearches !== null ||
          existing.competition !== null ||
          existing.avgCpc !== null
        ),
      };
    })
  );

  return results;
}
