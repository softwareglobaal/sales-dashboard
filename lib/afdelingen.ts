// Diensten (afdelingen) van het dashboard: config + datalaag + kerncijfers (spec §17).
//
// Eén generieke laag voor elke dienst. Vroeger had elke tab een eigen querybestand
// (queries.ts voor Engineering, energyQueries.ts voor Energy) en kostte een nieuwe
// dienst een kopie van 800 regels. Nu staat per dienst in config/afdelingen.json
// waar de verkoop zit (de "bronnen"); deze module haalt per bron de leads en de
// omzetregels op en rekent daarop. Een nieuwe dienst is dus een blok config.
//
// Datumregels blijven die van DASHBOARD-SPEC §3: aanvragen op add_time, gewonnen op
// won_time, verloren op lost_time. Omzet volgt §6: productregels waar een firma
// bundelt (UNABO, TKN), anders de deal value.

import cfg from "@/config/afdelingen.json";
import commissie from "@/config/commissie.json";
import { getDb } from "./db";
import { ACCOUNTS } from "./accounts";
import { HIDDEN_PIPELINES } from "./hiddenPipelines";
import { channelsInfoForLabels, isOfferteStage } from "./engineeringConfig";
import { normalizeLossReason } from "./lossReasons";
import { MONTH_NAMES, UNABO_ADDR_HASH } from "./queries";

// ---------- config ----------

export type Firma = { sleutel: string; naam: string; account: string };
type ProductRegel = { afdelingen?: string[]; namen?: string[] };
type Uitsluiten = { producten?: ProductRegel; titels?: string[]; labels?: string[] };
export type PipedriveBron = {
  sleutel: string;
  firma: string;
  soort: "pipedrive";
  label: string;
  alleDeals?: boolean;
  producten?: ProductRegel;
  pipelines?: string[];
  titels?: string[];
  labels?: string[];
  uitsluiten?: Uitsluiten;
  omzet: "product" | "dealwaarde";
  // Koude prospectie (bv. de EE-campagne bij EPB-verslaggevers): die deals zijn geen
  // aanvragen. Ze tellen niet mee in aanvragen, open, verloren of winratio; een
  // gewonnen klant telt wel als verkoop. Fases met deze woorden = "in gesprek".
  campagne?: boolean;
  inGesprekFases?: string[];
};
export type MondayBron = {
  sleutel: string;
  firma: string;
  soort: "monday";
  label: string;
  bord: string;
  uitsluitenKlantOa?: string[];
  uitsluitenNamen?: string[]; // LIKE-patronen op de kaartnaam (testkaarten)
  soortNamen?: Record<string, string>; // Project Type -> leesbare naam
};
export type Bron = PipedriveBron | MondayBron;
export type WebsiteKanaal = { site: string; paden?: string[] };
export type Afdeling = {
  pad: string;
  naam: string;
  icoon: string;
  registerAfdeling: string;
  wie: { verkoop: string; uitvoering: string; factuur: string };
  verbergPipelines?: string[];
  bronnen: Bron[];
  kanalen: { websites: WebsiteKanaal[]; ads: string[] };
  concurrentie?: string;
  extra?: { href: string; label: string }[];
  facturatie: string[];
  facturatieNoot?: string;
  facturatieTab?: string; // tabblad in facturatiecontrole (#...), voor de doorklik
  doel: { bron?: string; maand?: number };
};

export const FIRMAS: Firma[] = cfg.firmas;
export const AFDELINGEN: Afdeling[] = cfg.afdelingen as unknown as Afdeling[];

export function afdeling(pad: string): Afdeling | undefined {
  return AFDELINGEN.find((a) => a.pad === pad);
}

export function firma(sleutel: string): Firma | undefined {
  return FIRMAS.find((f) => f.sleutel === sleutel);
}

/** De firma's die in een dienst verkopen, in de volgorde van de bronnen. */
export function firmasVan(a: Afdeling): Firma[] {
  const uit: Firma[] = [];
  for (const b of a.bronnen) {
    const f = firma(b.firma);
    if (f && !uit.some((x) => x.sleutel === f.sleutel)) uit.push(f);
  }
  return uit;
}

/** Maanddoel in euro gewonnen omzet; 0 = geen doel ingesteld. */
export function maanddoel(a: Afdeling): number {
  if (a.doel.bron?.startsWith("commissie.")) {
    const k = a.doel.bron.slice("commissie.".length) as "engineering" | "energy";
    return (commissie as any)[k]?.doel || 0;
  }
  return a.doel.maand || 0;
}

// ---------- datalaag ----------

