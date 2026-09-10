import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getKeyword, listImports } from "@/lib/keyword-db";

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
  const importId = searchParams.get("importId");
  const type = searchParams.get("type") ?? "new"; // "new" | "updated"

  if (!importId) {
    return NextResponse.json({ error: "importId required" }, { status: 400 });
  }

  // Find the import record
  const imports = await listImports(100);
  const record = imports.find(r => r.id === importId);
  if (!record) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const ids =
    type === "updated" ? (record.updatedKeywordIds ?? []) :
    type === "suggestions" ? (record.suggestionIds ?? []) :
    (record.newKeywordIds ?? []);
  const keywords = await Promise.all(ids.map(id => getKeyword(id)));
  const valid = keywords.filter(Boolean);

  return NextResponse.json({ keywords: valid, total: valid.length, type });
}
