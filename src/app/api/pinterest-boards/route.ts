import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const accessToken = (session as { accessToken?: string })?.accessToken || process.env.PINTEREST_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch("https://api.pinterest.com/v5/boards?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: res.status });
  }

  const data = await res.json();
  const boards = (data.items || []).map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }));

  return NextResponse.json({ boards });
}