export type Status = "open" | "won" | "lost";
export type Lead = {
  uid: string; // uniek over alle diensten heen (account:id of monday:id), voor totalen zonder dubbeltelling
  bron: string;
  bronLabel: string;
  firma: string;
  id: string;
  titel: string;
  klant: string;
  status: Status;
  add: string;
  won: string | null;
  lost: string | null;
  pipeline: string | null;
  stage: string | null;
  stageOrder: number | null;
  labels: string | null;
  lostReason: string | null;
  waarde: number;
  url: string;
  offerte: boolean; // offerte verstuurd (indicatief, spec §2)
  offerteOp: string | null; // eerste moment in een offertefase (deal-flow; enkel UNABO/TKN)
  productwaarde: number; // productregels van deze dienst op de deal, ongeacht de status (of de deal value)
  producten: string[];
  campagne: boolean; // koude prospectie, geen aanvraag (zie PipedriveBron.campagne)
  inGesprek: boolean; // campagne-deal in een fase met reactie/offerte/afspraak
  personId: number | null;
  postcode: string | null;
  stageChange: string | null;
  custom: Record<string, any>;
  kanaal?: { main: string; sub: string | null }; // vaste bron zonder labels (Monday)
};
export type OmzetRegel = { bron: string; firma: string; dealId: string; won: string; bedrag: number; dienst: string };
export type Dataset = { leads: Lead[]; omzet: OmzetRegel[] };

const accountVan = (f: string) => firma(f)?.account || "";
const domeinVan = (acc: string) => ACCOUNTS.find((a) => a.key === acc)?.domain || "";

/** Named-parameters met een teller, zodat meerdere stukken SQL niet botsen. */
class Params {
  private n = 0;
  readonly named: Record<string, unknown> = {};
  p(v: unknown): string {
    const k = `p${this.n++}`;
    this.named[k] = v;
    return "@" + k;
  }
  lijst(vs: unknown[]): string {
    return vs.map((v) => this.p(v)).join(", ");
  }
}

const zonderSpaties = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function productMatch(r: ProductRegel | undefined, ps: Params, alias = "p"): string | null {
  if (!r) return null;
  const delen: string[] = [];
  if (r.afdelingen?.length) delen.push(`${alias}.department IN (${ps.lijst(r.afdelingen)})`);
  for (const n of r.namen || []) delen.push(`lower(COALESCE(${alias}.name, '')) LIKE ${ps.p(n.toLowerCase())}`);
  return delen.length ? `(${delen.join(" OR ")})` : null;
}

function likeAny(kolom: string, patronen: string[] | undefined, ps: Params): string | null {
  if (!patronen?.length) return null;
  return "(" + patronen.map((t) => `lower(COALESCE(${kolom}, '')) LIKE ${ps.p(t.toLowerCase())}`).join(" OR ") + ")";
}

/** Verborgen pipelines voor een dienst: die van elk betrokken account + de eigen lijst. */
function verborgen(a: Afdeling): string[] {
  const s = new Set<string>(a.verbergPipelines || []);
  for (const b of a.bronnen) {
    if (b.soort !== "pipedrive") continue;
    for (const n of HIDDEN_PIPELINES[accountVan(b.firma)] || []) s.add(n);
  }
  return [...s];
}

/** WHERE-stuk (alias d) voor de deals van één Pipedrive-bron. */
function bronWhere(a: Afdeling, b: PipedriveBron, ps: Params, metMatch: boolean): string {
  const acc = accountVan(b.firma);
  const delen = [`d.account_key = ${ps.p(acc)}`];
  const verb = verborgen(a);
  if (verb.length) delen.push(`(d.pipeline_name IS NULL OR d.pipeline_name NOT IN (${ps.lijst(verb)}))`);
  if (metMatch && !b.alleDeals) {
    const of: string[] = [];
    const pm = productMatch(b.producten, ps);
    if (pm) of.push(`d.id IN (SELECT p.deal_id FROM deal_products p WHERE p.account_key = d.account_key AND ${pm})`);
    if (b.pipelines?.length) of.push(`REPLACE(lower(COALESCE(d.pipeline_name, '')), ' ', '') IN (${ps.lijst(b.pipelines.map(zonderSpaties))})`);
    const t = likeAny("d.title", b.titels, ps);
    if (t) of.push(t);
    const l = likeAny("d.label_names", b.labels, ps);
    if (l) of.push(l);
    delen.push(of.length ? `(${of.join(" OR ")})` : "0");
  }
  if (b.uitsluiten) {
    const of: string[] = [];
    const pm = productMatch(b.uitsluiten.producten, ps);
    if (pm) of.push(`d.id IN (SELECT p.deal_id FROM deal_products p WHERE p.account_key = d.account_key AND ${pm})`);
    const t = likeAny("d.title", b.uitsluiten.titels, ps);
    if (t) of.push(t);
    const l = likeAny("d.label_names", b.uitsluiten.labels, ps);
    if (l) of.push(l);
    if (of.length) delen.push(`NOT (${of.join(" OR ")})`);
  }
  return delen.join(" AND ");
}

