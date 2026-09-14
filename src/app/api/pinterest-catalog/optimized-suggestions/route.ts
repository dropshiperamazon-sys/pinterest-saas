import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import OpenAI from "openai";
import { computeCatalogSeoScore } from "@/lib/catalog-seo-score";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  try { return res.json(); } catch { return null; }
}

export interface OptimizedSuggestionsResponse {
  current: {
    title: string;
    description: string;
    score: number;
    issues: string[];
    imageLink: string;
    link: string;
    price: string;
    availability: string;
    brand: string;
    condition: string;
    googleProductCategory: string;
  };
  suggested: {
    title: string;
    description: string;
    projectedScore: number;
    projectedIssues: string[];
  };
  keywords: {
    primary: string[];
    secondary: string[];
    related: string[];
  };
  improvements: string[];
  issues: string[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const body = await req.json() as { productId: string; feedId?: string; focusKeyword?: string };
  const { productId, feedId, focusKeyword } = body;

  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  // Fetch the specific product from Pinterest catalog
  // Try direct items endpoint first
  let productData: Record<string, unknown> | null = null;

  const directData = await pGet(`/catalogs/items?item_ids=${encodeURIComponent(productId)}&country=US&language=EN`, accessToken);
  if (directData?.items?.length) {
    productData = directData.items[0] as Record<string, unknown>;
  }

  // Fallback: fetch via feed/product groups
  if (!productData && feedId) {
    const groupsData = await pGet(`/catalogs/product_groups?feed_id=${encodeURIComponent(feedId)}&page_size=50`, accessToken);
    const groups: Record<string, unknown>[] = groupsData?.items ?? [];
    for (const g of groups) {
      if (productData) break;
      const gProducts = await pGet(`/catalogs/product_groups/${encodeURIComponent(String(g.id))}/products?page_size=100`, accessToken);
      if (Array.isArray(gProducts?.items)) {
        for (const item of gProducts.items as Record<string, unknown>[]) {
          const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
          const attrs = (item.attributes && typeof item.attributes === "object" ? item.attributes : {}) as Record<string, unknown>;
          const pin = (item.pin && typeof item.pin === "object" ? item.pin : {}) as Record<string, unknown>;
          const id = String(meta.item_id ?? attrs.item_id ?? pin.id ?? item.id ?? "");
          if (id === productId) { productData = item; break; }
        }
      }
    }
  }

  if (!productData) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Extract product fields
  const meta = (productData.metadata && typeof productData.metadata === "object" ? productData.metadata : {}) as Record<string, unknown>;
  const pin = (productData.pin && typeof productData.pin === "object" ? productData.pin : {}) as Record<string, unknown>;
  const attrs = (productData.attributes && typeof productData.attributes === "object" ? productData.attributes : {}) as Record<string, unknown>;
  const pinMedia = pin.media && typeof pin.media === "object" ? pin.media as Record<string, unknown> : {};
  const pinImages = pinMedia.images && typeof pinMedia.images === "object"
    ? pinMedia.images as Record<string, { url?: string }>
    : (pin.images && typeof pin.images === "object" ? pin.images as Record<string, { url?: string }> : {});

  const title = (pin.title as string) ?? (attrs.title as string) ?? "";
  const description = (pin.description as string) ?? (attrs.description as string) ?? "";
  const link = (pin.link as string) ?? (attrs.link as string) ?? "";
  const imageLink =
    pinImages["1200x"]?.url ?? pinImages["736x"]?.url ?? pinImages["600x"]?.url ??
    pinImages["400x300"]?.url ?? pinImages["150x150"]?.url ??
    (attrs.image_link as string) ?? "";
  const availability = (meta.availability as string) ?? (attrs.availability as string) ?? "";
  const price = String((meta.price as string | number) ?? (attrs.price as string) ?? "");
  const brand = (meta.brand as string) ?? (attrs.brand as string) ?? "";
  const condition = (meta.condition as string) ?? (attrs.condition as string) ?? "";
  const googleProductCategory = (meta.google_product_category as string) ?? (attrs.google_product_category as string) ?? "";

  const currentScoreResult = computeCatalogSeoScore({ title, description, imageLink, link, brand, googleProductCategory, condition, availability });

  // Optionally fetch keyword data for the product title
  let keywordContext = "";
  try {
    const titleWords = title.split(" ").slice(0, 4).join(" ");
    const kwRes = await fetch(`${req.nextUrl.origin}/api/keyword-db/search?q=${encodeURIComponent(titleWords)}&limit=10`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    if (kwRes.ok) {
      const kwData = await kwRes.json() as { keywords?: { keyword: string; monthlySearches: number | null }[] };
      const kws = (kwData.keywords ?? []).slice(0, 8).map(k => `${k.keyword}${k.monthlySearches ? ` (${k.monthlySearches}/mo)` : ""}`);
      if (kws.length > 0) keywordContext = `\nAvailable Pinterest keyword data:\n${kws.join(", ")}`;
    }
  } catch { /* keyword fetch is best-effort */ }

  // Build OpenAI prompt
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

  const systemPrompt = `You are a Pinterest product SEO specialist.
Optimize Shopify/catalog product metadata for Pinterest discovery.
Use ONLY factual information present in the provided product data.
Never invent product attributes, materials, gemstones, colors, dimensions, or claims.
Do not keyword stuff. Write naturally.
Prioritize product relevance over keyword volume.
The product title should immediately communicate what the product is.
The description should provide useful semantic context.
Use available Pinterest keyword research data when provided.
Preserve the brand voice. Do not claim guaranteed Pinterest rankings.
Return structured JSON only.`;

  const userPrompt = `Product to optimize for Pinterest:

Title: ${title || "(none)"}
Description: ${description || "(none)"}
Brand: ${brand || "(none)"}
Price: ${price || "(none)"}
Availability: ${availability || "(none)"}
Condition: ${condition || "(none)"}
Google Product Category: ${googleProductCategory || "(none)"}
Product URL: ${link || "(none)"}
Focus Keyword: ${focusKeyword || "(none — infer from product data)"}
${keywordContext}

Generate a JSON object with exactly these fields:
{
  "suggestedTitle": "<optimized title, 20-150 chars, factual, no inventions>",
  "suggestedDescription": "<optimized description, 100-500 chars, factual, Pinterest-friendly>",
  "improvements": ["<specific improvement made>", ...],
  "issues": ["<identified issue with current content>", ...],
  "keywords": {
    "primary": ["<primary keyword>"],
    "secondary": ["<secondary keyword 1>", "<secondary keyword 2>"],
    "related": ["<related term 1>", "<related term 2>", "<related term 3>"]
  }
}

Rules:
- suggestedTitle: keep product identity, improve clarity and keyword placement. Max 150 chars.
- suggestedDescription: 100-500 chars, include primary product type, material if known, relevant style/use context. No keyword stuffing.
- improvements: list what is better about the suggestions vs the current content.
- issues: list problems with the CURRENT content (missing info, too short, poor keyword placement etc).
- keywords: only terms genuinely relevant to this specific product. Never generic filler.`;

  let aiResult: {
    suggestedTitle?: string;
    suggestedDescription?: string;
    improvements?: string[];
    issues?: string[];
    keywords?: { primary?: string[]; secondary?: string[]; related?: string[] };
  } = {};

  function extractJson(text: string): Record<string, unknown> {
    // Try direct parse
    try { return JSON.parse(text); } catch { /* fall through */ }
    // Extract first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    return {};
  }

  try {
    let content: string | null = null;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      });
      content = completion.choices[0]?.message?.content ?? null;
    } catch (jsonModeErr) {
      // Fallback: retry without response_format (some model versions don't support it)
      console.warn("[optimized-suggestions] json_object mode failed, retrying without:", (jsonModeErr as Error).message);
      const completion2 = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt + "\n\nIMPORTANT: Respond with raw JSON only, no markdown code fences." },
        ],
        temperature: 0.5,
        max_tokens: 1200,
      });
      content = completion2.choices[0]?.message?.content ?? null;
    }
    aiResult = extractJson(content ?? "{}") as typeof aiResult;
  } catch (err) {
    console.error("[optimized-suggestions] AI error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }

  const suggestedTitle = (aiResult.suggestedTitle ?? title).slice(0, 150);
  const suggestedDescription = aiResult.suggestedDescription ?? description;

  const projectedScoreResult = computeCatalogSeoScore({
    title: suggestedTitle,
    description: suggestedDescription,
    imageLink,
    link,
    brand,
    googleProductCategory,
    condition,
    availability,
  });

  const response: OptimizedSuggestionsResponse = {
    current: {
      title, description, score: currentScoreResult.score, issues: currentScoreResult.issues,
      imageLink, link, price, availability, brand, condition, googleProductCategory,
    },
    suggested: {
      title: suggestedTitle,
      description: suggestedDescription,
      projectedScore: projectedScoreResult.score,
      projectedIssues: projectedScoreResult.issues,
    },
    keywords: {
      primary: Array.isArray(aiResult.keywords?.primary) ? aiResult.keywords!.primary : [],
      secondary: Array.isArray(aiResult.keywords?.secondary) ? aiResult.keywords!.secondary : [],
      related: Array.isArray(aiResult.keywords?.related) ? aiResult.keywords!.related : [],
    },
    improvements: Array.isArray(aiResult.improvements) ? aiResult.improvements : [],
    issues: Array.isArray(aiResult.issues) ? aiResult.issues : [],
  };

  return NextResponse.json(response);
}
