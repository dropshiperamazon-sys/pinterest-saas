import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFolder, saveKeyword } from "@/lib/track-keywords-db";
import { guardFeature } from "@/lib/plan-limits";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const featureGuard = await guardFeature(email, "canTrackKeywords");
  if (!featureGuard.allowed) {
    return NextResponse.json({ error: featureGuard.error, upgradeRequired: featureGuard.upgradeRequired }, { status: 403 });
  }

  const body = await req.json() as {
    folderId: string;
    keyword: string;
    country?: string;
    monthlySearches?: number | null;
    competition?: "low" | "medium" | "high" | null;
    avgCpc?: number | null;
    trend?: number | null;
    isTracked?: boolean;
  };

  const { folderId, keyword, isTracked } = body;
  if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword required" }, { status: 400 });

  const folder = await getFolder(email, folderId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const kw = await saveKeyword(email, folderId, keyword, {
    country: body.country,
    monthlySearches: body.monthlySearches,
    competition: body.competition,
    avgCpc: body.avgCpc,
    trend: body.trend,
  }, isTracked ?? false);

  return NextResponse.json({ keyword: kw }, { status: 201 });
}