/** Laagste fase-volgorde van een offertefase per pipeline, per account. */
function offerteDrempels(acc: string): Map<string, number> {
  const uit = new Map<string, number>();
  const rijen = getDb()
    .prepare("SELECT DISTINCT pipeline_name, stage_name, stage_order FROM deals WHERE account_key = ? AND stage_name IS NOT NULL")
    .all(acc) as any[];
  for (const s of rijen) {
    if (isOfferteStage(s.stage_name) && s.stage_order != null) {
      const cur = uit.get(s.pipeline_name);
      if (cur == null || s.stage_order < cur) uit.set(s.pipeline_name, s.stage_order);
    }
  }
  return uit;
}

const productNaam = (n: string | null) => (n || "(geen productnaam)").replace(/^[A-Z0-9 -]+:\s*/, "").trim() || n || "(geen productnaam)";

function pipedriveData(a: Afdeling, b: PipedriveBron): Dataset {
  const db = getDb();
  const acc = accountVan(b.firma);
  const domein = domeinVan(acc);
  const drempels = offerteDrempels(acc);
  const ps = new Params();
  const where = bronWhere(a, b, ps, true);
  const rijen = db
    .prepare(
      `SELECT d.id, d.title, d.status, d.add_time, d.won_time, d.lost_time, d.pipeline_name, d.stage_name,
              d.stage_order, d.label_names, d.lost_reason, d.value, d.custom_json,
              COALESCE(json_extract(d.raw, '$.org_name'), json_extract(d.raw, '$.person_name')) AS klant,
              json_extract(d.raw, '$.person_id.value') AS person_id,
              json_extract(d.raw, '$.stage_change_time') AS stage_change,
              json_extract(d.raw, '$.${UNABO_ADDR_HASH}_postal_code') AS postcode,
              f.offerte_time
       FROM deals d LEFT JOIN deal_flow f ON f.account_key = d.account_key AND f.deal_id = d.id
       WHERE ${where}`
    )
    .all(ps.named) as any[];

  const fases = (b.inGesprekFases || []).map((x) => x.toLowerCase());
  const leads: Lead[] = rijen.map((r) => {
    const drempel = drempels.get(r.pipeline_name);
    let custom: Record<string, any> = {};
    try {
      custom = r.custom_json ? JSON.parse(r.custom_json) : {};
    } catch {}
    return {
      uid: `${acc}:${r.id}`,
      bron: b.sleutel,
      bronLabel: b.label,
      firma: b.firma,
      id: String(r.id),
      titel: r.title || "(zonder titel)",
      klant: r.klant || "(onbekend)",
      status: (r.status as Status) || "open",
      add: r.add_time || "",
      won: r.won_time,
      lost: r.lost_time,
      pipeline: r.pipeline_name,
      stage: r.stage_name,
      stageOrder: r.stage_order,
      labels: r.label_names,
      lostReason: r.lost_reason,
      waarde: r.value || 0,
      url: domein ? `https://${domein}.pipedrive.com/deal/${r.id}` : "",
      offerte:
        r.status === "won" ||
        isOfferteStage(r.stage_name) ||
        (drempel != null && r.stage_order != null && r.stage_order >= drempel),
      offerteOp: r.offerte_time || null,
      productwaarde: Math.round(r.value || 0),
      producten: [],
      campagne: !!b.campagne,
      inGesprek: !!b.campagne && r.status === "open" && fases.some((f) => String(r.stage_name || "").toLowerCase().includes(f)),
      personId: r.person_id ?? null,
      postcode: r.postcode ?? null,
      stageChange: r.stage_change ?? null,
      custom,
    };
  });

  // Productwaarde per deal, ook voor open en verloren deals (deallijst): enkel de regels
  // van deze dienst, dezelfde afbakening als de omzet hieronder.
  if (b.omzet === "product") {
    const ps3 = new Params();
    const w3 = bronWhere(a, b, ps3, false);
    const pm3 = b.alleDeals ? null : productMatch(b.producten, ps3);
    const per = new Map<string, { som: number; namen: Set<string> }>();
    for (const r of db
      .prepare(`SELECT d.id, p.line_sum, p.name FROM deal_products p JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id WHERE ${w3} ${pm3 ? "AND " + pm3 : ""}`)
      .all(ps3.named) as any[]) {
      const e = per.get(String(r.id)) || { som: 0, namen: new Set<string>() };
      e.som += r.line_sum || 0;
      e.namen.add(productNaam(r.name));
      per.set(String(r.id), e);
    }
    for (const l of leads) {
      const e = per.get(l.id);
      l.productwaarde = Math.round(e?.som || 0);
      l.producten = e ? [...e.namen] : [];
    }
  }

  let omzet: OmzetRegel[];
  if (b.omzet === "product") {
    // Productregels: enkel de regels van deze dienst, ook binnen een bundel.
    // Dezelfde afbakening als de oude Engineering/Energy-tab (spec §6, §6b).
    const ps2 = new Params();
    const w = bronWhere(a, b, ps2, false);
    const pm = b.alleDeals ? null : productMatch(b.producten, ps2);
    const regels = db
      .prepare(
        `SELECT d.id, d.won_time, p.line_sum, p.name FROM deal_products p
         JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id
         WHERE d.status = 'won' AND ${w} ${pm ? "AND " + pm : ""}`
      )
      .all(ps2.named) as any[];
    omzet = regels.map((r) => ({
      bron: b.sleutel,
      firma: b.firma,
      dealId: String(r.id),
      won: r.won_time || "",
      bedrag: r.line_sum || 0,
      dienst: productNaam(r.name),
    }));
  } else {
    omzet = leads
      .filter((l) => l.status === "won" && l.won)
      .map((l) => ({ bron: b.sleutel, firma: b.firma, dealId: l.id, won: l.won!, bedrag: l.waarde, dienst: b.label }));
  }
  return { leads, omzet };
}

