// Koppeling met het facturatiecontroleplatform (spec §17): verkocht tegenover gefactureerd.
//
// Het dashboard weet wat er verkocht is (Pipedrive, Monday); het facturatieplatform
// weet wat er gefactureerd is (Octopus). Dit leest diens samenvatting per afdeling,
// rechtstreeks van container tot container op het interne netwerk, met een gedeeld
// geheim. Alleen lezen, in beide richtingen. Zonder instelling toont de pagina
// "koppeling niet ingesteld" en werkt de rest gewoon.

import type { Afdeling } from "./afdelingen";

export type FactuurJaar = {
  verkocht: number;
  gefactureerd: number;
  nog_te_factureren: number;
  dossiers: number;
  statussen: Record<string, number>;
};
export type Gat = {
  afdeling: string;
  jaar: string;
  soort: string;
  firma: string | null;
  werf: string | null;
  klant: string | null;
  gewonnen_op: string | null;
  verkocht: number;
  gefactureerd: number;
  verschil: number;
  projectnr: string | null;
  dagen_sinds_verkoop: number | null;
  // Sinds oktober 2026 (facturatiecontrole koppeling-kanaal); oudere antwoorden missen ze.
  verkocht_via?: string | null; // Pipedrive-account van de deal (UNABO, TKN-Buro, ...)
  kanaal?: string | null;
  gefactureerd_door?: string[];
  deal_titel?: string | null;
};
export type Samenvatting = {
  ververst: string | null;
  jaren: string[];
  afdelingen: Record<string, Record<string, FactuurJaar>>;
  gaten: Gat[];
};
export type Koppeling =
  | { status: "ok"; data: Samenvatting }
  | { status: "niet-ingesteld" }
  | { status: "fout"; melding: string };

// Een verkoop is pas een gat als hij na deze wachttijd nog niet gefactureerd is:
// facturatie loopt normaal wat achter (deelfacturen, contract nog niet getekend).
export const WACHTTIJD_DAGEN = 30;

export const FACTURATIE_WEB = "https://facturatiecontrole.globaal.be";

let cache: { t: number; waarde: Koppeling } | null = null;
const TIEN_MIN = 10 * 60 * 1000;

export async function koppeling(): Promise<Koppeling> {
  const url = process.env.FACTURATIE_URL || "";
  const token = process.env.KOPPELING_TOKEN || "";
  if (!url || !token) return { status: "niet-ingesteld" };
  if (cache && Date.now() - cache.t < TIEN_MIN) return cache.waarde;
  let waarde: Koppeling;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/koppeling/sales`, {
      headers: { "X-Koppeling-Token": token },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`facturatieplatform gaf ${r.status}`);
    waarde = { status: "ok", data: (await r.json()) as Samenvatting };
  } catch (e: any) {
    waarde = { status: "fout", melding: String(e?.message || e) };
  }
  cache = { t: Date.now(), waarde };
  return waarde;
}

// Het facturatieplatform noemt sommige afdelingen anders ("Veiligheidscoörd.").
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, "").toLowerCase();

function hoort(a: Afdeling, naam: string): boolean {
  const n = norm(naam);
  return a.facturatie.some((f) => norm(f) === n);
}

export type FactuurStand = {
  verkocht: number;
  gefactureerd: number;
  nogTeFactureren: number;
  dossiers: number;
  gaten: Gat[];
};

/** Stand voor één dienst in één jaar, met de gaten die gemeld moeten worden. */
export function standVoor(k: Samenvatting, a: Afdeling, jaar: string): FactuurStand {
  const uit: FactuurStand = { verkocht: 0, gefactureerd: 0, nogTeFactureren: 0, dossiers: 0, gaten: [] };
  for (const [naam, perJaar] of Object.entries(k.afdelingen)) {
    if (!hoort(a, naam)) continue;
    const j = perJaar[jaar];
    if (!j) continue;
    uit.verkocht += j.verkocht;
    uit.gefactureerd += j.gefactureerd;
    uit.nogTeFactureren += j.nog_te_factureren;
    uit.dossiers += j.dossiers;
  }
  uit.gaten = k.gaten.filter(
    (g) =>
      g.jaar === jaar &&
      hoort(a, g.afdeling) &&
      !(g.soort.startsWith("Verkocht, niet") && (g.dagen_sinds_verkoop ?? 999) < WACHTTIJD_DAGEN)
  );
  return uit;
}
