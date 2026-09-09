import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";
import { scorePinSEO, gradeFromScore, type AccountSEOSummary, type BoardSEOSummary } from "@/lib/seo-audit-engine";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL = 60 * 30; // 30 minutes

async function getAccessToken(email: string): Promise<string> {
  const raw = await redis.get<string>(`pinterest_connection:${email}`);
  const conn = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken?: string } : null;
  return conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cacheKey = `seo-audit-account:${email}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(typeof cached === "string" ? JSON.parse(cached) : cached);
  }

  const accessToken = await getAccessToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Fetch boards
  const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=50", { headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boardsData: any = boardsRes.ok ? await boardsRes.json() : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boards: any[] = boardsData.items ?? [];

  // Profile
  const profileRes = await fetch("https://api.pinterest.com/v5/user_account", { headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile: any = profileRes.ok ? await profileRes.json() : {};

  const boardSummaries: BoardSEOSummary[] = [];
  let totalScore = 0;
  let pinsAnalyzed = 0;
  const criticalIssues = new Set<string>();
  const warnings = new Set<string>();
  const opportunities = new Set<string>();

  for (const board of boards.slice(0, 20)) {
    try {
      const pinsRes = await fetch(
        `https://api.pinterest.com/v5/boards/${board.id}/pins?page_size=25`,
        { headers }
      );
      if (!pinsRes.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pinsData: any = await pinsRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pins: any[] = pinsData.items ?? [];

      let boardScoreSum = 0;
      let boardIssues = 0;

      for (const pin of pins) {
        const score = scorePinSEO({
          id: pin.id ?? "",
          title: pin.title ?? "",
          description: pin.description ?? "",
          altText: pin.alt_text ?? "",
          link: pin.link ?? "",
          boardName: board.name ?? "",
          boardDescription: board.description ?? "",
          focusKeyword: "",
        });

        boardScoreSum += score.overall;
        pinsAnalyzed++;

        const fails = score.checks.filter((c) => c.status === "fail");
        const warns = score.checks.filter((c) => c.status === "warn");
        boardIssues += fails.length;

        for (const f of fails) {
          if (f.impact === "high") criticalIssues.add(f.message);
        }
        for (const w of warns) {
          if (w.impact === "high") warnings.add(w.message);
          else opportunities.add(w.message);
        }
      }

      const avgScore = pins.length > 0 ? Math.round(boardScoreSum / pins.length) : 50;
      totalScore += avgScore;

      const slug = (board.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const username = profile.username ?? "";

      boardSummaries.push({
        id: board.id,
        name: board.name ?? "",
        description: board.description ?? "",
        pinCount: board.pin_count ?? pins.length,
        url: username && slug ? `https://pinterest.com/${username}/${slug}/` : "",
        avgScore,
        grade: gradeFromScore(avgScore),
        issueCount: boardIssues,
      });
    } catch { /* skip */ }
  }

  const overallScore = boardSummaries.length > 0 ? Math.round(totalScore / boardSummaries.length) : 0;

  const result: AccountSEOSummary & { profile: Record<string, unknown> } = {
    overallScore,
    grade: gradeFromScore(overallScore),
    pinsAnalyzed,
    criticalIssues: Array.from(criticalIssues).slice(0, 5),
    warnings: Array.from(warnings).slice(0, 5),
    opportunities: Array.from(opportunities).slice(0, 5),
    boardSummaries,
    profile: {
      username: profile.username ?? "",
      displayName: profile.business_name ?? profile.username ?? "",
      followerCount: profile.follower_count ?? 0,
      pinCount: profile.pin_count ?? 0,
      boardCount: profile.board_count ?? 0,
      profileImage: profile.profile_image ?? "",
    },
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  return NextResponse.json(result);
}
