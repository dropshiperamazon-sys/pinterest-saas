import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPendingSuggestionsPaged, approveSuggestions, reEstimateAiKeywords, getKeyword, deleteSuggestions } from "@/lib/keyword-db";

async function requireAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated", status: 401 };
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) return { error: "Admin access required", status: 403 };
  return null;
}

// GET — list pending AI suggestions (paginated)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const country = searchParams.get("country") ?? undefined;

  const { suggestions, total } = await listPendingSuggestionsPaged({ page, limit, country });
  return NextResponse.json({ suggestions, total, page, limit });
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

// DELETE — permanently remove selected pending AI suggestions
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const body = await req.json() as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const deleted = await deleteSuggestions(body.ids);
  return NextResponse.json({ deleted, success: true });
}
