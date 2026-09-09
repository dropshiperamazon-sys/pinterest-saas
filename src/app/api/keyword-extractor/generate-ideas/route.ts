import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateContentIdeas } from "@/lib/keyword-extractor/content-idea-generator";
import { fetchPageMetaBatch } from "@/lib/keyword-extractor/page-crawler";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as {
    keywords: string[];
    urls?: string[];
    category: string;
  };

  const { keywords, urls = [], category } = body;

  if (!keywords?.length || !category) {
    return NextResponse.json({ error: "keywords and category are required" }, { status: 400 });
  }

  // Optionally fetch page meta for richer context (first 5 URLs only, best-effort)
  let pageMeta: { title: string; h1: string; metaDescription: string }[] = [];
  if (urls.length > 0) {
    try {
      const meta = await fetchPageMetaBatch(urls.slice(0, 5), 3);
      pageMeta = meta.filter((m) => m.title || m.h1);
    } catch { /* skip */ }
  }

  try {
    const ideas = await generateContentIdeas({ keywords: keywords.slice(0, 10), category, pageMeta });
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("[keyword-extractor/generate-ideas]", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
