import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getKeywordById, updateKeyword, deleteKeyword,
  getPinAssociations, getPinSnapshots,
} from "@/lib/track-keywords-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kwId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kwId } = await params;
  const kw = await getKeywordById(email, kwId);
  if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

  const assocs = await getPinAssociations(email, kwId);
  const pinIds = assocs.map(a => a.pinId);
  const snapMap = await getPinSnapshots(email, pinIds);
  const pins = assocs.map(a => ({ ...a, snapshot: snapMap.get(a.pinId) ?? null }));

  return NextResponse.json({ keyword: kw, pins });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ kwId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kwId } = await params;
  const kw = await getKeywordById(email, kwId);
  if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

  const body = await req.json() as { isTracked?: boolean; trackingStatus?: string };
  const updated = await updateKeyword(email, kwId, {
    isTracked: body.isTracked ?? kw.isTracked,
    trackingStatus: (body.trackingStatus as "NOT_TRACKED" | "TRACKING" | "PAUSED") ?? kw.trackingStatus,
  });
  return NextResponse.json({ keyword: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ kwId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kwId } = await params;
  const kw = await getKeywordById(email, kwId);
  if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

  await deleteKeyword(email, kwId);
  return NextResponse.json({ success: true });
}
