import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateSEOSuggestions } from "@/lib/seo-audit-ai";
import type { PinSEOInput } from "@/lib/seo-audit-engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as Partial<PinSEOInput>;

  const input: PinSEOInput = {
    id: body.id ?? "",
    title: body.title ?? "",
    description: body.description ?? "",
    altText: body.altText ?? "",
    link: body.link ?? "",
    boardName: body.boardName ?? "",
    boardDescription: body.boardDescription ?? "",
    focusKeyword: body.focusKeyword ?? "",
  };

  try {
    const suggestions = await generateSEOSuggestions(input);
    return NextResponse.json(suggestions);
  } catch (err) {
    console.error("[seo-audit/generate] error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