const MONDAY_ACCOUNT = "admin126016";

function mondayData(b: MondayBron): Dataset {
  const rijen = getDb().prepare("SELECT * FROM monday_projecten WHERE bord = ?").all(b.bord) as any[];
  const uitsluiten = (b.uitsluitenKlantOa || []).map((s) => s.toLowerCase());
  const naamWeg = (b.uitsluitenNamen || []).map((p) => new RegExp("^" + p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$"));
  const soortNaam = (s: string | null) => (s && b.soortNamen?.[s]) || s || b.label;
  const leads: Lead[] = [];
  const omzet: OmzetRegel[] = [];
  for (const r of rijen) {
    const oa = String(r.klant_oa || "");
    // "Unabo" als klant = door UNABO verkocht: die telt al in UNABO's Pipedrive.
    if (uitsluiten.some((u) => oa.toLowerCase().includes(u))) continue;
    if (naamWeg.some((re) => re.test(String(r.naam || "").toLowerCase()))) continue;
    const datum = r.goedgekeurd || r.aangemaakt || "";
    if (!datum) continue;
    const geannuleerd = /geannuleerd/i.test(r.groep || "");
    const lead: Lead = {
      uid: `monday:${r.id}`,
      bron: b.sleutel,
      bronLabel: b.label,
      firma: b.firma,
      id: String(r.id),
      titel: r.naam || "(zonder naam)",
      klant: oa || "(onbekend)",
      status: geannuleerd ? "lost" : "won",
      add: datum,
      won: geannuleerd ? null : datum,
      lost: geannuleerd ? datum : null,
      pipeline: null,
      stage: r.groep,
      stageOrder: null,
      labels: null,
      lostReason: geannuleerd ? "Geannuleerd" : null,
      waarde: r.bedrag || 0,
      url: `https://${MONDAY_ACCOUNT}.monday.com/boards/${b.bord}/pulses/${r.id}`,
      offerte: true,
      offerteOp: null,
      productwaarde: Math.round(r.bedrag || 0),
      producten: [soortNaam(r.soort)],
      campagne: false,
      inGesprek: false,
      personId: null,
      postcode: null,
      stageChange: null,
      custom: { soort: soortNaam(r.soort) },
      kanaal: { main: "Rechtstreeks (onderaanneming)", sub: oa || "Klant onbekend" },
    };
    leads.push(lead);
    if (!geannuleerd) {
      omzet.push({ bron: b.sleutel, firma: b.firma, dealId: lead.id, won: datum, bedrag: r.bedrag || 0, dienst: soortNaam(r.soort) });
    }
  }
  return { leads, omzet };
}

// Geheugen per dienst, ververst zodra er een nieuwe sync is geweest.
const cache = new Map<string, { stempel: string; data: Dataset }>();
function syncStempel(): string {
  const r = getDb().prepare("SELECT MAX(last_sync) AS t, COUNT(*) AS n FROM sync_meta").get() as any;
  return `${r?.t || ""}|${r?.n || 0}`;
}

export function dataset(a: Afdeling): Dataset {
  const stempel = syncStempel();
  const c = cache.get(a.pad);
  if (c && c.stempel === stempel) return c.data;
  const leads: Lead[] = [];
  const omzet: OmzetRegel[] = [];
  for (const b of a.bronnen) {
    const d = b.soort === "monday" ? mondayData(b) : pipedriveData(a, b);
    leads.push(...d.leads);
    omzet.push(...d.omzet);
  }
  const data = { leads, omzet };
  cache.set(a.pad, { stempel, data });
  return data;
}

export function filterFirma(d: Dataset, f?: string | null): Dataset {
  if (!f) return d;
  return { leads: d.leads.filter((l) => l.firma === f), omzet: d.omzet.filter((o) => o.firma === f) };
}

// ---------- periodes: enkel dit jaar en vorig jaar ----------

export type Periode = string; // "ytd" | "prev_year" | "JJJJ-MM"
export type Bereik = { van: string; tot: string; label: string; vergelijk: { van: string; tot: string; label: string } | null };

const pad2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function isDienstPeriode(p: string | undefined): p is Periode {
  if (!p) return false;
  if (p === "ytd" || p === "prev_year") return true;
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (!m) return false;
  const y = new Date().getFullYear();
  return (+m[1] === y || +m[1] === y - 1) && +m[2] >= 1 && +m[2] <= 12;
}

/** Periode -> bereik plus de vergelijkbare periode een jaar eerder (groei). */
export function bereik(p: Periode, nu = new Date()): Bereik {
  const y = nu.getFullYear();
  const morgen = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1);
  if (p === "prev_year") {
    return { van: `${y - 1}-01-01`, tot: `${y}-01-01`, label: `Vorig jaar (${y - 1})`, vergelijk: null };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) {
    const jr = +m[1];
    const mo = +m[2];
    const van = `${jr}-${m[2]}-01`;
    const tot = mo === 12 ? `${jr + 1}-01-01` : `${jr}-${pad2(mo + 1)}-01`;
    const naam = `${MONTH_NAMES[mo - 1]} ${jr}`;
    // Enkel vergelijken met het jaar ervoor als dat binnen dit en vorig jaar valt.
    const vergelijk =
      jr === y
        ? { van: `${jr - 1}-${m[2]}-01`, tot: mo === 12 ? `${jr}-01-01` : `${jr - 1}-${pad2(mo + 1)}-01`, label: `${MONTH_NAMES[mo - 1]} ${jr - 1}` }
        : null;
    // Lopende maand: vergelijk met dezelfde dagen vorig jaar, niet met de hele maand.
    if (vergelijk && jr === y && mo === nu.getMonth() + 1) {
      vergelijk.tot = iso(new Date(y - 1, nu.getMonth(), nu.getDate() + 1));
    }
    return { van, tot, label: naam, vergelijk };
  }
  // Dit jaar t.e.m. vandaag, tegenover dezelfde dagen vorig jaar.
  return {
    van: `${y}-01-01`,
    tot: iso(morgen),
    label: `Dit jaar (${y})`,
    vergelijk: { van: `${y - 1}-01-01`, tot: iso(new Date(y - 1, nu.getMonth(), nu.getDate() + 1)), label: `zelfde periode ${y - 1}` },
  };
}

/** Maandopties voor de keuzelijst: januari vorig jaar t.e.m. de lopende maand. */
export function maandOpties(nu = new Date()): { key: string; label: string }[] {
  const uit: { key: string; label: string }[] = [];
  const y = nu.getFullYear();
  for (let jr = y; jr >= y - 1; jr--) {
    const laatste = jr === y ? nu.getMonth() + 1 : 12;
    for (let m = laatste; m >= 1; m--) uit.push({ key: `${jr}-${pad2(m)}`, label: `${MONTH_NAMES[m - 1]} ${jr}` });
  }
  return uit;
}

const binnen = (d: string | null | undefined, van: string, tot: string) => !!d && d >= van && d < tot;

// ---------- kerncijfers ----------

export type Kpis = {
  aanvragen: number;
  offertes: number; // van de aanvragen uit de periode: hoeveel kregen een offerte (Pipedrive)
  offertesMeetbaar: boolean; // false als geen enkele bron offertefases kent
  gewonnen: number;
  verloren: number;
  omzet: number;
  winratio: number | null; // gewonnen / (gewonnen + verloren), op sluitdatum
  gemDagen: number | null; // aanvraag -> gewonnen
};

export function kpis(d: Dataset, van: string, tot: string): Kpis {
  let aanvragen = 0, offertes = 0, gewonnen = 0, verloren = 0, dagen = 0, dagenN = 0;
  let meetbaar = false;
  for (const l of d.leads) {
    if (l.campagne) {
      // Koude prospectie: enkel een gewonnen klant telt (als verkoop).
      if (l.status === "won" && binnen(l.won, van, tot)) gewonnen++;
      continue;
    }
    if (binnen(l.add, van, tot)) {
      aanvragen++;
      if (l.pipeline != null) meetbaar = true;
      if (l.offerte) offertes++;
    }
    if (l.status === "won" && binnen(l.won, van, tot)) {
      gewonnen++;
      if (l.add && l.won && l.pipeline != null) {
        const n = (Date.parse(l.won.replace(" ", "T") + "Z") - Date.parse(l.add.replace(" ", "T") + "Z")) / 86400000;
        if (n >= 0 && n < 3650) {
          dagen += n;
          dagenN++;
        }
      }
    }
    if (l.status === "lost" && binnen(l.lost, van, tot)) verloren++;
  }
  const omzet = d.omzet.reduce((s, o) => s + (binnen(o.won, van, tot) ? o.bedrag : 0), 0);
  const gewonnenZonderCampagne = d.leads.filter((l) => !l.campagne && l.status === "won" && binnen(l.won, van, tot)).length;
  return {
    aanvragen,
    offertes,
    offertesMeetbaar: meetbaar,
    gewonnen,
    verloren,
    omzet: Math.round(omzet),
    winratio: gewonnenZonderCampagne + verloren > 0 ? gewonnenZonderCampagne / (gewonnenZonderCampagne + verloren) : null,
    gemDagen: dagenN ? Math.round(dagen / dagenN) : null,
  };
}

export const groei = (nu: number, vorig: number): number | null => (vorig > 0 ? Math.round(((nu - vorig) / vorig) * 100) : null);

/** Per maand van een kalenderjaar: aanvragen, gewonnen, omzet. */
export function perMaand(d: Dataset, jaar: number): { maand: number; aanvragen: number; gewonnen: number; omzet: number }[] {
  const uit = Array.from({ length: 12 }, (_, i) => ({ maand: i + 1, aanvragen: 0, gewonnen: 0, omzet: 0 }));
  const j = String(jaar);
  const mnd = (s: string | null) => (s && s.slice(0, 4) === j ? +s.slice(5, 7) - 1 : -1);
  for (const l of d.leads) {
    const a = l.campagne ? -1 : mnd(l.add);
    if (a >= 0) uit[a].aanvragen++;
    if (l.status === "won") {
      const w = mnd(l.won);
      if (w >= 0) uit[w].gewonnen++;
    }
  }
  for (const o of d.omzet) {
    const w = mnd(o.won);
    if (w >= 0) uit[w].omzet += o.bedrag;
  }
  return uit.map((r) => ({ ...r, omzet: Math.round(r.omzet) }));
}

export type DienstRij = { dienst: string; aantal: number; omzet: number };
/** Omzet per product/dienst binnen de afdeling (gewonnen in de periode). */
export function perDienst(d: Dataset, van: string, tot: string): DienstRij[] {
  const m = new Map<string, { deals: Set<string>; omzet: number }>();
  for (const o of d.omzet) {
    if (!binnen(o.won, van, tot)) continue;
    const e = m.get(o.dienst) || { deals: new Set<string>(), omzet: 0 };
    e.deals.add(o.bron + o.dealId);
    e.omzet += o.bedrag;
    m.set(o.dienst, e);
  }
  return [...m.entries()]
    .map(([dienst, e]) => ({ dienst, aantal: e.deals.size, omzet: Math.round(e.omzet) }))
    .sort((a, b) => b.omzet - a.omzet || b.aantal - a.aantal);
}

export type FirmaRij = { firma: string; naam: string; bronnen: string[] } & Kpis;
export function perFirma(a: Afdeling, d: Dataset, van: string, tot: string): FirmaRij[] {
  return firmasVan(a).map((f) => ({
    firma: f.sleutel,
    naam: f.naam,
    bronnen: a.bronnen.filter((b) => b.firma === f.sleutel).map((b) => b.label),
    ...kpis(filterFirma(d, f.sleutel), van, tot),
  }));
}

export type KanaalRij = { kanaal: string; aanvragen: number; gewonnen: number; subs: { sub: string; aanvragen: number; gewonnen: number }[] };
/** Aanvragen per kanaal (deal-label, spec §5), gewonnen = van die aanvragen. */
export function perKanaal(d: Dataset, van: string, tot: string): KanaalRij[] {
  const m = new Map<string, { a: number; w: number; subs: Map<string, { a: number; w: number }> }>();
  for (const l of d.leads) {
    if (l.campagne || !binnen(l.add, van, tot)) continue;
    const infos = l.kanaal ? [l.kanaal] : channelsInfoForLabels(l.labels);
    for (const i of infos) {
      const e = m.get(i.main) || { a: 0, w: 0, subs: new Map() };
      e.a++;
      if (l.status === "won") e.w++;
      if (i.sub) {
        const s = e.subs.get(i.sub) || { a: 0, w: 0 };
        s.a++;
        if (l.status === "won") s.w++;
        e.subs.set(i.sub, s);
      }
      m.set(i.main, e);
    }
  }
  return [...m.entries()]
    .map(([kanaal, e]) => ({
      kanaal,
      aanvragen: e.a,
      gewonnen: e.w,
      subs: [...e.subs.entries()].map(([sub, s]) => ({ sub, aanvragen: s.a, gewonnen: s.w })).sort((x, y) => y.aanvragen - x.aanvragen),
    }))
    .sort((x, y) => y.aanvragen - x.aanvragen);
}

/** Verliesredenen (genormaliseerd, spec §7) van de deals verloren in de periode. */
export function verliesredenen(d: Dataset, van: string, tot: string): { reden: string; aantal: number }[] {
  const m = new Map<string, number>();
  for (const l of d.leads) {
    if (l.campagne || l.status !== "lost" || !binnen(l.lost, van, tot)) continue;
    const r = normalizeLossReason(l.lostReason);
    m.set(r, (m.get(r) || 0) + 1);
  }
  return [...m.entries()].map(([reden, aantal]) => ({ reden, aantal })).sort((a, b) => b.aantal - a.aantal);
}

/** Wat er nu open staat (los van de periode): aantal, waarvan met offerte plus de oudste. */
export function openNu(d: Dataset): { open: number; metOfferte: number; zonderOfferte: number; oudsteDagen: number | null } {
  let open = 0, metOfferte = 0, oudste: number | null = null;
  const nu = Date.now();
  for (const l of d.leads) {
    if (l.campagne || l.status !== "open") continue;
    open++;
    if (l.offerte) metOfferte++;
    const t = Date.parse(l.add.replace(" ", "T") + "Z");
    if (!isNaN(t)) {
      const dg = Math.round((nu - t) / 86400000);
      if (oudste == null || dg > oudste) oudste = dg;
    }
  }
  return { open, metOfferte, zonderOfferte: open - metOfferte, oudsteDagen: oudste };
}

/** Gewonnen deals in de periode, nieuwste eerst (voor de doorklik naar Pipedrive/Monday). */
export function recentGewonnen(d: Dataset, van: string, tot: string, max = 8): (Lead & { omzet: number })[] {
  const omzetPerDeal = new Map<string, number>();
  for (const o of d.omzet) omzetPerDeal.set(o.bron + o.dealId, (omzetPerDeal.get(o.bron + o.dealId) || 0) + o.bedrag);
  return d.leads
    .filter((l) => l.status === "won" && binnen(l.won, van, tot))
    .sort((a, b) => (b.won || "").localeCompare(a.won || ""))
    .slice(0, max)
    .map((l) => ({ ...l, omzet: Math.round(omzetPerDeal.get(l.bron + l.id) || 0) }));
}

/** Aanvragen en gewonnen over meerdere diensten, zonder een bundeldeal dubbel te tellen. */
export function uniekeTotalen(sets: Dataset[], van: string, tot: string): { aanvragen: number; gewonnen: number; verloren: number } {
  const a = new Set<string>(), w = new Set<string>(), l = new Set<string>();
  for (const d of sets)
    for (const x of d.leads) {
      if (!x.campagne && binnen(x.add, van, tot)) a.add(x.uid);
      if (x.status === "won" && binnen(x.won, van, tot)) w.add(x.uid);
      if (!x.campagne && x.status === "lost" && binnen(x.lost, van, tot)) l.add(x.uid);
    }
  return { aanvragen: a.size, gewonnen: w.size, verloren: l.size };
}

// ---------- campagne (koude prospectie) ----------

export type CampagneStand = {
  bronnen: string[];
  inLijst: number;
  open: number;
  inGesprek: { fase: string; aantal: number }[];
  inGesprekTotaal: number;
  slapend: number; // open, maar sinds 90 dagen geen fasewissel
  gewonnen: number; // in de periode
  laatsteNieuw: string | null;
};

/** Stand van de campagnelijsten: wat staat er, wat leeft er nog, wat is echt in gesprek. */
export function campagneStand(d: Dataset, van: string, tot: string): CampagneStand | null {
  const c = d.leads.filter((l) => l.campagne);
  if (!c.length) return null;
  const fases = new Map<string, number>();
  let open = 0, slapend = 0, gewonnen = 0;
  let laatste: string | null = null;
  const grens = Date.now() - 90 * 86400000;
  for (const l of c) {
    if (!laatste || l.add > laatste) laatste = l.add;
    if (l.status === "won" && binnen(l.won, van, tot)) gewonnen++;
    if (l.status !== "open") continue;
    open++;
    if (l.inGesprek) fases.set(l.stage || "?", (fases.get(l.stage || "?") || 0) + 1);
    const t = Date.parse(String(l.stageChange || l.add).replace(" ", "T") + "Z");
    if (!l.inGesprek && (isNaN(t) || t < grens)) slapend++;
  }
  const inGesprek = [...fases.entries()].map(([fase, aantal]) => ({ fase: fase.trim(), aantal })).sort((a, b) => b.aantal - a.aantal);
  return {
    bronnen: [...new Set(c.map((l) => l.bronLabel))],
    inLijst: c.length,
    open,
    inGesprek,
    inGesprekTotaal: inGesprek.reduce((s, f) => s + f.aantal, 0),
    slapend,
    gewonnen,
    laatsteNieuw: laatste ? laatste.slice(0, 10) : null,
  };
}

// ---------- lijst gewonnen / verloren (doorklik op de kerncijfers) ----------

export type DealRij = {
  uid: string;
  titel: string;
  klant: string;
  url: string;
  firma: string;
  bronLabel: string;
  aanvraag: string;
  afgerond: string | null; // datum gewonnen of verloren
  doorlooptijd: number | null; // dagen van aanvraag tot afgerond
  offerte: boolean;
  offerteOp: string | null;
  fase: string | null; // fase waarin de deal staat (bij verloren: waarin hij verloren ging)
  pipeline: string | null;
  verliesreden: string | null;
  verliesredenRuw: string | null;
  productwaarde: number; // enkel de producten van deze dienst (of de deal value waar de firma niet bundelt)
  producten: string[];
};

export function dealLijst(d: Dataset, status: "won" | "lost", van: string, tot: string): DealRij[] {
  const perDeal = new Map<string, { bedrag: number; producten: Set<string> }>();
  for (const o of d.omzet) {
    const k = o.bron + o.dealId;
    const e = perDeal.get(k) || { bedrag: 0, producten: new Set<string>() };
    e.bedrag += o.bedrag;
    e.producten.add(o.dienst);
    perDeal.set(k, e);
  }
  const dag = (x: string | null) => (x ? x.slice(0, 10) : null);
  return d.leads
    .filter((l) => l.status === status && binnen(status === "won" ? l.won : l.lost, van, tot) && !(status === "lost" && l.campagne))
    .map((l) => {
      const afgerond = status === "won" ? l.won : l.lost;
      const p = perDeal.get(l.bron + l.id);
      const t0 = Date.parse(l.add.replace(" ", "T") + "Z");
      const t1 = afgerond ? Date.parse(afgerond.replace(" ", "T") + "Z") : NaN;
      return {
        uid: l.uid,
        titel: l.titel,
        klant: l.klant,
        url: l.url,
        firma: l.firma,
        bronLabel: l.bronLabel,
        aanvraag: dag(l.add) || "",
        afgerond: dag(afgerond),
        doorlooptijd: !isNaN(t0) && !isNaN(t1) ? Math.max(0, Math.round((t1 - t0) / 86400000)) : null,
        offerte: l.offerte,
        offerteOp: dag(l.offerteOp),
        fase: l.stage,
        pipeline: l.pipeline,
        verliesreden: status === "lost" ? normalizeLossReason(l.lostReason) : null,
        verliesredenRuw: status === "lost" ? l.lostReason : null,
        productwaarde: status === "won" ? Math.round(p?.bedrag ?? l.productwaarde) : l.productwaarde,
        producten: p ? [...p.producten] : l.producten,
      };
    })
    .sort((a, b) => (b.afgerond || "").localeCompare(a.afgerond || ""));
}

/** Per maand en per bron (voor de gestapelde grafiek): omzet, gewonnen en aanvragen. */
export function perMaandPerBron(a: Afdeling, d: Dataset, jaar: number) {
  return a.bronnen
    .map((b) => {
      const sub: Dataset = { leads: d.leads.filter((l) => l.bron === b.sleutel), omzet: d.omzet.filter((o) => o.bron === b.sleutel) };
      return { sleutel: b.sleutel, label: b.label, reeks: perMaand(sub, jaar) };
    })
    .filter((x) => x.reeks.some((r) => r.omzet || r.gewonnen || r.aanvragen));
}
