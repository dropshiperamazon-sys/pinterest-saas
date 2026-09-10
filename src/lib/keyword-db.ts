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
  subcategory: string | null;
  source: DataSource;
  sourceReference: string | null;
  confidence: ConfidenceStatus;
  lastVerifiedAt: number | null; // ms timestamp
  createdAt: number;
  updatedAt: number;
  // AI-generated suggestions sit here until the admin explicitly pushes them.
  // pendingApproval: true → invisible in search, visible in Data Requests.
  pendingApproval?: boolean;
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
  newKeywordIds?: string[];    // IDs of newly created keywords
  updatedKeywordIds?: string[]; // IDs of updated keywords
  suggestionIds?: string[];    // IDs of AI-inferred suggestion keywords
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
const PENDING_IDX = "kwdb:pending:idx"; // sorted set: score=createdAt, member=id

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
  data: Omit<KeywordRecord, "id" | "normalizedKeyword" | "createdAt" | "updatedAt"> & { normalizedKeyword?: string; subcategory?: string | null; pendingApproval?: boolean }
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
      const shouldBePending = data.pendingApproval === true && !existing.pendingApproval;
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
        subcategory: data.subcategory ?? existing.subcategory,
        source: data.source,
        sourceReference: data.sourceReference ?? existing.sourceReference,
        confidence: data.confidence,
        lastVerifiedAt: data.lastVerifiedAt ?? now,
        updatedAt: now,
        // If incoming wants pending and existing isn't already, mark it pending
        ...(shouldBePending ? { pendingApproval: true } : {}),
      };
      const ops: Promise<unknown>[] = [redis.set(kwKey(existingId), JSON.stringify(updated), updateOpts)];
      if (shouldBePending) ops.push(redis.zadd(PENDING_IDX, { score: existing.createdAt, member: existingId }));
      await Promise.all(ops);
      return { action: "updated", id: existingId };
    }
  }

  // New keyword
  const id = await nextId("kw");
  const isPending = data.pendingApproval === true;
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
    subcategory: data.subcategory ?? null,
    source: data.source,
    sourceReference: data.sourceReference ?? null,
    confidence: data.confidence,
    lastVerifiedAt: data.lastVerifiedAt ?? now,
    createdAt: now,
    updatedAt: now,
    ...(isPending ? { pendingApproval: true } : {}),
  };

  const isPinterestSource = PINTEREST_SOURCES.has(data.source);
  const setOpts = isPinterestSource ? { ex: PINTEREST_TTL_SECONDS } : undefined;

  await Promise.all([
    redis.set(kwKey(id), JSON.stringify(record), setOpts),
    redis.set(lookupKey(norm, country), id, setOpts),
    redis.zadd("kwdb:idx:all", { score: now, member: id }),
    redis.sadd(`kwdb:idx:country:${country}`, id),
    ...(data.category ? [redis.sadd(`kwdb:idx:cat:${data.category.toLowerCase().replace(/\s+/g, "_")}`, id)] : []),
    // Pending suggestions go into their own index for fast listing
    ...(isPending ? [redis.zadd(PENDING_IDX, { score: now, member: id })] : []),
  ]);

  return { action: "created", id };
}

// ── Pending suggestion management ─────────────────────────────────────────────

