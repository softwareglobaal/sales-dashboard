import { NextResponse } from "next/server";
import {
  importeerVerslaggevers, importeerArchitecten, crawlDomeinen, teCrawlenDomeinen,
  herberekenAfleidingen, bepaalMarkten,
} from "@/lib/concurrentie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Draait de concurrentiemonitor.
 *   ?import=1        leest beide registers opnieuw in (VEKA + Orde van Architecten)
 *   ?limiet=50       crawlt maximaal 50 domeinen (oudste check eerst); 0 = geen grens
 *   ?crawl=0         alleen inlezen en indelen, geen enkele site bezoeken
 *   ?domein=x.be     crawlt één domein
 *   ?markten=1       deelt de gevolgde domeinen opnieuw in bij een markt
 *   ?herbereken=1    leidt de afgeleide cijfers opnieuw af, zonder te crawlen
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
  if (url.searchParams.get("markten") === "1") {
    return { ...uit, markten: bepaalMarkten() };
  }

  if (doeImport) {
    uit.register = importeerVerslaggevers();
    // Het architectenregister mag ontbreken -- dan is de rest van de run nog
    // steeds zinvol, en zegt het antwoord waarom die markt leeg blijft.
    try {
      uit.architectenregister = importeerArchitecten();
    } catch (e) {
      uit.architectenregister = { ok: false, fout: String((e as Error)?.message || e) };
    }
  }

  // Let op: limiet=0 betekent "geen grens", niet "niets". Wie alleen de registers
  // wil inlezen gebruikt crawl=0 -- anders bezoekt deze route in één keer elke
  // gevolgde site, en dat zijn er inmiddels een paar duizend.
  if (url.searchParams.get("crawl") === "0") {
    uit.markten = bepaalMarkten();
    return uit;
  }

  const domeinen = enkel ? [enkel] : teCrawlenDomeinen(limiet);
  const resultaten = await crawlDomeinen(domeinen);

  uit.gecrawld = resultaten.length;
  uit.online = resultaten.filter((r) => r.ok).length;
  // Een verse crawl kan een domein in een markt duwen (of er in houden), dus de
  // indeling meteen bijwerken -- anders staat een nieuwe speler dagen op de
  // verkeerde pagina.
  uit.markten = bepaalMarkten();
  uit.fouten = resultaten.filter((r) => !r.ok).map((r) => ({ domein: r.domein, fout: r.fout }));
  return uit;
}

export async function GET(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}

export async function POST(request: Request) {
  return NextResponse.json({ ok: true, ...(await draai(new URL(request.url))) });
}
