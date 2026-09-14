import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchKeywords } from "@/lib/keyword-db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { title, description } = await req.json() as { title?: string; description?: string };
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Build search queries from title words (first 4 words) and full title
  const titleWords = title.trim().split(/\s+/);
  const queries = Array.from(new Set([
    title.slice(0, 60),                          // full title (truncated)
    titleWords.slice(0, 4).join(" "),            // first 4 words
    titleWords.slice(0, 3).join(" "),            // first 3 words
    titleWords.slice(0, 2).join(" "),            // first 2 words
  ])).filter(q => q.length >= 2);

  // Run searches in parallel
  const results = await Promise.all(
    queries.map(q => searchKeywords({ query: q, country: "US", limit: 20 }).catch(() => []))
  );

  // Merge, deduplicate by keyword string, sort by monthly searches descending
  const seen = new Set<string>();
  const merged: { keyword: string; monthlySearches: number | null }[] = [];
  for (const list of results) {
    for (const kw of list) {
      const norm = kw.keyword.toLowerCase().trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        merged.push({ keyword: kw.keyword, monthlySearches: kw.monthlySearches ?? null });
      }
    }
  }

  merged.sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0));

  const keywords = merged.slice(0, 10).map(k => k.keyword);

  return NextResponse.json({ keywords });
}
