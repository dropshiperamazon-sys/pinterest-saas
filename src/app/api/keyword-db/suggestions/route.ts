import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPendingSuggestions, approveSuggestions, reEstimateAiKeywords, getKeyword } from "@/lib/keyword-db";

async function requireAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated", status: 401 };
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) return { error: "Admin access required", status: 403 };
  return null;
}

// GET — list all pending AI suggestions
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5000"), 10000);

  const suggestions = await listPendingSuggestions(limit);
  return NextResponse.json({ suggestions, total: suggestions.length });
}

// POST — approve selected suggestions (push to dataset)
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const body = await req.json() as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const approved = await approveSuggestions(body.ids);

  // Immediately fill metric gaps from current DB averages for the pushed keywords.
  // Fetch the records to find which categories they belong to, then re-estimate.
  const records = await Promise.all(body.ids.map(id => getKeyword(id)));
  const categories = [...new Set(
    records.filter(Boolean).map(r => r!.category).filter(Boolean) as string[]
  )];
  if (categories.length > 0) {
    reEstimateAiKeywords(categories).catch(() => {});
  }

  return NextResponse.json({ approved, success: true });
}
