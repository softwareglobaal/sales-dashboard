import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { AFDELINGEN } from "@/lib/afdelingen";
import { koppeling, standVoor, WACHTTIJD_DAGEN } from "@/lib/facturatie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verkocht tegenover gefactureerd per dienst, met de gaten (spec §17). Voor de
// dagelijkse sales-wacht van de agents, zodat een nieuw gat proactief op het board
// komt in plaats van enkel op het scherm. ?jaar=JJJJ (standaard dit jaar).
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const nu = new Date().getFullYear();
  const gevraagd = Number(new URL(req.url).searchParams.get("jaar") || nu);
  if (gevraagd !== nu && gevraagd !== nu - 1) {
    return NextResponse.json({ error: "jaar moet dit of vorig jaar zijn", toegestaan: [nu, nu - 1] }, { status: 400 });
  }

  const k = await koppeling();
  if (k.status !== "ok") {
    return NextResponse.json({ status: k.status, melding: k.status === "fout" ? k.melding : null }, { status: 503 });
  }

  return NextResponse.json({
    jaar: gevraagd,
    ververst: k.data.ververst,
    wachttijdDagen: WACHTTIJD_DAGEN,
    diensten: AFDELINGEN.filter((a) => a.facturatie.length).map((a) => {
      const s = standVoor(k.data, a, String(gevraagd));
      return {
        dienst: a.pad,
        naam: a.naam,
        verkocht: Math.round(s.verkocht),
        gefactureerd: Math.round(s.gefactureerd),
        nogTeFactureren: Math.round(s.nogTeFactureren),
        gaten: s.gaten.map((g) => ({
          soort: g.soort,
          firma: g.firma,
          werf: g.werf || g.klant,
          projectnr: g.projectnr,
          gewonnenOp: g.gewonnen_op,
          verkocht: g.verkocht,
          gefactureerd: g.gefactureerd,
          verschil: g.verschil,
        })),
      };
    }),
  });
}
