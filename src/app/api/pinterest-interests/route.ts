import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 401 });

  const { accessToken } = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

  try {
    // Pinterest v5: list user interests
    const res = await fetch("https://api.pinterest.com/v5/user_account/following/interests?page_size=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "Pinterest API error", details: data }, { status: res.status });
    }

    const interests = (data.items ?? []).map((item: { id: string; name: string }) => ({
      id: item.id,
      name: item.name,
    }));

    return NextResponse.json({ interests });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch interests", details: String(err) }, { status: 500 });
  }
}
