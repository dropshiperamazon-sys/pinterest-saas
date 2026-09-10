// Data Gap management — admin endpoint
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDataGaps, updateGapStatus, listImports, type GapStatus } from "@/lib/keyword-db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "gaps";
  const status = searchParams.get("status") as GapStatus | null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  if (type === "imports") {
    const imports = await listImports(limit);
    return NextResponse.json({ imports });
  }

  const gaps = await listDataGaps({ limit, offset, status: status ?? undefined });
  return NextResponse.json({ gaps, count: gaps.length });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json() as { id: string; status: GapStatus };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  await updateGapStatus(body.id, body.status);
  return NextResponse.json({ ok: true });
}
