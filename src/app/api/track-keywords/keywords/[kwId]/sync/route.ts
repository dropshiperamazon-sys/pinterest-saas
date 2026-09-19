/**
 * POST /api/track-keywords/keywords/[kwId]/sync
 *
 * On-demand sync for a tracked keyword:
 * 1. Fetch up to 100 of the user's most-recent pins (via boards)
 * 2. Match pins to the keyword using title+description text matching
 * 3. Fetch per-pin analytics for matched pins
 * 4. Store associations + pin snapshots in Redis
 * 5. Update keyword's lastSyncedAt
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";
import {
  getKeywordById, updateKeyword,
  setPinAssociations, setPinSnapshot,
} from "@/lib/track-keywords-db";
import { matchPinsToKeyword } from "@/lib/keyword-pin-matcher";
import type { PinSnapshot } from "@/lib/track-keywords-db";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[sync] GET ${path} → ${res.status}`);
    return null;
  }
  return res.json();
}

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ kwId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kwId } = await params;
  const kw = await getKeywordById(email, kwId);
  if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

  // Load Pinterest token
  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  // Mark as syncing
  await updateKeyword(email, kwId, { trackingStatus: "SYNCING" });

  try {
    // 1. Fetch user boards
    const boardsData = await pGet("/boards?page_size=50", accessToken);
    const boards: { id: string; name: string }[] = boardsData?.items ?? [];

    // 2. For each board, fetch up to 25 pins (limit to 4 boards to stay within rate limits)
    const boardsToCheck = boards.slice(0, 4);
    const pinTexts: { pinId: string; title: string; description: string; boardId: string; boardName: string; link: string }[] = [];

    for (const board of boardsToCheck) {
      const pinsData = await pGet(`/boards/${board.id}/pins?page_size=25`, accessToken);
      const items: Record<string, unknown>[] = pinsData?.items ?? [];
      for (const pin of items) {
        const media = (pin.media as Record<string, unknown>) ?? {};
        const images = (media.images as Record<string, { url?: string }>) ?? {};
        const imageUrl =
          images["1200x"]?.url ?? images["736x"]?.url ?? images["600x"]?.url ??
          images["400x300"]?.url ?? images["150x150"]?.url ?? "";
        pinTexts.push({
          pinId: String(pin.id ?? ""),
          title: String(pin.title ?? ""),
          description: String(pin.description ?? ""),
          boardId: board.id,
          boardName: board.name,
          link: String(pin.link ?? ""),
        });
      }
    }

    // Also include top pins from analytics (covers high-performing pins that might not be in recent board fetches)
    const topPinsData = await pGet(
      `/user_account/top_pins_analytics?start_date=${dateStr(30)}&end_date=${dateStr(1)}&sort_by=IMPRESSION&num_of_pins=25&from_claimed_content=BOTH&pin_format=ALL&app_types=ALL`,
      accessToken
    );
    if (Array.isArray(topPinsData?.pins)) {
      for (const tp of topPinsData.pins as Record<string, unknown>[]) {
        const pinId = String(tp.pin_id ?? "");
        if (pinId && !pinTexts.some(p => p.pinId === pinId)) {
          // Fetch pin details for title/description
          const pinDetail = await pGet(`/pins/${pinId}`, accessToken);
          if (pinDetail) {
            const media = (pinDetail.media as Record<string, unknown>) ?? {};
            const images = (media.images as Record<string, { url?: string }>) ?? {};
            pinTexts.push({
              pinId,
              title: String(pinDetail.title ?? ""),
              description: String(pinDetail.description ?? ""),
              boardId: String(pinDetail.board_id ?? ""),
              boardName: "",
              link: String(pinDetail.link ?? ""),
            });
          }
        }
      }
    }

    // 3. Match pins to keyword
    const associations = matchPinsToKeyword(kw.keyword, pinTexts);

    // 4. Fetch analytics for matched pins
    const startDate = dateStr(30);
    const endDate = dateStr(1);

    for (const assoc of associations) {
      const pinMeta = pinTexts.find(p => p.pinId === assoc.pinId);
      if (!pinMeta) continue;

      // Fetch per-pin analytics
      const analyticsData = await pGet(
        `/pins/${assoc.pinId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,ENGAGEMENT,SAVE,PIN_CLICK,OUTBOUND_CLICK`,
        accessToken
      );

      // Also get pin image
      const pinDetail = await pGet(`/pins/${assoc.pinId}`, accessToken);
      const media = (pinDetail?.media as Record<string, unknown>) ?? {};
      const images = (media.images as Record<string, { url?: string }>) ?? {};
      const imageUrl =
        images["1200x"]?.url ?? images["736x"]?.url ?? images["600x"]?.url ??
        images["400x300"]?.url ?? images["150x150"]?.url ?? "";

      // Extract metrics
      const allMetrics = analyticsData?.all?.summary_metrics ?? {};
      const impressions = Number(allMetrics.IMPRESSION) || 0;
      const engagements = Number(allMetrics.ENGAGEMENT) || 0;
      const saves = Number(allMetrics.SAVE) || 0;
      const pinClicks = Number(allMetrics.PIN_CLICK) || 0;
      const outboundClicks = Number(allMetrics.OUTBOUND_CLICK) || 0;
      const engagementRate = impressions > 0 ? Math.round((engagements / impressions) * 10000) / 100 : 0;

      // Find board name for this pin
      const boardName = pinMeta.boardName || (pinDetail?.board_section_id ? "" : "");

      const snap: PinSnapshot = {
        pinId: assoc.pinId,
        title: pinMeta.title || (pinDetail?.title as string) || "",
        description: pinMeta.description || (pinDetail?.description as string) || "",
        link: pinMeta.link || (pinDetail?.link as string) || "",
        imageUrl,
        boardId: pinMeta.boardId || String(pinDetail?.board_id ?? ""),
        boardName,
        impressions,
        engagements,
        saves,
        pinClicks,
        outboundClicks,
        engagementRate,
        syncedAt: Date.now(),
      };
      await setPinSnapshot(email, snap);
    }

    // 5. Store associations + update keyword
    await setPinAssociations(email, kwId, associations);
    await updateKeyword(email, kwId, {
      isTracked: true,
      trackingStatus: "TRACKING",
      lastSyncedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      pinsScanned: pinTexts.length,
      pinsMatched: associations.length,
    });
  } catch (err) {
    console.error("[sync] error:", err);
    await updateKeyword(email, kwId, { trackingStatus: "ERROR" });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
