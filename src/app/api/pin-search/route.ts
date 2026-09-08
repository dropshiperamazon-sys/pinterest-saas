import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface LivePin {
  id: string;
  title: string;
  description: string;
  link: string;
  pinUrl: string;
  thumbnailUrl: string;
  pinnerUsername: string;
  creativeType: string;
  mediaType: string;
  createdAt: string;
  altText: string;
}

async function getAccessToken(email: string): Promise<string> {
  const raw = await redis.get<string>(`pinterest_connection:${email}`);
  const conn = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken?: string } : null;
  return conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ pins: [] });

  const accessToken = await getAccessToken(session.user.email);
  if (!accessToken) {
    return NextResponse.json({ error: "Pinterest not connected", pins: [] }, { status: 200 });
  }

  try {
    const res = await fetch(
      `https://api.pinterest.com/v5/pins?query=${encodeURIComponent(q)}&page_size=25`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: `Pinterest API error: ${res.status}`, detail: err, pins: [] }, { status: 200 });
    }

    const data = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(data.items) ? data.items : [];

    const pins: LivePin[] = items
      .filter(p => p.title || p.description)
      .map(p => {
        const media = (p.media ?? {}) as Record<string, unknown>;
        const images = (media.images ?? {}) as Record<string, { url?: string }>;
        const thumbnailUrl =
          images["400x300"]?.url ?? images["600x"]?.url ?? images["150x150"]?.url ?? "";

        const boardOwner = (p.board_owner ?? {}) as Record<string, unknown>;

        return {
          id: String(p.id ?? ""),
          title: String(p.title ?? "").trim(),
          description: String(p.description ?? "").trim(),
          link: String(p.link ?? "").trim(),
          pinUrl: p.id ? `https://www.pinterest.com/pin/${p.id}/` : "",
          thumbnailUrl,
          pinnerUsername: String(boardOwner.username ?? "").trim(),
          creativeType: String(p.creative_type ?? "REGULAR").trim(),
          mediaType: String(media.media_type ?? "image").trim(),
          createdAt: String(p.created_at ?? "").trim(),
          altText: String(p.alt_text ?? "").trim(),
        };
      })
      .filter(p => p.title.length > 0 || p.description.length > 10)
      .slice(0, 20);

    return NextResponse.json({ pins });
  } catch (err) {
    console.error("[pin-search] error:", err);
    return NextResponse.json({ error: "Failed to fetch pins", pins: [] }, { status: 200 });
  }
}
