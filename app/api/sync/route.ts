import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const results = await syncAll();
  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  const results = await syncAll();
  return NextResponse.json({ ok: true, results });
}
