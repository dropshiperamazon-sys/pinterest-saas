import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { repairPendingSuggestions } from "@/lib/keyword-db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const result = await repairPendingSuggestions();
  return NextResponse.json({ ...result, success: true });
}
