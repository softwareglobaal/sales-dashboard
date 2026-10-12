// Studiebureau Bisson en het architecten-klantenbestand (spec §18).
//
// Het facturatieplatform kent alle vijf de bronnen (Pipedrive, Octopus, Monday en de
// Dropbox-mappen) en stelt het overzicht 's nachts samen (architecten.py daar). Dit
// leest het, net als lib/facturatie.ts, van container tot container met het gedeelde
// geheim. Alleen lezen. Wat dit dashboard er zelf aan toevoegt: of een Bisson-werf ook
// als deal in onze eigen Pipedrive staat, in elke status (ook verloren offertes).

import { getDb } from "./db";
import { ACCOUNTS } from "./accounts";

export type MondayRegel = {
  naam: string | null;
  link: string | null;
  stand: string | null;
  start: string | null;
  uitvoerder: string | null;
  kanaal: string | null;
  factuur_1: string | null;
  factuur_2: string | null;
};
export type Factuur = { dossier: string; nr: string; datum: string | null; bedrag: number | null; klant?: string | null; omschrijving?: string };
export type WerfTreffer = { bron: string; firma: string | null; tekst: string | null; klant?: string | null; datum?: string | null; link?: string | null; status?: string };
export type BissonProject = {
  nr: string;
  jaar: number;
  datum: string;
  dienst: string | null;
  dienst_naam: string | null;
  soort: string | null;
  soort_naam: string | null;
  pakket: string | null;
  architect_code: string | null;
  bureau: string | null;
  adres: string | null;
  postcode: string | null;
  map: string | null;
  link: string | null;
  bestanden: number | null;
  monday: MondayRegel | null;
  facturen: Factuur[];
  werf_bij_ons: WerfTreffer[];
};
export type ProjectBron = { bron: string; firma: string; ref?: string; link?: string; datum?: string; verkocht?: number; gefactureerd?: number; omschrijving?: string };
export type OnsProject = {
  projectnrs: string[];
  adres: string | null;
  adressen: string[];
  firmas: string[];
  diensten: string[];
  datum: string | null;
  laatst: string | null;
  verkocht: number;
  gefactureerd: number;
  contact: string | null;
  zonder_verwijzing: boolean;
  bisson_nummer: boolean;
  bronnen: ProjectBron[];
};
export type Signaal = "eerst-bij-ons" | "beide" | "eigen" | "prospect" | "enkel-bisson" | null;
export type Architect = {
  id: string;
  naam: string;
  plaats: string | null;
  zeker: boolean;
  eigen: boolean;
  codes: string[];
  namen: string[];
  klant: boolean;
  prospect_in: string[];
  firmas: string[];
  diensten: string[];
  projecten: OnsProject[];
  aantal_projecten: number;
  aantal_facturen: number;
  verkocht: number;
  gefactureerd: number;
  eerste_bij_ons: string | null;
  laatste_bij_ons: string | null;
  bisson: string[];
  aantal_bisson: number;
  eerste_bisson: string | null;
  laatste_bisson: string | null;
  bij_ons_na_eerste_bisson: number | null;
  signaal: Signaal;
};
export type Overzicht = {
  ververst: string | null;
  gemaakt: string;
  bisson: {
    projecten: BissonProject[];
    per_jaar: { jaar: number; tkn_totaal: number; bisson: number; eigen: number; sta: number; dra: number }[];
    prijzen: Record<string, { mediaan: number; n: number }>;
    facturen_aan_bisson: Factuur[];
    facturen_aan_bisson_totaal: number;
    uitleg: string;
  };
  architecten: Architect[];
};
export type Stand = { status: "ok"; data: Overzicht } | { status: "niet-ingesteld" } | { status: "fout"; melding: string };

let cache: { t: number; waarde: Stand } | null = null;
const TIEN_MIN = 10 * 60 * 1000;

