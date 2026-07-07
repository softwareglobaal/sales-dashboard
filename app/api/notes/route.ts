import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const r = db.prepare("SELECT content, updated_at FROM notes WHERE id='shared'").get() as any;
  return NextResponse.json({ content: r?.content || "", updatedAt: r?.updated_at || null });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO notes (id, content, updated_at) VALUES ('shared', ?, ?)").run(content, now);
  return NextResponse.json({ ok: true, updatedAt: now });
}
