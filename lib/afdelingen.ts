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
import { MONTH_NAMES } from "./queries";

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
};
export type MondayBron = {
  sleutel: string;
  firma: string;
  soort: "monday";
  label: string;
  bord: string;
  uitsluitenKlantOa?: string[];
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
  analyse?: string;
  extra?: { href: string; label: string }[];
  facturatie: string[];
  facturatieNoot?: string;
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
              d.stage_order, d.label_names, d.lost_reason, d.value,
              COALESCE(json_extract(d.raw, '$.org_name'), json_extract(d.raw, '$.person_name')) AS klant
       FROM deals d WHERE ${where}`
    )
    .all(ps.named) as any[];

  const leads: Lead[] = rijen.map((r) => {
    const drempel = drempels.get(r.pipeline_name);
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
    };
  });

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
  const leads: Lead[] = [];
  const omzet: OmzetRegel[] = [];
  for (const r of rijen) {
    const oa = String(r.klant_oa || "");
    // "Unabo" als klant = door UNABO verkocht: die telt al in UNABO's Pipedrive.
    if (uitsluiten.some((u) => oa.toLowerCase().includes(u))) continue;
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
      kanaal: { main: "Rechtstreeks (onderaanneming)", sub: oa || "Klant onbekend" },
    };
    leads.push(lead);
    if (!geannuleerd) {
      omzet.push({ bron: b.sleutel, firma: b.firma, dealId: lead.id, won: datum, bedrag: r.bedrag || 0, dienst: r.soort || b.label });
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
  return {
    aanvragen,
    offertes,
    offertesMeetbaar: meetbaar,
    gewonnen,
    verloren,
    omzet: Math.round(omzet),
    winratio: gewonnen + verloren > 0 ? gewonnen / (gewonnen + verloren) : null,
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
    const a = mnd(l.add);
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
    if (!binnen(l.add, van, tot)) continue;
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
    if (l.status !== "lost" || !binnen(l.lost, van, tot)) continue;
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
    if (l.status !== "open") continue;
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
      if (binnen(x.add, van, tot)) a.add(x.uid);
      if (x.status === "won" && binnen(x.won, van, tot)) w.add(x.uid);
      if (x.status === "lost" && binnen(x.lost, van, tot)) l.add(x.uid);
    }
  return { aanvragen: a.size, gewonnen: w.size, verloren: l.size };
}
