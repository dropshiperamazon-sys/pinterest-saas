/**
 * Track Keywords — Redis data layer
 *
 * Key schema:
 *   tkw:folders:{email}               sorted set  score=createdAt  member=folderId
 *   tkw:folder:{email}:{folderId}     JSON  KeywordFolder
 *   tkw:kws:{email}:{folderId}        sorted set  score=createdAt  member=kwId
 *   tkw:kw:{email}:{kwId}             JSON  SavedKeyword
 *   tkw:kwpins:{email}:{kwId}         JSON  PinAssociation[]
 *   tkw:pinsnap:{email}:{pinId}       JSON  PinSnapshot
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackingStatus = "NOT_TRACKED" | "TRACKING" | "SYNCING" | "ERROR" | "PAUSED";

export interface KeywordFolder {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedKeyword {
  id: string;
  folderId: string;
  keyword: string;
  country: string;
  monthlySearches: number | null;
  competition: "low" | "medium" | "high" | null;
  avgCpc: number | null;
  trend: number | null;
  isTracked: boolean;
  trackingStatus: TrackingStatus;
  createdAt: number;
  updatedAt: number;
  lastSyncedAt: number | null;
}

export type MatchType = "EXACT" | "PHRASE" | "RELATED";

export interface PinAssociation {
  pinId: string;
  matchType: MatchType;
  matchScore: number; // 0-100
  createdAt: number;
}

export interface PinSnapshot {
  pinId: string;
  title: string;
  description: string;
  link: string;
  imageUrl: string;
  boardId: string;
  boardName: string;
  impressions: number;
  engagements: number;
  saves: number;
  pinClicks: number;
  outboundClicks: number;
  engagementRate: number;
  syncedAt: number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function listFolders(email: string): Promise<KeywordFolder[]> {
  const ids = await redis.zrange(`tkw:folders:${email}`, 0, -1, { rev: true });
  if (!ids.length) return [];
  const pipe = redis.pipeline();
  for (const id of ids) pipe.get(`tkw:folder:${email}:${id}`);
  const results = await pipe.exec();
  return (results as (KeywordFolder | null)[]).filter(Boolean) as KeywordFolder[];
}

export async function getFolder(email: string, folderId: string): Promise<KeywordFolder | null> {
  const raw = await redis.get(`tkw:folder:${email}:${folderId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw as KeywordFolder;
}

export async function createFolder(email: string, name: string, description = ""): Promise<KeywordFolder> {
  const id = genId("f");
  const now = Date.now();
  const folder: KeywordFolder = { id, name: name.trim(), description, createdAt: now, updatedAt: now };
  await redis.pipeline()
    .set(`tkw:folder:${email}:${id}`, JSON.stringify(folder))
    .zadd(`tkw:folders:${email}`, { score: now, member: id })
    .exec();
  return folder;
}

export async function updateFolder(email: string, folderId: string, patch: Partial<Pick<KeywordFolder, "name" | "description">>): Promise<KeywordFolder | null> {
  const folder = await getFolder(email, folderId);
  if (!folder) return null;
  const updated = { ...folder, ...patch, updatedAt: Date.now() };
  await redis.set(`tkw:folder:${email}:${folderId}`, JSON.stringify(updated));
  return updated;
}

export async function deleteFolder(email: string, folderId: string): Promise<void> {
  // Remove all keywords in folder
  const kwIds = await redis.zrange(`tkw:kws:${email}:${folderId}`, 0, -1);
  const pipe = redis.pipeline();
  for (const kwId of kwIds as string[]) {
    pipe.del(`tkw:kw:${email}:${kwId}`);
    pipe.del(`tkw:kwpins:${email}:${kwId}`);
  }
  pipe.del(`tkw:kws:${email}:${folderId}`);
  pipe.del(`tkw:folder:${email}:${folderId}`);
  pipe.zrem(`tkw:folders:${email}`, folderId);
  await pipe.exec();
}

// ─── Saved Keywords ───────────────────────────────────────────────────────────

export async function listKeywordsInFolder(email: string, folderId: string): Promise<SavedKeyword[]> {
  const ids = await redis.zrange(`tkw:kws:${email}:${folderId}`, 0, -1, { rev: true });
  if (!ids.length) return [];
  const pipe = redis.pipeline();
  for (const id of ids) pipe.get(`tkw:kw:${email}:${id}`);
  const results = await pipe.exec();
  return (results as (SavedKeyword | null)[])
    .map(r => (r && typeof r === "string" ? JSON.parse(r) : r))
    .filter(Boolean) as SavedKeyword[];
}

export async function getKeywordById(email: string, kwId: string): Promise<SavedKeyword | null> {
  const raw = await redis.get(`tkw:kw:${email}:${kwId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw as SavedKeyword;
}

export async function saveKeyword(
  email: string,
  folderId: string,
  keyword: string,
  meta: {
    country?: string;
    monthlySearches?: number | null;
    competition?: "low" | "medium" | "high" | null;
    avgCpc?: number | null;
    trend?: number | null;
  },
  isTracked = false
): Promise<SavedKeyword> {
  // Check if keyword already exists in this folder
  const existing = await findKeywordInFolder(email, folderId, keyword);
  if (existing) {
    // Update tracking status if requested
    if (isTracked && !existing.isTracked) {
      return updateKeyword(email, existing.id, { isTracked: true, trackingStatus: "TRACKING" }) as Promise<SavedKeyword>;
    }
    return existing;
  }

  const id = genId("kw");
  const now = Date.now();
  const kw: SavedKeyword = {
    id,
    folderId,
    keyword: keyword.trim(),
    country: meta.country ?? "US",
    monthlySearches: meta.monthlySearches ?? null,
    competition: meta.competition ?? null,
    avgCpc: meta.avgCpc ?? null,
    trend: meta.trend ?? null,
    isTracked,
    trackingStatus: isTracked ? "TRACKING" : "NOT_TRACKED",
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: null,
  };
  await redis.pipeline()
    .set(`tkw:kw:${email}:${id}`, JSON.stringify(kw))
    .zadd(`tkw:kws:${email}:${folderId}`, { score: now, member: id })
    .exec();
  return kw;
}

export async function findKeywordInFolder(email: string, folderId: string, keyword: string): Promise<SavedKeyword | null> {
  const kws = await listKeywordsInFolder(email, folderId);
  const norm = keyword.trim().toLowerCase();
  return kws.find(k => k.keyword.toLowerCase() === norm) ?? null;
}

export async function updateKeyword(email: string, kwId: string, patch: Partial<SavedKeyword>): Promise<SavedKeyword | null> {
  const kw = await getKeywordById(email, kwId);
  if (!kw) return null;
  const updated = { ...kw, ...patch, updatedAt: Date.now() };
  await redis.set(`tkw:kw:${email}:${kwId}`, JSON.stringify(updated));
  return updated;
}

export async function deleteKeyword(email: string, kwId: string): Promise<void> {
  const kw = await getKeywordById(email, kwId);
  if (!kw) return;
  await redis.pipeline()
    .del(`tkw:kw:${email}:${kwId}`)
    .del(`tkw:kwpins:${email}:${kwId}`)
    .zrem(`tkw:kws:${email}:${kw.folderId}`, kwId)
    .exec();
}

// ─── Folder stats (keyword + tracked counts) ─────────────────────────────────

export async function getFolderStats(email: string, folderId: string): Promise<{ total: number; tracked: number; pinCount: number }> {
  const kws = await listKeywordsInFolder(email, folderId);
  const tracked = kws.filter(k => k.isTracked);
  let pinCount = 0;
  if (tracked.length > 0) {
    const pipe = redis.pipeline();
    for (const k of tracked) pipe.get(`tkw:kwpins:${email}:${k.id}`);
    const results = await pipe.exec();
    for (const r of results as (string | PinAssociation[] | null)[]) {
      if (!r) continue;
      const arr: PinAssociation[] = typeof r === "string" ? JSON.parse(r) : r;
      pinCount += arr.length;
    }
  }
  return { total: kws.length, tracked: tracked.length, pinCount };
}

// ─── Pin associations ─────────────────────────────────────────────────────────

export async function getPinAssociations(email: string, kwId: string): Promise<PinAssociation[]> {
  const raw = await redis.get(`tkw:kwpins:${email}:${kwId}`);
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw as PinAssociation[];
}

export async function setPinAssociations(email: string, kwId: string, assocs: PinAssociation[]): Promise<void> {
  await redis.set(`tkw:kwpins:${email}:${kwId}`, JSON.stringify(assocs));
}

// ─── Pin snapshots ────────────────────────────────────────────────────────────

export async function getPinSnapshot(email: string, pinId: string): Promise<PinSnapshot | null> {
  const raw = await redis.get(`tkw:pinsnap:${email}:${pinId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw as PinSnapshot;
}

export async function setPinSnapshot(email: string, snap: PinSnapshot): Promise<void> {
  // 24-hour TTL — analytics data refreshes daily
  await redis.set(`tkw:pinsnap:${email}:${snap.pinId}`, JSON.stringify(snap), { ex: 86400 });
}

export async function getPinSnapshots(email: string, pinIds: string[]): Promise<Map<string, PinSnapshot>> {
  if (!pinIds.length) return new Map();
  const pipe = redis.pipeline();
  for (const id of pinIds) pipe.get(`tkw:pinsnap:${email}:${id}`);
  const results = await pipe.exec();
  const map = new Map<string, PinSnapshot>();
  results.forEach((r, i) => {
    if (!r) return;
    const snap: PinSnapshot = typeof r === "string" ? JSON.parse(r) : r as PinSnapshot;
    map.set(pinIds[i], snap);
  });
  return map;
}
