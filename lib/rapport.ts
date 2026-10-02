// Salesrapport voor Zoom (spec §17c): elke maandag de vorige week, elke 1e van de maand
// de vorige maand. Het dashboard maakt de tekst zelf, met exact dezelfde cijfers als op
// het scherm; het verzendscript (deploy/salesrapport.py) post enkel wat hier uitkomt.

import { AFDELINGEN, dataset, kpis, maanddoel, openNu, type Afdeling } from "./afdelingen";
import { koppeling, standVoor } from "./facturatie";
import { aantalWachtend } from "./content";
import { MONTH_NAMES } from "./queries";

const euro = (n: number) => "€ " + Math.round(n).toLocaleString("nl-BE");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dagNl = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);
const pijl = (nu: number, vorig: number) => (nu > vorig ? `▲ ${nu - vorig}` : nu < vorig ? `▼ ${vorig - nu}` : "=");

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dag = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dag + 3);
  const eersteDo = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round((t.getTime() - eersteDo.getTime()) / (7 * 86400000));
}

// Diensten met een doel of genoeg beweging krijgen een eigen regel; de rest één samenregel.
const HOOFD = ["engineering", "energy", "h-architects", "regularisatie"];

type Venster = { van: string; tot: string; vVan: string; vTot: string; titel: string; vergelijk: string; maand?: { jaar: number; maand: number } };

export function venster(soort: "week" | "maand", nu = new Date()): Venster {
  if (soort === "maand") {
    const jaar = nu.getMonth() === 0 ? nu.getFullYear() - 1 : nu.getFullYear();
    const maand = nu.getMonth() === 0 ? 12 : nu.getMonth(); // vorige maand, 1..12
    const p = (n: number) => String(n).padStart(2, "0");
    const van = `${jaar}-${p(maand)}-01`;
    const tot = maand === 12 ? `${jaar + 1}-01-01` : `${jaar}-${p(maand + 1)}-01`;
    return {
      van, tot,
      vVan: `${jaar - 1}-${p(maand)}-01`,
      vTot: maand === 12 ? `${jaar}-01-01` : `${jaar - 1}-${p(maand + 1)}-01`,
      titel: `Maandrapport ${MONTH_NAMES[maand - 1]} ${jaar}`,
      vergelijk: `${MONTH_NAMES[maand - 1]} ${jaar - 1}`,
      maand: { jaar, maand },
    };
  }
  // vorige week, maandag tot en met zondag
  const maandag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ((nu.getDay() + 6) % 7) - 7);
  const zondag = new Date(maandag.getFullYear(), maandag.getMonth(), maandag.getDate() + 7);
  const vMaandag = new Date(maandag.getFullYear(), maandag.getMonth(), maandag.getDate() - 7);
  return {
    van: iso(maandag), tot: iso(zondag), vVan: iso(vMaandag), vTot: iso(maandag),
    titel: `Salesrapport week ${isoWeek(maandag)} · ${dagNl(iso(maandag))} tot ${dagNl(iso(new Date(zondag.getTime() - 86400000)))}/${zondag.getFullYear()}`,
    vergelijk: "vorige week",
  };
}

export async function rapport(soort: "week" | "maand", nu = new Date()): Promise<string> {
  const v = venster(soort, nu);
  const regels: string[] = [v.titel, ""];
  // Lopende maand voor de doelregel (bij het maandrapport: de afgesloten maand).
  const doelVan = v.maand ? v.van : iso(new Date(nu.getFullYear(), nu.getMonth(), 1));
  const doelTot = v.maand ? v.tot : iso(new Date(nu.getFullYear(), nu.getMonth() + 1, 1));
  const doelNaam = v.maand ? MONTH_NAMES[v.maand.maand - 1] : MONTH_NAMES[nu.getMonth()];

  let rest = { a: 0, w: 0, o: 0, namen: [] as string[] };
  let tot = { a: 0, w: 0, o: 0, va: 0, vo: 0 };
  for (const a of AFDELINGEN) {
    const d = dataset(a);
    const k = kpis(d, v.van, v.tot);
    const p = kpis(d, v.vVan, v.vTot);
    tot = { a: tot.a + k.aanvragen, w: tot.w + k.gewonnen, o: tot.o + k.omzet, va: tot.va + p.aanvragen, vo: tot.vo + p.omzet };
    if (!HOOFD.includes(a.pad)) {
      rest = { a: rest.a + k.aanvragen, w: rest.w + k.gewonnen, o: rest.o + k.omzet, namen: [...rest.namen, a.naam] };
      continue;
    }
    regels.push(`${a.naam.toUpperCase()}: ${k.aanvragen} aanvragen (${pijl(k.aanvragen, p.aanvragen)}) · ${k.gewonnen} gewonnen · ${euro(k.omzet)}` +
      (p.omzet ? ` (${v.vergelijk} ${euro(p.omzet)})` : ""));
    const extra: string[] = [];
    const doel = maanddoel(a);
    if (doel) {
      const m = kpis(d, doelVan, doelTot);
      extra.push(`Doel ${doelNaam}: ${euro(m.omzet)} van ${euro(doel)} (${Math.round((m.omzet / doel) * 100)}%)`);
    }
    const o = openNu(d);
    if (o.zonderOfferte > 0) extra.push(`${o.open} open, waarvan ${o.zonderOfferte} nog zonder offerte`);
    if (extra.length) regels.push("   " + extra.join(" · "));
  }
  if (rest.namen.length) {
    regels.push(`OVERIGE DIENSTEN (${rest.namen.join(", ")}): ${rest.a} aanvragen · ${rest.w} gewonnen · ${euro(rest.o)}`);
  }
  regels.push("", `TOTAAL: ${tot.a} aanvragen (${pijl(tot.a, tot.va)}) · ${tot.w} gewonnen · ${euro(tot.o)}`);
  regels.push("(een bundeldeal telt bij elke dienst mee)");

  // Aandachtspunten: facturatiegaten en teksten die op goedkeuring wachten.
  const aandacht: string[] = [];
  const kop = await koppeling();
  if (kop.status === "ok") {
    const jaar = v.van.slice(0, 4);
    const gaten = AFDELINGEN.filter((a: Afdeling) => a.facturatie.length)
      .map((a) => ({ naam: a.naam, n: standVoor(kop.data, a, jaar).gaten.length }))
      .filter((x) => x.n > 0);
    if (gaten.length) aandacht.push("Facturatiegaten: " + gaten.map((g) => `${g.n} bij ${g.naam}`).join(", "));
  }
  const wacht = aantalWachtend();
  if (wacht) aandacht.push(`${wacht} ${wacht === 1 ? "tekst wacht" : "teksten wachten"} op goedkeuring`);
  if (aandacht.length) regels.push("", "AANDACHT", ...aandacht.map((x) => "• " + x));
  regels.push("", "Alles in detail: https://sales.globaal.be");
  return regels.join("\n");
}
