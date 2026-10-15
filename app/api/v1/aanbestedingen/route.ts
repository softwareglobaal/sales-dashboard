import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { bewaar, controleer, laatste } from "@/lib/aanbestedingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De Tenderwachter zet hier de stand van de openbare aanbestedingen (spec §19): per firma de
// situatie, de zoekcriteria met uitleg en alle open opdrachten met het oordeel "kunnen we
// meedoen". Elke POST is een volledige momentopname; de pagina /aanbestedingen toont de laatste.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  const m = laatste();
  if (!m) return NextResponse.json({ error: "Nog geen stand ontvangen." }, { status: 404 });
  return NextResponse.json(m);
}

export async function POST(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;
  const tekst = await req.text();
  if (tekst.length > 5_000_000) return NextResponse.json({ error: "Te groot (max. 5 MB)." }, { status: 413 });
  let m: any;
  try {
    m = JSON.parse(tekst);
  } catch {
    return NextResponse.json({ error: "Geen geldige JSON." }, { status: 400 });
  }
  const fout = controleer(m);
  if (fout) return NextResponse.json({ error: fout }, { status: 400 });
  const id = bewaar(m);
  const treffers = m.firmas.reduce((n: number, f: any) => n + f.treffers.length, 0);
  return NextResponse.json({ ok: true, id, firmas: m.firmas.length, treffers });
}
