import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteImport } from "@/lib/keyword-db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteImport(id);
  } catch (err) {
    console.error("deleteImport error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
