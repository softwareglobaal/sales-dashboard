import { NextResponse } from "next/server";
import { importeerVerslaggevers, crawlDomeinen, teCrawlenDomeinen, herberekenAfleidingen } from "@/lib/concurrentie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Draait de concurrentiemonitor.
 *   ?import=1        leest het VEKA-register opnieuw in
 *   ?limiet=50       crawlt maximaal 50 domeinen (oudste check eerst)
 *   ?domein=x.be     crawlt één domein
 * Zonder parameters: import + crawl van de 60 domeinen die het langst geleden
 * gecontroleerd zijn. Zo blijft één run binnen de tijdslimiet en is de hele
 * lijst na een paar dagen rond.
 */
async function draai(url: URL) {
  const doeImport = url.searchParams.get("import") !== "0";
  const enkel = url.searchParams.get("domein");
  const limiet = Number(url.searchParams.get("limiet") || 60);

  const uit: Record<string, unknown> = {};

  // ?herbereken=1 leidt de afgeleide cijfers opnieuw af uit opgeslagen URL's,
  // zonder één site opnieuw te bezoeken.
  if (url.searchParams.get("herbereken") === "1") {
    return { ...uit, ...herberekenAfleidingen() };
  }

  if (doeImport) uit.register = importeerVerslaggevers();

  const domeinen = enkel ? [enkel] : teCrawlenDomeinen(limiet);
  const resultaten = await crawlDomeinen(domeinen);

  uit.gecrawld = resultaten.length;
  uit.online = resultaten.filter((r) => r.ok).length;
  uit.fouten = resultaten.filter((r) => !r.ok).map((r) => ({ domein: r.domein, fout: r.fout }));
  return uit;
}

export async function GET(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}

export async function POST(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}
