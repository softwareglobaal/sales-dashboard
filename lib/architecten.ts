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
  architect?: string | null;
  ingenieur?: string | null;
  naam: string | null;
  link: string | null;
  stand: string | null;
  start: string | null;
  uitvoerder: string | null;
  kanaal: string | null;
  factuur_1: string | null;
  factuur_2: string | null;
};
export type Factuur = { dossier: string; nr: string; datum: string | null; bedrag: number | null; klant?: string | null; omschrijving?: string; pdf?: string | null };
export type WerfTreffer = { bron: string; firma: string | null; tekst: string | null; klant?: string | null; datum?: string | null; link?: string | null; status?: string };
export type Partij = { id: string; naam: string; soort: string; rollen: string[]; waarom: string[] };
export type Omvang = {
  bestanden: number | null;
  meerdere_eenheden: boolean;
  monday_bedrag: number | null;
  klasse: "klein" | "middel" | "groot" | "onbekend";
};
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
  // Hoofdopdrachtgever: de architect, anders het ingenieursbureau (onderaanneming), anders
  // wie de factuur op dit nummer kreeg. Alle partijen staan in `partijen`, met hun reden.
  bureau: string | null;
  ingenieur: string | null;
  opdrachtgever: { soort: string; soort_label: string; naam: string; zeker?: boolean } | null;
  partijen: Partij[];
  adres: string | null;
  postcode: string | null;
  map: string | null;
  link: string | null;
  bestanden: number | null;
  monday: MondayRegel | null;
  facturen: Factuur[];
  werf_bij_ons: WerfTreffer[];
  omvang: Omvang;
  schatting: number | null;
  nakijken: string[];
};
export type ProjectBron = { bron: string; firma: string; ref?: string; link?: string; datum?: string; verkocht?: number; gefactureerd?: number; omschrijving?: string };
export type OnsProject = {
  id: string;
  projectnrs: string[];
  adres: string | null;
  adressen: string[];
  firmas: string[];
  diensten: string[];
  datum: string | null;
  laatst: string | null;
  jaar: number;
  verkocht: number;
  gefactureerd: number;
  zonder_verwijzing: boolean;
  bisson: boolean;
  bronnen: ProjectBron[];
  omvang: Omvang | Record<string, never>;
  nakijken: string[];
  partijen: Partij[];
};
export type Signaal = "eerst-bij-ons" | "beide" | "eigen" | "prospect" | "enkel-bisson" | null;
export type Contact = { naam: string; email: string | null; telefoon: string | null; bron: string };
export type Architect = {
  id: string;
  naam: string;
  soort: string;
  soort_label: string;
  plaats: string | null;
  zeker: boolean;
  eigen: boolean;
  codes: string[];
  namen: string[];
  zoek: string[];
  contacten: Contact[];
  klant: boolean;
  prospect_in?: string[]; // door het dashboard ingevuld (B2B-lijst in Pipedrive)
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
  nakijken: string[];
};
export type Opdrachtgever = Architect;
export type Nakijken = { project: string; bisson: boolean; adres: string | null; redenen: string[]; monday: string | null };
export type Controle = { toets: string; ok: boolean; detail: string };
export type Overzicht = {
  ververst: string | null;
  gemaakt: string;
  bisson: {
    projecten: BissonProject[];
    per_jaar: { jaar: number; tkn_totaal: number; bisson: number; eigen: number; sta: number; dra: number; groot?: number }[];
    prijzen: Record<string, { mediaan: number; n: number }>;
    facturen_aan_bisson: Factuur[];
    facturen_aan_bisson_totaal: number;
    uitleg: string;
  };
  opdrachtgevers: Architect[];
  architecten?: Architect[];
  nakijken: Nakijken[];
  controle: Controle[];
  register?: { projecten: number; bisson: number; met_opdrachtgever: number };
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
    const data = (await r.json()) as Overzicht;
    data.opdrachtgevers = data.opdrachtgevers || data.architecten || [];
    data.nakijken = data.nakijken || [];
    data.controle = data.controle || [];
    vulProspects(data.opdrachtgevers);
    waarde = { status: "ok", data };
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

// ---------- opdrachtgevers terugvinden in Pipedrive (alle statussen) ----------
//
// Het facturatieplatform ziet enkel gewonnen deals. Hier, met alle deals van de vier
// accounts, komt erbij: staat het bureau in onze B2B-lijst (prospect), welke aanvragen of
// offertes werden níet binnengehaald, en wie zijn de contactpersonen. Een bureau wordt
// herkend aan de organisatienaam, of aan een contact dat met "B2B" begint -- nooit aan
// een particulier die toevallig zo heet.

type DealRij = {
  account_key: string;
  id: number;
  title: string | null;
  status: string;
  pipeline_name: string | null;
  stage_name: string | null;
  add_time: string | null;
  lost_time: string | null;
  won_time: string | null;
  lost_reason: string | null;
  persoon: string | null;
  org: string | null;
  email: string | null;
  telefoon: string | null;
};
let dealCache: { t: number; rijen: DealRij[]; orgs: { account_key: string; naam: string }[] } | null = null;

function deals() {
  if (dealCache && Date.now() - dealCache.t < TIEN_MIN) return dealCache;
  const db = getDb();
  const rijen = db
    .prepare(
      `SELECT account_key, id, title, status, pipeline_name, stage_name, add_time, lost_time, won_time, lost_reason,
              json_extract(raw, '$.person_name') AS persoon, json_extract(raw, '$.org_name') AS org,
              json_extract(raw, '$.person_id.email[0].value') AS email,
              json_extract(raw, '$.person_id.phone[0].value') AS telefoon
         FROM deals`,
    )
    .all() as DealRij[];
  const orgs = db.prepare(`SELECT account_key, name AS naam FROM organizations WHERE name IS NOT NULL`).all() as {
    account_key: string;
    naam: string;
  }[];
  dealCache = { t: Date.now(), rijen, orgs };
  return dealCache;
}

function regexen(a: Architect): RegExp[] {
  return (a.zoek || []).flatMap((z) => {
    try {
      return [new RegExp(z, "i")];
    } catch {
      return [];
    }
  });
}

function past(rx: RegExp[], persoon: string | null, org: string | null): boolean {
  if (!rx.length) return false;
  const o = slug(org || "");
  if (o && rx.some((r) => r.test(o))) return true;
  const p = persoon || "";
  return /^\s*b2b\b/i.test(p) && rx.some((r) => r.test(slug(p)));
}

const ACCOUNTNAAM = (k: string) => ACCOUNTS.find((a) => a.key === k)?.name || k;

/** Staat het bureau in onze B2B-lijst? Dan wordt "enkel via Bisson" -> "in onze B2B-lijst". */
function vulProspects(lijst: Architect[]) {
  let d: ReturnType<typeof deals>;
  try {
    d = deals();
  } catch {
    return; // geen database (bv. tijdens de build): dan blijft het signaal ongewijzigd
  }
  for (const a of lijst) {
    const rx = regexen(a);
    const acc = new Set<string>();
    for (const o of d.orgs) if (rx.some((r) => r.test(slug(o.naam)))) acc.add(ACCOUNTNAAM(o.account_key));
    for (const r of d.rijen) if (past(rx, r.persoon, r.org)) acc.add(ACCOUNTNAAM(r.account_key));
    a.prospect_in = [...acc].sort();
    if (a.signaal === "enkel-bisson" && a.prospect_in.length) a.signaal = "prospect";
  }
}

export type NietBinnen = {
  firma: string;
  status: "open" | "verloren";
  soort: "prospectie" | "aanvraag";
  titel: string | null;
  pipeline: string | null;
  fase: string | null;
  datum: string | null;
  reden: string | null;
  contact: string | null;
  link: string;
};

/** Deals van dit bureau die (nog) niet gewonnen zijn: prospectie of een echte aanvraag. */
export function nietBinnengehaald(a: Architect): NietBinnen[] {
  const rx = regexen(a);
  if (!rx.length) return [];
  return deals()
    .rijen.filter((r) => r.status !== "won" && past(rx, r.persoon, r.org))
    .map((r) => {
      const acc = ACCOUNTS.find((x) => x.key === r.account_key);
      const prospectie = /b2b|prospect|campag/i.test(r.pipeline_name || "");
      return {
        firma: acc?.name || r.account_key,
        status: r.status === "lost" ? ("verloren" as const) : ("open" as const),
        soort: prospectie ? ("prospectie" as const) : ("aanvraag" as const),
        titel: r.title,
        pipeline: r.pipeline_name,
        fase: r.stage_name,
        datum: (r.status === "lost" ? r.lost_time : r.add_time)?.slice(0, 10) || null,
        reden: r.lost_reason,
        contact: r.persoon,
        link: acc ? `https://${acc.domain}.pipedrive.com/deal/${r.id}` : "",
      };
    })
    .sort((x, y) => (y.datum || "").localeCompare(x.datum || ""));
}

/** "B2B ARC Maarten Vermersch Maarten" -> "Maarten Vermersch" (zelfde regel als het facturatieplatform). */
function schoneNaam(n: string): string {
  let t = n.trim();
  for (;;) {
    const v = t.replace(/^(b2b|kl|pa|pp|arc|int|ing|lm|epb|aan|eng|dw|h-?a|ha|b2c|m)\b[\s\-_.]*/i, "");
    if (v === t) break;
    t = v;
  }
  const d = t.split(/\s+/);
  if (d.length >= 2 && d[d.length - 1].toLowerCase() === d[0].toLowerCase()) d.pop();
  return d.join(" ").trim();
}

/** Contactpersonen: uit het register (gewonnen deals) en uit alle andere deals van het bureau. */
export function contactenVan(a: Architect): Contact[] {
  const uit = new Map<string, Contact>();
  for (const c of a.contacten || []) uit.set(slug(c.naam), c);
  const rx = regexen(a);
  if (rx.length) {
    for (const r of deals().rijen) {
      if (!past(rx, r.persoon, r.org) || !(r.email || r.telefoon)) continue;
      const naam = schoneNaam(r.persoon || r.org || "");
      const k = slug(naam);
      if (!uit.has(k)) uit.set(k, { naam, email: r.email, telefoon: r.telefoon, bron: `Pipedrive ${ACCOUNTNAAM(r.account_key)}` });
    }
  }
  return [...uit.values()].slice(0, 6);
}
