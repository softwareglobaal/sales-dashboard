import { NextResponse } from "next/server";
import { importeerZoekwoorden, haalZoekvolumes, meetPosities, serpBron, herclassificeerSerpDomeinen } from "@/lib/zoekwoorden";
import type { Markt } from "@/lib/concurrentie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 *   ?markt=energie|engineering|architectuur  welke markt (standaard: energie)
 *   ?volumes=1   haalt zoekvolumes op bij Google Ads Keyword Planner
 *   ?posities=1  meet de posities bij de gekoppelde SERP-bron
 *   zonder parameters: alleen de zoekwoordenlijsten inlezen (alle markten)
 *
 * Het gratis SerpApi-quotum geldt voor alle markten samen, dus posities meten
 * we per markt met een eigen limiet in plaats van alles in één run.
 */
async function draai(url: URL) {
  const gevraagd = url.searchParams.get("markt");
  const markt: Markt =
    gevraagd === "engineering" ? "engineering"
      : gevraagd === "architectuur" ? "architectuur"
        : "energie";
  const uit: Record<string, unknown> = { zoekwoorden: importeerZoekwoorden() };

  if (url.searchParams.get("volumes") === "1") {
    uit.volumes = await haalZoekvolumes(markt);
  }
  if (url.searchParams.get("posities") === "1") {
    const limiet = Number(url.searchParams.get("limiet") || 0) || undefined;
    uit.posities = await meetPosities(limiet, markt);
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
