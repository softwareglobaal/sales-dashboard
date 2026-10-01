import { NextResponse } from "next/server";
import { oordeel } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Goedkeuren of afwijzen van een draft (enkel editors: middleware.ts). De naam komt
// uit de login, nooit uit het verzoek.
export async function POST(req: Request) {
  const wie = req.headers.get("x-authentik-username") || (process.env.TOEGANG_DEV === "1" ? "lokaal" : "");
  const body = await req.json().catch(() => null);
  if (!body?.kans_id || typeof body.goed !== "boolean") return NextResponse.json({ error: "kans_id en goed zijn verplicht." }, { status: 400 });
  const r = oordeel(String(body.kans_id), body.goed, wie);
  return NextResponse.json({ ok: true, status: r.status });
}
