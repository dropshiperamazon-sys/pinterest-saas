import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Scans the DB for:
// 1. Duplicate lookup keys pointing to different IDs for same norm+country
// 2. Keywords that exist as both verified AND pending (AI suggestion)
// 3. Orphaned records (ID in idx:all but no kwdb:kw:{id} record)

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const results: {
    totalChecked: number;
    duplicateLookups: { norm: string; country: string; id1: string; id2?: string }[];
    verifiedAndPending: { keyword: string; country: string; id: string }[];
    orphanedIds: string[];
    summary: string;
  } = {
    totalChecked: 0,
    duplicateLookups: [],
    verifiedAndPending: [],
    orphanedIds: [],
    summary: "",
  };

  // Step 1: Scan all lookup keys
  let cursor = 0;
  const lookupMap = new Map<string, string>(); // "norm:::country" -> id
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "kwdb:lookup:*", count: 200 });
    cursor = Number(nextCursor);
    if (keys.length === 0) continue;

    // Pipeline GET all these lookup keys
    const p = redis.pipeline();
    for (const k of keys) p.get(k);
    const ids = await p.exec() as Array<string | null>;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i] as string;
      // key format: kwdb:lookup:{norm}:{COUNTRY}
      // Extract country (last segment) and norm (everything between kwdb:lookup: and :{country})
      const withoutPrefix = key.slice("kwdb:lookup:".length);
      const lastColon = withoutPrefix.lastIndexOf(":");
      if (lastColon === -1) continue;
      const norm = withoutPrefix.slice(0, lastColon);
      const country = withoutPrefix.slice(lastColon + 1);
      const mapKey = `${norm}:::${country}`;
      const id = ids[i];
      if (!id) continue;

      if (lookupMap.has(mapKey)) {
        // Duplicate lookup key pointing to different IDs — shouldn't be possible but check anyway
        const existingId = lookupMap.get(mapKey)!;
        if (existingId !== id) {
          results.duplicateLookups.push({ norm, country, id1: existingId, id2: id });
        }
      } else {
        lookupMap.set(mapKey, id);
      }
      results.totalChecked++;
    }
  } while (cursor !== 0);

  // Step 2: Get all IDs from pending index
  const pendingIds = new Set(await redis.zrange("kwdb:pending:idx", 0, -1) as string[]);

  // Step 3: For each lookup entry, fetch the record and check if it's both verified and pending
  const allIds = [...new Set(lookupMap.values())];

  // Batch fetch all records in groups of 100
  const CHUNK = 100;
  const recordMap = new Map<string, { keyword: string; country: string; pendingApproval?: boolean; confidence: string; source: string }>();
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const chunk = allIds.slice(i, i + CHUNK);
    const p = redis.pipeline();
    for (const id of chunk) p.get(`kwdb:kw:${id}`);
    const raws = await p.exec() as Array<string | null>;
    for (let j = 0; j < chunk.length; j++) {
      const raw = raws[j];
      if (!raw) {
        results.orphanedIds.push(chunk[j]);
        continue;
      }
      const rec = typeof raw === "string" ? JSON.parse(raw) : raw;
      recordMap.set(chunk[j], rec);
    }
  }

  // Check: keyword exists as both verified (confidence=VERIFIED) AND pending
  // This would mean a verified keyword somehow got flagged as pending too
  for (const [id, rec] of recordMap) {
    if (pendingIds.has(id) && rec.confidence === "VERIFIED") {
      results.verifiedAndPending.push({ keyword: rec.keyword, country: rec.country, id });
    }
  }

  // Step 4: Check for same normalized keyword+country appearing in multiple records
  // (would show up as duplicateLookups above if lookup key differs, but double-check via records)
  const normCountryToIds = new Map<string, string[]>();
  for (const [id, rec] of recordMap) {
    const key = `${rec.keyword?.toLowerCase().trim()}:::${rec.country}`;
    if (!normCountryToIds.has(key)) normCountryToIds.set(key, []);
    normCountryToIds.get(key)!.push(id);
  }
  for (const [key, ids] of normCountryToIds) {
    if (ids.length > 1) {
      const [norm, country] = key.split(":::");
      results.duplicateLookups.push({ norm, country, id1: ids[0], id2: ids[1] });
    }
  }

  const totalIssues = results.duplicateLookups.length + results.verifiedAndPending.length + results.orphanedIds.length;
  results.summary = totalIssues === 0
    ? `✅ No duplicates found. Checked ${results.totalChecked} keyword+country pairs.`
    : `⚠️ Found ${totalIssues} issue(s): ${results.duplicateLookups.length} duplicate lookups, ${results.verifiedAndPending.length} verified+pending conflicts, ${results.orphanedIds.length} orphaned records.`;

  return NextResponse.json(results);
}
