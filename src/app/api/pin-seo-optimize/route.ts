import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

  const body = await req.json() as {
    title: string;
    description: string;
    focusKeyword: string;
    selectedKeywords: string[];
    board?: string;
  };

  const { title, description, focusKeyword, selectedKeywords, board } = body;
  if (!focusKeyword) return NextResponse.json({ error: "focusKeyword required" }, { status: 400 });

  const kwList = [focusKeyword, ...selectedKeywords].filter(Boolean).join(", ");

  const prompt = `You are a Pinterest SEO expert. Optimize this pin for Pinterest search.

Focus Keyword: "${focusKeyword}"
All Keywords to include: ${kwList}
Board: ${board || "not specified"}

Current Title: "${title}"
Current Description: "${description}"

Rules:
- Title: max 100 chars, include focus keyword naturally near the start, compelling and clickable
- Description: 150-500 chars, include focus keyword + 2-3 selected keywords naturally, add relevant hashtags at end
- Do NOT sound robotic or keyword-stuffed — it must read naturally
- Return ONLY valid JSON, no markdown

Return format:
{"title":"...","description":"..."}`;

  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    const result = JSON.parse(jsonMatch[0]) as { title: string; description: string };
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
