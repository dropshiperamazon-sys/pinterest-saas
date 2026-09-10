import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTopSearched } from "@/lib/keyword-db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 30);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const results = await getTopSearched({ days, limit });
  return NextResponse.json({ results, days });
}