export async function architectenOverzicht(): Promise<Stand> {
  const url = process.env.FACTURATIE_URL || "";
  const token = process.env.KOPPELING_TOKEN || "";
  if (!url || !token) return { status: "niet-ingesteld" };
  if (cache && Date.now() - cache.t < TIEN_MIN) return cache.waarde;
  let waarde: Stand;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/koppeling/architecten`, {
      headers: { "X-Koppeling-Token": token },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`facturatieplatform gaf ${r.status}`);
    waarde = { status: "ok", data: (await r.json()) as Overzicht };
  } catch (e: any) {
    waarde = { status: "fout", melding: String(e?.message || e) };
  }
  cache = { t: Date.now(), waarde };
  return waarde;
}

// ---------- adressen: zelfde sleutel als het facturatieplatform (lib_norm.adres_key) ----------

const STRAAT = /(straat|str|laan|lei|dreef|steenweg|baan|weg|plein|pad|kaai|markt|dijk|wal|vest|park|hof|berg|veld|es|dam|poort|singel|ring|gracht)$/;

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Kleine Geeststraat 44, 1933 Sterrebeek" -> { sleutel: "geeststraat|44", postcode: "1933" } */
export function adresSleutel(tekst: string | null | undefined): { sleutel: string; postcode: string | null } | null {
  if (!tekst) return null;
  const t = tekst.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const pcs = [...t.matchAll(/\b(?:B-\s?)?([1-9]\d{3})\b/g)].map((m) => m[1]);
  const postcode = pcs.length ? pcs[pcs.length - 1] : null;
  let beste: [string, string] | null = null;
  for (const m of t.matchAll(/([A-Za-z][A-Za-z.'\- ]{2,45}?)\s+(\d{1,4})\s*[A-Za-z]?\b/g)) {
    const s = slug(m[1]);
    if (!s || s.length < 3 || /^\d+$/.test(s.split(" ").pop() || "")) continue;
    beste = [s, m[2]];
    if (STRAAT.test(s)) break;
  }
  if (!beste || beste[1] === postcode) return null;
  if (!STRAAT.test(beste[0]) && !postcode) return null;
  return { sleutel: `${beste[0].split(" ").pop()}|${beste[1]}`, postcode };
}

function gemeente(adres: string): string | null {
  const m = adres.normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/\d+\s*[A-Za-z]?\b[\s,]*(?:[1-9]\d{3}\s+)?([A-Za-z][A-Za-z\- ']{2,})$/);
  return m ? slug(m[1]).split(" ").pop() || null : null;
}

/**
 * Bisson-werven die ook als deal in onze Pipedrive staan, in elke status. Een verloren
 * offerte op hetzelfde adres als een Bisson-project is het scherpste signaal: wij
 * offreerden, het werk ging via Bisson.
 */
export function dealsOpBissonWerven(projecten: BissonProject[]): Record<string, WerfTreffer[]> {
  const db = getDb();
  const rijen = db
    .prepare(
      `SELECT account_key, id, title, status, add_time, won_time, lost_time,
              COALESCE(json_extract(raw, '$.org_name'), json_extract(raw, '$.person_name')) AS klant
         FROM deals`,
    )
    .all() as { account_key: string; id: number; title: string | null; status: string; add_time: string | null; won_time: string | null; lost_time: string | null; klant: string | null }[];
  const index = new Map<string, typeof rijen>();
  for (const r of rijen) {
    const a = adresSleutel(r.title);
    if (!a) continue;
    const lijst = index.get(a.sleutel) || [];
    lijst.push(r);
    index.set(a.sleutel, lijst);
  }
  const uit: Record<string, WerfTreffer[]> = {};
  for (const p of projecten) {
    const a = adresSleutel(p.adres);
    if (!a) continue;
    const gem = p.adres ? gemeente(p.adres) : null;
    const treffers = (index.get(a.sleutel) || []).filter((r) => {
      const b = adresSleutel(r.title);
      if (a.postcode && b?.postcode) return a.postcode === b.postcode;
      // Geen postcode in de mapnaam: dan moet de gemeente in de dealtitel staan.
      return !!gem && slug(r.title || "").includes(gem);
    });
    if (!treffers.length) continue;
    uit[p.nr] = treffers.map((r) => {
      const acc = ACCOUNTS.find((x) => x.key === r.account_key);
      return {
        bron: "Pipedrive",
        firma: acc?.name || r.account_key,
        tekst: r.title,
        klant: r.klant,
        datum: (r.status === "won" ? r.won_time : r.status === "lost" ? r.lost_time : r.add_time)?.slice(0, 10) || null,
        status: r.status === "won" ? "gewonnen" : r.status === "lost" ? "verloren" : "open",
        link: acc ? `https://${acc.domain}.pipedrive.com/deal/${r.id}` : null,
      };
    });
  }
  return uit;
}

export const SIGNAAL: Record<Exclude<Signaal, null>, { label: string; klasse: string; uitleg: string }> = {
  "eerst-bij-ons": { label: "Eerst bij ons, nu via Bisson", klasse: "kritiek", uitleg: "Klant bij een van onze firma's vóór het eerste Bisson-project." },
  eigen: { label: "Eigen firma via Bisson", klasse: "kritiek", uitleg: "Een project van onze eigen groep liep via Bisson." },
  beide: { label: "Klant bij ons én via Bisson", klasse: "let", uitleg: "Werkt met ons en met Bisson; Bisson was er eerst of tegelijk." },
  prospect: { label: "In onze B2B-lijst", klasse: "accent", uitleg: "Staat als prospect in onze Pipedrive, maar zonder gewonnen project bij ons." },
  "enkel-bisson": { label: "Enkel via Bisson", klasse: "", uitleg: "Niet gevonden in onze klanten of B2B-lijst." },
};

export function maandJaar(d: string | null | undefined): string {
  if (!d) return "—";
  const [j, m] = d.split("-");
  // Een Bisson-project zonder Monday-startdatum heeft enkel het jaar uit het nummer.
  if (!m || d.endsWith("-01-01")) return j;
  return `${m}/${j}`;
}