export async function listPendingSuggestions(limit = 200): Promise<KeywordRecord[]> {
  const ids = await redis.zrange(PENDING_IDX, 0, limit - 1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const records = await Promise.all((ids as string[]).map(id => getKeyword(id)));
  // Filter out any that were approved or deleted since indexing
  return records.filter((r): r is KeywordRecord => r != null && r.pendingApproval === true);
}

// Repair: scan all AI_INFERRED keywords and add any without pendingApproval to the pending index.
// Handles keywords created before the pendingApproval system was introduced.
export async function repairPendingSuggestions(): Promise<{ repaired: number; total: number }> {
  const allIds = await redis.zrange("kwdb:idx:all", 0, -1);
  if (!allIds || allIds.length === 0) return { repaired: 0, total: 0 };

  let repaired = 0;
  let total = 0;
  const batchSize = 50;
  for (let i = 0; i < (allIds as string[]).length; i += batchSize) {
    const batch = (allIds as string[]).slice(i, i + batchSize);
    const records = await Promise.all(batch.map(id => getKeyword(id)));
    for (const r of records) {
      if (!r || r.source !== "AI_INFERRED") continue;
      total++;
      if (!r.pendingApproval) {
        const updated: KeywordRecord = { ...r, pendingApproval: true, updatedAt: Date.now() };
        await Promise.all([
          redis.set(kwKey(r.id), JSON.stringify(updated)),
          redis.zadd(PENDING_IDX, { score: r.createdAt, member: r.id }),
        ]);
        repaired++;
      }
    }
  }
  return { repaired, total };
}

export async function approveSuggestions(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  let approved = 0;
  await Promise.all(ids.map(async (id) => {
    const kw = await getKeyword(id);
    if (!kw || !kw.pendingApproval) return;
    const updated: KeywordRecord = { ...kw, pendingApproval: false, updatedAt: Date.now() };
    await Promise.all([
      redis.set(kwKey(id), JSON.stringify(updated)),
      redis.zrem(PENDING_IDX, id),
    ]);
    approved++;
  }));
  return approved;
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

  if (exact && !exact.pendingApproval) {
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
      if (!rec || seen.has(rec.id) || rec.pendingApproval) continue;
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

// ── Category metric lookup ────────────────────────────────────────────────────
// Fetches real (non-AI-inferred) keywords for a category so the expander can
// build metric estimates from the full historical dataset, not just the current upload.

export async function getVerifiedKeywordsByCategory(
  category: string,
  limit = 200,
): Promise<Pick<KeywordRecord, "category" | "subcategory" | "monthlySearches" | "avgCpc">[]> {
  const catKey = category.toLowerCase().replace(/\s+/g, "_");
  const ids = await redis.smembers(`kwdb:idx:cat:${catKey}`);
  if (!ids || ids.length === 0) return [];

  const records = await Promise.all(
    (ids as string[]).slice(0, limit).map(id => getKeyword(id))
  );

  return records
    .filter((r): r is KeywordRecord =>
      r != null &&
      r.source !== "AI_INFERRED" &&
      r.source !== "USER_SEARCH_SIGNAL" &&
      (r.monthlySearches != null || r.avgCpc != null)
    )
    .map(r => ({
      category: r.category,
      subcategory: r.subcategory,
      monthlySearches: r.monthlySearches,
      avgCpc: r.avgCpc,
    }));
}

// ── AI metric re-estimation ───────────────────────────────────────────────────
// After any real data upload (or on push), re-compute estimated metrics for all
// AI_INFERRED keywords in the affected categories using the latest real-data averages.
// This keeps AI keyword estimates up-to-date as the dataset grows.

const VARIANT_DISCOUNT = 0.7;

function avgNums(nums: number[]): number | null {
  const valid = nums.filter(n => !isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function mostCommon(vals: string[]): string | null {
  if (vals.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

interface MetricBucket {
  searches: number[];
  cpcs: number[];
  competitions: string[];
}

function buildBuckets(pool: Pick<KeywordRecord, "category" | "subcategory" | "monthlySearches" | "avgCpc" | "competition">[]) {
  const bySubcat = new Map<string, MetricBucket>();
  const byCat = new Map<string, MetricBucket>();
  for (const kw of pool) {
    const cat = (kw.category ?? "").toLowerCase().trim();
    const sub = (kw.subcategory ?? "").toLowerCase().trim();
    const addTo = (m: Map<string, MetricBucket>, key: string) => {
      if (!key) return;
      if (!m.has(key)) m.set(key, { searches: [], cpcs: [], competitions: [] });
      const b = m.get(key)!;
      if (kw.monthlySearches != null) b.searches.push(kw.monthlySearches);
      if (kw.avgCpc != null) b.cpcs.push(kw.avgCpc);
      if (kw.competition) b.competitions.push(kw.competition);
    };
    addTo(byCat, cat);
    addTo(bySubcat, sub);
  }
  return { bySubcat, byCat };
}

function estimateFromBuckets(
  subcategory: string | null,
  category: string | null,
  bySubcat: Map<string, MetricBucket>,
  byCat: Map<string, MetricBucket>,
): { monthlySearches: number | null; avgCpc: number | null; competition: "low" | "medium" | "high" | null } {
  const sub = subcategory?.toLowerCase().trim() ?? "";
  const cat = (category ?? "").toLowerCase().trim();
  const bucket = (sub && bySubcat.get(sub)) || byCat.get(cat) || null;
  if (!bucket) return { monthlySearches: null, avgCpc: null, competition: null };
  const searches = avgNums(bucket.searches);
  const cpc = avgNums(bucket.cpcs);
  const competition = mostCommon(bucket.competitions) as "low" | "medium" | "high" | null;
  return {
    monthlySearches: searches != null ? Math.round(searches * VARIANT_DISCOUNT) : null,
    avgCpc: cpc != null ? Math.round(cpc * VARIANT_DISCOUNT * 100) / 100 : null,
    competition,
  };
}

// Re-estimate metrics for all AI_INFERRED keywords in the given categories.
// Pass categories=[] to re-estimate ALL AI keywords across the entire DB.
export async function reEstimateAiKeywords(categories: string[]): Promise<number> {
  // Build the pool of real data for the requested categories
  const catKeys = categories.length > 0
    ? [...new Set(categories.map(c => c.toLowerCase().replace(/\s+/g, "_")))]
    : null; // null = all

  // Gather AI_INFERRED keyword IDs to update
  let aiIds: string[] = [];
  if (catKeys) {
    const idSets = await Promise.all(catKeys.map(k => redis.smembers(`kwdb:idx:cat:${k}`)));
    aiIds = [...new Set(idSets.flat() as string[])];
  } else {
    aiIds = (await redis.zrange("kwdb:idx:all", 0, -1)) as string[];
  }
  if (aiIds.length === 0) return 0;

  // Fetch all AI_INFERRED records
  const allRecords = await Promise.all(aiIds.map(id => getKeyword(id)));
  const aiRecords = allRecords.filter((r): r is KeywordRecord => r != null && r.source === "AI_INFERRED");
  if (aiRecords.length === 0) return 0;

  // Unique categories present in those records
  const affectedCats = [...new Set(aiRecords.map(r => r.category).filter(Boolean) as string[])];

  // Fetch real verified data pool for all affected categories
  const poolRecords = (
    await Promise.all(affectedCats.map(cat => getVerifiedKeywordsByCategory(cat, 500)))
  ).flat() as (Pick<KeywordRecord, "category" | "subcategory" | "monthlySearches" | "avgCpc"> & { competition?: "low" | "medium" | "high" | null })[];

  if (poolRecords.length === 0) return 0; // no real data yet — nothing to estimate from

  const { bySubcat, byCat } = buildBuckets(poolRecords as any);

  let updated = 0;
  const now = Date.now();

  await Promise.allSettled(
    aiRecords.map(async (r) => {
      const est = estimateFromBuckets(r.subcategory, r.category, bySubcat, byCat);
      // Only update if we actually have new estimates to fill in
      const changed =
        (est.monthlySearches != null && est.monthlySearches !== r.monthlySearches) ||
        (est.avgCpc != null && est.avgCpc !== r.avgCpc) ||
        (est.competition != null && est.competition !== r.competition);
      if (!changed) return;

      const updatedRecord: KeywordRecord = {
        ...r,
        monthlySearches: est.monthlySearches ?? r.monthlySearches,
        avgCpc: est.avgCpc ?? r.avgCpc,
        competition: est.competition ?? r.competition,
        confidence: "ESTIMATED",
        updatedAt: now,
      };
      await redis.set(kwKey(r.id), JSON.stringify(updatedRecord));
      updated++;
    })
  );

  return updated;
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
