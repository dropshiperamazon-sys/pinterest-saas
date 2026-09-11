import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as {
    query: string;
    country?: string;
    existingKeywords?: string[];
  };

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const query = body.query.trim();
  const country = body.country ?? "US";
  const existing = (body.existingKeywords ?? []).slice(0, 30);

  const existingList = existing.length > 0
    ? `\nExisting keywords already shown (do NOT repeat these):\n${existing.map(k => `- ${k}`).join("\n")}`
    : "";

  const prompt = `You are a Pinterest keyword research expert. Generate 20 fresh, highly relevant keyword ideas for Pinterest users researching: "${query}" in ${country}.
${existingList}

Requirements:
- Return ONLY a JSON array of keyword strings, nothing else
- Each keyword should be 2-5 words, natural Pinterest search phrases
- Mix of: long-tail variations, related niches, seasonal angles, how-to phrases, style/aesthetic terms
- Avoid generic single words; make each keyword specific and actionable

Return format (strict JSON array, no markdown):
["keyword one", "keyword two", ...]`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }
  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ keywords: [] });
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[];
    return NextResponse.json({
      keywords: keywords.filter(k => typeof k === "string" && k.trim()).slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to generate ideas", detail: msg }, { status: 500 });
  }
}
