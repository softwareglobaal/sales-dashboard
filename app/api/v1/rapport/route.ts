import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { rapport } from "@/lib/rapport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tekst van het salesrapport (spec §17c): ?soort=week (vorige week) of ?soort=maand (vorige maand).
// Het verzendscript op de server post dit in Zoom; het rekent zelf niets.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  const soort = new URL(req.url).searchParams.get("soort") === "maand" ? "maand" : "week";
  return NextResponse.json({ soort, tekst: await rapport(soort) });
}
