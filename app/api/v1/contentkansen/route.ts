import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { kansen } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open contentkansen voor de SEO-agents (spec §17): herschrijfkansen en nieuwe blogs van
// concurrenten, per markt voorgefilterd, nog niet opgepakt. ?max= (standaard 30).
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  const max = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("max") || 30)));
  return NextResponse.json({ kansen: kansen(max) });
}
