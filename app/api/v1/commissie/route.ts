import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { AFDELINGEN, dataset, doelData, perMaand } from "@/lib/afdelingen";
import { algemeneRegels, beloning, commissieConfig, commissieStatus, type Afdeling } from "@/lib/commissie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De teambeloning van één maand, per afdeling: de gewonnen omzet, de hoogst
// behaalde mijlpaal, de pot en wat dat per persoon is.
//
// Payrun haalt dit op en maakt er een commissieregel van. Daar wordt dus niets
// opnieuw uitgerekend: het dashboard bezit de definities (welke omzet telt, op
// welke datum, welke mijlpaal) en levert de uitkomst uit. Zie DASHBOARD-SPEC.md.
//
//   GET /api/v1/commissie?maand=2026-09[&afdeling=engineering]
//
// Zonder ?maand= de maand die nu loopt. Die is per definitie nog niet af; dat
// staat in het antwoord als "lopend": pas als de maand om is, is de pot
// definitief. En let op "status": zolang het model een voorstel is, hoort er
// niets op een loonstrook terecht te komen.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const url = new URL(req.url);
  const nu = new Date();
  const lopendeMaand = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
  const maand = url.searchParams.get("maand") || lopendeMaand;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(maand)) {
    return NextResponse.json({ error: `Onbekende maand '${maand}'. Verwacht JJJJ-MM.` }, { status: 400 });
  }

  const gevraagd = (url.searchParams.get("afdeling") || "").toLowerCase();
  if (gevraagd && gevraagd !== "engineering" && gevraagd !== "energy") {
    return NextResponse.json(
      { error: `Onbekende afdeling '${gevraagd}'.`, toegestaan: ["engineering", "energy"] },
      { status: 400 },
    );
  }
  const welke: Afdeling[] = gevraagd ? [gevraagd as Afdeling] : ["engineering", "energy"];

  const jaar = +maand.slice(0, 4);
  const nr = +maand.slice(5, 7);

  const afdelingen = welke.map((sleutel) => {
    const a = AFDELINGEN.find((x) => x.doel.bron === `commissie.${sleutel}`);
    // Dezelfde cijfers als de balk op het dashboard: gewonnen omzet van die
    // kalendermaand, uit dezelfde dataset en dezelfde functie.
    // Enkel de bronnen die meetellen voor de beloning (Energy: alleen UNABO).
    const omzet = a ? perMaand(doelData(a, dataset(a)), jaar)[nr - 1]?.omzet || 0 : 0;
    const b = beloning(sleutel, omzet);
    const c = commissieConfig(sleutel);
    return {
      afdeling: sleutel,
      titel: c.titel,
      omvat: c.omvat,
      omzet: b.omzet,
      doel: b.doel,
      behaaldeMijlpaal: b.behaald ? b.behaald.omzet : null,
      volgendeMijlpaal: b.volgende ? { omzet: b.volgende.omzet, pot: b.volgende.pot } : null,
      pot: b.pot,
      verdeling: b.verdeling,
    };
  });

  return NextResponse.json({
    maand,
    lopend: maand === lopendeMaand,
    valuta: "EUR",
    status: commissieStatus(),
    regels: algemeneRegels(),
    afdelingen,
    totaal: Math.round(afdelingen.reduce((t, a) => t + a.pot, 0) * 100) / 100,
  });
}
