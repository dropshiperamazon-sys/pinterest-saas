import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "No Pinterest account connected" }, { status: 401 });

  try {
    const res = await fetch("https://api.pinterest.com/v5/boards?page_size=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "Pinterest API error", details: data }, { status: res.status });
    }

    const boards = (data.items || []).map((b: { id: string; name: string }) => ({
      id: b.id,
      name: b.name,
    }));

    return NextResponse.json({ boards });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch boards", details: String(err) }, { status: 500 });
  }
}
