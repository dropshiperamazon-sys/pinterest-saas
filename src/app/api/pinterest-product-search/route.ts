import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 401 });

  const { accessToken } = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ products: [] });

  try {
    // Pinterest v5: search pins (products are pins with a price/link)
    const res = await fetch(
      `https://api.pinterest.com/v5/pins?query=${encodeURIComponent(query)}&page_size=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "Pinterest API error", details: data }, { status: res.status });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products = (data.items ?? []).map((pin: any) => ({
      id: pin.id,
      title: pin.title ?? pin.description ?? "Untitled pin",
      imageUrl: pin.media?.images?.["150x150"]?.url ?? "",
      link: pin.link ?? "",
    }));

    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: "Failed to search products", details: String(err) }, { status: 500 });
  }
}
