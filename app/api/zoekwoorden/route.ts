import { NextResponse } from "next/server";
import { importeerZoekwoorden, haalZoekvolumes, meetPosities, serpBron, herclassificeerSerpDomeinen } from "@/lib/zoekwoorden";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 *   ?volumes=1   haalt zoekvolumes op bij Google Ads Keyword Planner
 *   ?posities=1  meet de posities bij de gekoppelde SERP-bron
 *   zonder parameters: alleen de zoekwoordenlijst inlezen
 */
async function draai(url: URL) {
  const uit: Record<string, unknown> = { zoekwoorden: importeerZoekwoorden() };

  if (url.searchParams.get("volumes") === "1") {
    uit.volumes = await haalZoekvolumes();
  }
  if (url.searchParams.get("posities") === "1") {
    const limiet = Number(url.searchParams.get("limiet") || 0) || undefined;
    uit.posities = await meetPosities(limiet);
  }
  // ?herclassificeer=1 deelt eerder gevonden SERP-domeinen opnieuw in.
  if (url.searchParams.get("herclassificeer") === "1") {
    uit.herclassificeerd = herclassificeerSerpDomeinen();
  }

  uit.serpBron = serpBron();
  return uit;
}

export async function GET(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}

export async function POST(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}
