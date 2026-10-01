import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { meld, opdrachten, type ContentStatus } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De SEO-agents melden hier wat ze met een kans deden (spec §17). Status:
// in-behandeling, niet-passend (met de reden in samenvatting) of wacht-op-goedkeuring
// (met tekst, qc-verslag en bestand). Goedkeuren of afwijzen kan enkel een editor op /content.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  const s = new URL(req.url).searchParams.get("status") as ContentStatus | null;
  return NextResponse.json({ opdrachten: opdrachten(s || undefined) });
}

export async function POST(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geen geldige JSON." }, { status: 400 });
  }
  if (!body?.kans_id || !body?.status) return NextResponse.json({ error: "kans_id en status zijn verplicht." }, { status: 400 });
  if (body.status === "goedgekeurd" || body.status === "afgewezen") {
    return NextResponse.json({ error: "Goedkeuren of afwijzen doet een mens, op /content." }, { status: 403 });
  }
  try {
    const r = meld({
      kans_id: String(body.kans_id),
      status: body.status,
      soort: body.soort, markt: body.markt, dienst: body.dienst, firma: body.firma, titel: body.titel,
      samenvatting: body.samenvatting, tekst: body.tekst, qc: body.qc, bestand: body.bestand, door: body.door || "seo-agents",
    });
    return NextResponse.json({ ok: true, opdracht: { kans_id: r.kans_id, status: r.status } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
