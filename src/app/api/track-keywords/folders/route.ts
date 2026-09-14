import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFolders, createFolder, getFolderStats } from "@/lib/track-keywords-db";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const folders = await listFolders(email);
  // Attach keyword/pin counts to each folder
  const withStats = await Promise.all(
    folders.map(async f => {
      const stats = await getFolderStats(email, f.id);
      return { ...f, ...stats };
    })
  );
  return NextResponse.json({ folders: withStats });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as { name?: string; description?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Folder name too long (max 80 chars)" }, { status: 400 });

  // Prevent duplicate names
  const existing = await listFolders(email);
  if (existing.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: `A folder named "${name}" already exists` }, { status: 409 });
  }

  const folder = await createFolder(email, name, body.description ?? "");
  return NextResponse.json({ folder }, { status: 201 });
}
