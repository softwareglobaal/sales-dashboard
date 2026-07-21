import { getDb } from "./db";
import { ACCOUNTS } from "./accounts";
import { hiddenExclusion, HIDDEN_PIPELINES } from "./hiddenPipelines";
import { ENG_IGNORE_PIPELINES, channelsForLabels, channelsInfoForLabels, isOfferteStage } from "./engineeringConfig";
import { getTheme } from "./themes";
import { normalizeLossReason } from "./lossReasons";
import { parseProjectLocation } from "./regio";
import { POSTCODE_COORDS } from "./postcodeCoords";

export const nameByKey = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.name]));
const colorByKey = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.color]));

// ---------- Periode ----------
// Vaste periodes ("12m", "ytd", "prev_year", "all") of een specifieke maand "JJJJ-MM".
export type Period = string;

export const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "12m", label: "Laatste 12 maanden" },
  { key: "ytd", label: "Dit jaar" },
  { key: "prev_year", label: "Vorig jaar" },
  { key: "all", label: "Alle tijd" },
];

// Geëxporteerd zodat afdelings-querymodules (bv. lib/energyQueries.ts) dezelfde
// maandnamen/tijd-helpers hergebruiken zonder Engineering-logica te dupliceren.
export const MONTH_NAMES = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

// Maandopties voor 2026 (jan t/m huidige maand)
export function monthOptions2026(): { key: Period; label: string }[] {
  const now = new Date();
  const y = now.getFullYear();
  const last = y > 2026 ? 12 : y === 2026 ? now.getMonth() + 1 : 0;
  const out: { key: Period; label: string }[] = [];
  for (let m = 1; m <= last; m++) {
    const mm = String(m).padStart(2, "0");
    out.push({ key: `2026-${mm}`, label: MONTH_NAMES[m - 1].slice(0, 3) + " '26" });
  }
  return out;
}

// ----- Week-helpers -----
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = maandag
  x.setDate(x.getDate() - day);
  return x;
}

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // donderdag van deze week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

// Week-opties voor 2026 (maandag-startend, t/m huidige week)
export function weekOptions2026(): { key: Period; label: string }[] {
  const now = new Date();
  const start = mondayOf(new Date(2026, 0, 1));
  const last = mondayOf(new Date(2026, 11, 28));
  let end = mondayOf(now);
  if (end > last) end = last;
  if (end < start) return [];
  const out: { key: Period; label: string }[] = [];
  const cur = new Date(start);
  const p = (n: number) => String(n).padStart(2, "0");
  while (cur <= end) {
    const wk = isoWeek(cur);
    out.push({ key: `wk:${ymd(cur)}`, label: `W${p(wk)} · ${p(cur.getDate())}/${p(cur.getMonth() + 1)}` });
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

export function isValidPeriod(p: string | undefined): boolean {
  if (!p) return false;
  if (PERIOD_OPTIONS.some((o) => o.key === p)) return true;
  if (/^2026-(0[1-9]|1[0-2])$/.test(p)) return true;
  return /^wk:\d{4}-\d{2}-\d{2}$/.test(p);
}

export function periodRange(period: Period): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // specifieke week "wk:JJJJ-MM-DD" (maandag)
  const wk = /^wk:(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (wk) {
    const from = `${wk[1]}-${wk[2]}-${wk[3]}`;
    const d = new Date(+wk[1], +wk[2] - 1, +wk[3]);
    const weekNo = isoWeek(d);
    d.setDate(d.getDate() + 7);
    const to = iso(d);
    return { from, to, label: `week ${weekNo} (van ${+wk[3]} ${MONTH_NAMES[+wk[2] - 1].slice(0, 3)} ${wk[1]})` };
  }

  // specifieke maand "JJJJ-MM"
  const mm = /^(\d{4})-(\d{2})$/.exec(period);
  if (mm) {
    const yr = +mm[1];
    const mo = +mm[2];
    const from = `${mm[1]}-${mm[2]}-01`;
    const to = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${pad(mo + 1)}-01`;
    return { from, to, label: `${MONTH_NAMES[mo - 1]} ${yr}` };
  }

  switch (period) {
    case "ytd":
      return { from: `${y}-01-01`, to: null, label: "Dit jaar" };
    case "prev_year":
      return { from: `${y - 1}-01-01`, to: `${y}-01-01`, label: "Vorig jaar" };
    case "all":
      return { from: null, to: null, label: "Alle tijd" };
    case "12m":
    default: {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 12);
      return { from: iso(d), to: null, label: "Laatste 12 maanden" };
    }
  }
}

// Basisfilter: deals AANGEMAAKT in de periode + verborgen pipelines weg
function baseFilter(period: Period): { clause: string; params: (string | number)[] } {
  const { from, to } = periodRange(period);
  const h = hiddenExclusion();
  const parts: string[] = [];
  const params: (string | number)[] = [...h.params];
  if (from) {
    parts.push("add_time >= ?");
    params.push(from);
  }
  if (to) {
    parts.push("add_time < ?");
    params.push(to);
  }
  const clause = h.clause + (parts.length ? " AND " + parts.join(" AND ") : "");
  return { clause, params };
}

// Periode-grenzen als concrete datums (null -> heel ver weg) voor SQL-vergelijking.
export function periodBounds(period: Period): { from: string; to: string } {
  const { from, to } = periodRange(period);
  return { from: from ?? "0000-01-01", to: to ?? "9999-12-31" };
}

// Verborgen pipelines (alle accounts) als named-parameters.
function hiddenNamed(): { clause: string; named: Record<string, string> } {
  const named: Record<string, string> = {};
  const parts: string[] = [];
  let i = 0;
  for (const [acc, names] of Object.entries(HIDDEN_PIPELINES)) {
    for (const n of names) {
      const ka = `ha${i}`;
      const kp = `hp${i}`;
      parts.push(`NOT (account_key = @${ka} AND pipeline_name = @${kp})`);
      named[ka] = acc;
      named[kp] = n;
      i++;
    }
  }
  return { clause: parts.length ? " AND " + parts.join(" AND ") : "", named };
}

// Verborgen pipelines voor één account (alias-veilig) als named-parameters.
function hiddenNamedForAccount(alias: string, acc: string): { clause: string; named: Record<string, string> } {
  const names = HIDDEN_PIPELINES[acc] || [];
  if (!names.length) return { clause: "", named: {} };
  const named: Record<string, string> = {};
  const keys = names.map((n, i) => {
    const k = `${acc}_h${i}`;
    named[k] = n;
    return `@${k}`;
  });
  return {
    clause: ` AND (${alias}pipeline_name IS NULL OR ${alias}pipeline_name NOT IN (${keys.join(", ")}))`,
    named,
  };
}

// ---------- Per-account statistieken ----------
export type AccountStats = {
  key: string;
  name: string;
  color: string;
  leadCount: number; // aangemaakte deals in periode
  openCount: number;
  wonCount: number;
  lostCount: number;
  openValue: number;
  wonValue: number;
  winRate: number;
};

export function getAccountStats(period: Period): AccountStats[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hiddenNamed();
  const rows = db
    .prepare(
      `SELECT account_key,
              SUM(CASE WHEN add_time >= @from AND add_time < @to THEN 1 ELSE 0 END) AS leadCount,
              SUM(CASE WHEN status='open' AND add_time >= @from AND add_time < @to THEN 1 ELSE 0 END) AS openCount,
              SUM(CASE WHEN status='won'  AND won_time  >= @from AND won_time  < @to THEN 1 ELSE 0 END) AS wonCount,
              SUM(CASE WHEN status='lost' AND lost_time >= @from AND lost_time < @to THEN 1 ELSE 0 END) AS lostCount,
              SUM(CASE WHEN status='open' AND add_time >= @from AND add_time < @to THEN value ELSE 0 END) AS openValue,
              SUM(CASE WHEN status='won'  AND won_time  >= @from AND won_time  < @to THEN value ELSE 0 END) AS wonValue
       FROM deals WHERE 1=1 ${h.clause} GROUP BY account_key`
    )
    .all({ from, to, ...h.named }) as any[];

  const byKey = new Map(rows.map((r) => [r.account_key, r]));
  return ACCOUNTS.map((a) => {
    const r = byKey.get(a.key) || {};
    const won = r.wonCount || 0;
    const lost = r.lostCount || 0;
    return {
      key: a.key,
      name: a.name,
      color: a.color,
      leadCount: r.leadCount || 0,
      openCount: r.openCount || 0,
      wonCount: won,
      lostCount: lost,
      openValue: r.openValue || 0,
      wonValue: r.wonValue || 0,
      winRate: won + lost > 0 ? won / (won + lost) : 0,
    };
  });
}

export type Totals = {
  leadCount: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  openValue: number;
  wonValue: number;
  winRate: number;
};

export function getTotals(period: Period): Totals {
  const stats = getAccountStats(period);
  const t = stats.reduce(
    (acc, s) => {
      acc.leadCount += s.leadCount;
      acc.openCount += s.openCount;
      acc.wonCount += s.wonCount;
      acc.lostCount += s.lostCount;
      acc.openValue += s.openValue;
      acc.wonValue += s.wonValue;
      return acc;
    },
    { leadCount: 0, openCount: 0, wonCount: 0, lostCount: 0, openValue: 0, wonValue: 0, winRate: 0 }
  );
  t.winRate = t.wonCount + t.lostCount > 0 ? t.wonCount / (t.wonCount + t.lostCount) : 0;
  return t;
}

// ---------- Leadinstroom per maand (op aanmaakdatum) ----------
export function getLeadsByMonth(period: Period): Record<string, number | string>[] {
  const db = getDb();
  const { clause, params } = baseFilter(period);
  const rows = db
    .prepare(
      `SELECT account_key, substr(add_time,1,7) AS month, COUNT(*) AS total
       FROM deals WHERE add_time IS NOT NULL ${clause}
       GROUP BY account_key, month ORDER BY month`
    )
    .all(...params) as any[];

  const months = Array.from(new Set(rows.map((r) => r.month))).sort();
  const result = months.map((m) => {
    const entry: Record<string, number | string> = { month: m };
    for (const a of ACCOUNTS) entry[a.key] = 0;
    return entry;
  });
  const idx = new Map(result.map((r, i) => [r.month as string, i]));
  for (const r of rows) {
    const i = idx.get(r.month);
    if (i !== undefined) result[i][r.account_key] = r.total || 0;
  }
  return result;
}

// ---------- Instroom per pipeline (brug naar Google Ads) ----------
export function getLeadsByPipeline(period: Period, limit = 12) {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hiddenNamed();
  const rows = db
    .prepare(
      `SELECT account_key, pipeline_name,
              SUM(CASE WHEN add_time >= @from AND add_time < @to THEN 1 ELSE 0 END) AS leads,
              SUM(CASE WHEN status='won' AND won_time >= @from AND won_time < @to THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN status='open' AND add_time >= @from AND add_time < @to THEN value ELSE 0 END) AS openValue
       FROM deals WHERE pipeline_name IS NOT NULL ${h.clause}
       GROUP BY account_key, pipeline_name
       HAVING leads > 0 OR won > 0
       ORDER BY leads DESC LIMIT @limit`
    )
    .all({ from, to, limit, ...h.named }) as any[];
  return rows.map((r) => ({
    label: r.pipeline_name,
    account: nameByKey[r.account_key] || r.account_key,
    color: colorByKey[r.account_key] || "#888",
    leads: r.leads,
    won: r.won,
    openValue: Math.round(r.openValue || 0),
  }));
}

// ---------- Trechter per fase ----------
export function getPipelineOptions() {
  const db = getDb();
  const { clause, params } = hiddenExclusion();
  const rows = db
    .prepare(
      `SELECT account_key, pipeline_name, COUNT(*) c
       FROM deals WHERE pipeline_name IS NOT NULL ${clause}
       GROUP BY account_key, pipeline_name ORDER BY c DESC`
    )
    .all(...params) as any[];
  return rows.map((r) => ({
    account_key: r.account_key,
    accountName: nameByKey[r.account_key] || r.account_key,
    pipeline: r.pipeline_name,
    color: colorByKey[r.account_key] || "#888",
    count: r.c,
  }));
}

export function getFunnel(period: Period, accountKey: string, pipeline: string) {
  const db = getDb();
  const { from, to } = periodRange(period);
  const parts: string[] = ["account_key = ?", "pipeline_name = ?"];
  const params: (string | number)[] = [accountKey, pipeline];
  if (from) {
    parts.push("add_time >= ?");
    params.push(from);
  }
  if (to) {
    parts.push("add_time < ?");
    params.push(to);
  }
  const rows = db
    .prepare(
      `SELECT stage_name, stage_order,
              SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS openCount,
              SUM(CASE WHEN status='won'  THEN 1 ELSE 0 END) AS wonCount,
              SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) AS lostCount,
              SUM(CASE WHEN status='open' THEN value ELSE 0 END) AS openValue,
              AVG(CASE WHEN status='open' AND json_extract(raw,'$.stage_change_time') IS NOT NULL
                       THEN julianday('now') - julianday(json_extract(raw,'$.stage_change_time')) END) AS avgDaysInStage
       FROM deals WHERE ${parts.join(" AND ")}
       GROUP BY stage_name, stage_order
       ORDER BY stage_order ASC`
    )
    .all(...params) as any[];
  return rows.map((r) => ({
    stage: r.stage_name || "(onbekend)",
    openCount: r.openCount || 0,
    wonCount: r.wonCount || 0,
    lostCount: r.lostCount || 0,
    openValue: Math.round(r.openValue || 0),
    avgDaysInStage: r.avgDaysInStage != null ? Math.round(r.avgDaysInStage) : null,
  }));
}

// ---------- Verlies-redenen ----------
export function getLostReasons(period: Period, limit = 10) {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hiddenNamed();
  const rows = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(lost_reason),''),'(geen reden ingevuld)') AS reason,
              COUNT(*) AS c
       FROM deals WHERE status='lost' AND lost_time >= @from AND lost_time < @to ${h.clause}
       GROUP BY reason ORDER BY c DESC LIMIT @limit`
    )
    .all({ from, to, limit, ...h.named }) as any[];
  return rows.map((r) => ({ reason: r.reason, count: r.c }));
}

// ---------- UNABO afdelingen (op basis van product-prijs) ----------
export type DepartmentRow = {
  department: string;
  wonRevenue: number; // gewonnen omzet (som van productprijzen)
  wonLines: number; // aantal gewonnen productregels
  openValue: number; // open waarde (productprijzen)
  unassigned: boolean;
};

export function getUnaboDepartments(period: Period, themeKey?: string): DepartmentRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hiddenNamedForAccount("d.", "unabo");
  const th = engTheme(themeKey, "d", "dept");
  const rows = db
    .prepare(
      `SELECT p.department AS department,
              SUM(CASE WHEN d.status='won'  AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS wonRevenue,
              SUM(CASE WHEN d.status='won'  AND d.won_time >= @from AND d.won_time < @to THEN 1 ELSE 0 END)          AS wonLines,
              SUM(CASE WHEN d.status='open' AND d.add_time >= @from AND d.add_time < @to THEN p.line_sum ELSE 0 END) AS openValue
       FROM deal_products p
       JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id
       WHERE d.account_key = 'unabo' ${h.clause} ${th.clause}
       GROUP BY p.department
       HAVING wonRevenue <> 0 OR openValue <> 0
       ORDER BY wonRevenue DESC`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];
  return rows.map((r) => ({
    department: r.department,
    wonRevenue: Math.round(r.wonRevenue || 0),
    wonLines: r.wonLines || 0,
    openValue: Math.round(r.openValue || 0),
    unassigned: r.department === "Niet toegewezen",
  }));
}

// ---------- Gecombineerd: Engineering (UNABO Engineering + TKN-Buro) ----------
export type EngineeringCombined = {
  unaboEngWon: number;
  unaboEngOpen: number;
  tknWon: number;
  tknOpen: number;
  totalWon: number;
  totalOpen: number;
};

export function getEngineeringCombined(period: Period, themeKey?: string): EngineeringCombined {
  const db = getDb();
  const { from, to } = periodBounds(period);

  // UNABO Engineering: som van productprijzen waar afdeling = ENGINEERING
  const hu = hiddenNamedForAccount("d.", "unabo");
  const thu = engTheme(themeKey, "d", "cu");
  const una = db
    .prepare(
      `SELECT
         SUM(CASE WHEN d.status='won'  AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS won,
         SUM(CASE WHEN d.status='open' AND d.add_time >= @from AND d.add_time < @to THEN p.line_sum ELSE 0 END) AS open
       FROM deal_products p
       JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id
       WHERE d.account_key='unabo' AND p.department='ENGINEERING' ${hu.clause} ${thu.clause}`
    )
    .get({ from, to, ...hu.named, ...thu.named }) as any;

  // TKN-Buro: volledige omzet (deal value)
  const ht = hiddenNamedForAccount("", "tknburo");
  const tht = engTheme(themeKey, "deals", "ct");
  const tkn = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status='won'  AND won_time >= @from AND won_time < @to THEN value ELSE 0 END) AS won,
         SUM(CASE WHEN status='open' AND add_time >= @from AND add_time < @to THEN value ELSE 0 END) AS open
       FROM deals
       WHERE account_key='tknburo' ${ht.clause} ${tht.clause}`
    )
    .get({ from, to, ...ht.named, ...tht.named }) as any;

  const unaboEngWon = Math.round(una?.won || 0);
  const unaboEngOpen = Math.round(una?.open || 0);
  const tknWon = Math.round(tkn?.won || 0);
  const tknOpen = Math.round(tkn?.open || 0);
  return {
    unaboEngWon,
    unaboEngOpen,
    tknWon,
    tknOpen,
    totalWon: unaboEngWon + tknWon,
    totalOpen: unaboEngOpen + tknOpen,
  };
}

// ---------- Engineering: analyse per dienst ----------
export type ServiceRow = {
  service: string; // weergavenaam van de dienst
  source: string; // "UNABO Eng" of "TKN-Buro"
  requests: number; // aanvragen (aangemaakt in periode)
  soldCount: number; // verkocht (gewonnen in periode)
  revenue: number; // omzet (gewonnen in periode)
  avgDays: number | null; // gem. dagen van aanvraag tot gewonnen
};

function cleanServiceName(name: string | null): string {
  if (!name) return "(geen productnaam)";
  // voorvoegsel "ENGINEERING:" weghalen voor leesbaarheid
  return name.replace(/^ENGINEERING:\s*/i, "").trim() || name;
}

export function getEngineeringServices(period: Period, themeKey?: string, scope: EngScope = "all"): ServiceRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);

  // verborgen pipelines van unabo + tknburo + engineering-genegeerde (op naam)
  const hiddenNames = Array.from(
    new Set([...(HIDDEN_PIPELINES["unabo"] || []), ...(HIDDEN_PIPELINES["tknburo"] || []), ...ENG_IGNORE_PIPELINES])
  );
  const hiddenNamed: Record<string, string> = {};
  const hiddenKeys = hiddenNames.map((n, i) => {
    const k = `en_h${i}`;
    hiddenNamed[k] = n;
    return `@${k}`;
  });
  const hiddenClause = hiddenKeys.length
    ? ` AND (d.pipeline_name IS NULL OR d.pipeline_name NOT IN (${hiddenKeys.join(", ")}))`
    : "";
  const th = engTheme(themeKey, "d", "svt");

  const rows = db
    .prepare(
      `SELECT
         CASE WHEN p.account_key='unabo' THEN 'UNABO Eng' ELSE 'TKN-Buro' END AS source,
         COALESCE(NULLIF(TRIM(p.name), ''), '(geen productnaam)') AS rawName,
         SUM(CASE WHEN d.add_time >= @from AND d.add_time < @to THEN 1 ELSE 0 END) AS requests,
         SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN 1 ELSE 0 END) AS soldCount,
         SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS revenue,
         AVG(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to
                  THEN julianday(d.won_time) - julianday(d.add_time) END) AS avgDays
       FROM deal_products p
       JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id
       WHERE ${engProductScopeExpr(scope)}
         ${hiddenClause} ${th.clause}
       GROUP BY source, rawName
       HAVING requests > 0 OR soldCount > 0
       ORDER BY revenue DESC`
    )
    .all({ from, to, ...hiddenNamed, ...th.named }) as any[];

  return rows.map((r) => ({
    service: cleanServiceName(r.rawName),
    source: r.source,
    requests: r.requests || 0,
    soldCount: r.soldCount || 0,
    revenue: Math.round(r.revenue || 0),
    avgDays: r.avgDays != null ? Math.round(r.avgDays) : null,
  }));
}

// Firma-scope binnen Engineering: alle, enkel UNABO Engineering, of enkel TKN-Buro.
export type EngScope = "all" | "unabo" | "tkn";

// Product-niveau scope-expressie (aliassen d = deals, p = deal_products), zonder hidden-pipelines.
function engProductScopeExpr(scope: EngScope): string {
  const unabo = "(d.account_key='unabo' AND p.department='ENGINEERING')";
  const tkn = "d.account_key='tknburo'";
  if (scope === "unabo") return unabo;
  if (scope === "tkn") return tkn;
  return `(${unabo} OR ${tkn})`;
}

// Engineering-scope (product-niveau) + verborgen pipelines weg.
function engScope(scope: EngScope = "all"): { clause: string; named: Record<string, string> } {
  const hiddenNames = Array.from(
    new Set([
      ...(HIDDEN_PIPELINES["unabo"] || []),
      ...(HIDDEN_PIPELINES["tknburo"] || []),
      ...ENG_IGNORE_PIPELINES,
    ])
  );
  const named: Record<string, string> = {};
  const keys = hiddenNames.map((n, i) => {
    const k = `es_h${i}`;
    named[k] = n;
    return `@${k}`;
  });
  const hidden = keys.length ? ` AND (d.pipeline_name IS NULL OR d.pipeline_name NOT IN (${keys.join(", ")}))` : "";
  const clause = `${engProductScopeExpr(scope)}${hidden}`;
  return { clause, named };
}

// Deal-niveau LEAD-scope voor Engineering: TKN-Buro + UNABO (eng-product ÓF UNABO-Engineering pipeline).
// Zo tellen ook 'plannen op aanvraag' zonder product mee als lead. Scope beperkt tot één firma indien gevraagd.
function engLeadScope(scope: EngScope = "all"): string {
  const unabo =
    "(account_key='unabo' AND (" +
    "id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department='ENGINEERING') " +
    "OR pipeline_name='UNABO-Engineering'))";
  const tkn = "(account_key='tknburo')";
  if (scope === "unabo") return unabo;
  if (scope === "tkn") return tkn;
  return `(${tkn} OR ${unabo})`;
}

// Verborgen pipelines (Engineering) als named params, met vrij te kiezen prefix.
function engHidden(prefix: string): { clause: string; named: Record<string, string> } {
  const hiddenNames = Array.from(
    new Set([
      ...(HIDDEN_PIPELINES["unabo"] || []),
      ...(HIDDEN_PIPELINES["tknburo"] || []),
      ...ENG_IGNORE_PIPELINES,
    ])
  );
  const named: Record<string, string> = {};
  const keys = hiddenNames.map((n, i) => {
    const k = `${prefix}${i}`;
    named[k] = n;
    return `@${k}`;
  });
  const clause = keys.length ? ` AND (pipeline_name IS NULL OR pipeline_name NOT IN (${keys.join(", ")}))` : "";
  return { clause, named };
}

// Thema-filter als named params. dealRef = tabelnaam/alias voor deals ("deals" of "d").
function engTheme(themeKey: string | undefined, dealRef = "deals", prefix = "th"): { clause: string; named: Record<string, string> } {
  const theme = getTheme(themeKey);
  if (!theme || !theme.match.length) return { clause: "", named: {} };
  const named: Record<string, string> = {};
  const likes = theme.match
    .map((m, i) => {
      const k = `${prefix}${i}`;
      named[k] = `%${m.toLowerCase()}%`;
      return `lower(dp.name) LIKE @${k}`;
    })
    .join(" OR ");
  const clause = ` AND ${dealRef}.id IN (SELECT dp.deal_id FROM deal_products dp WHERE dp.account_key = ${dealRef}.account_key AND (${likes}))`;
  return { clause, named };
}

// Engineering: aanvragen (op aanmaakmaand) en omzet (op winmaand) per maand
// Same-month cohort: per aanmaakmaand de binnengekomen leads én de omzet/deals die in DIEZELFDE maand
// zijn aangemaakt én gewonnen (= meteen gewonnen). Zo is het een eerlijke vergelijking.
export function getEngineeringByMonth(
  period: Period,
  themeKey?: string,
  scope: EngScope = "all"
): { month: string; requests: number; revenue: number; wonCount: number }[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("bm_h");
  const th = engTheme(themeKey, "deals", "bmt");

  // aanvragen = leads aangemaakt per maand (LEAD-scope, deal-niveau)
  const reqRows = db
    .prepare(
      `SELECT substr(add_time,1,7) AS month, COUNT(*) AS requests
       FROM deals
       WHERE ${engLeadScope(scope)} AND add_time >= @from AND add_time < @to ${h.clause} ${th.clause}
       GROUP BY month`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];

  // omzet + aantal: aangemaakt ÉN gewonnen in dezelfde maand (op product-prijs)
  const s = engScope(scope);
  const thp = engTheme(themeKey, "d", "bmtp");
  const revRows = db
    .prepare(
      `SELECT substr(d.add_time,1,7) AS month, SUM(p.line_sum) AS revenue, COUNT(DISTINCT d.id) AS wonCount
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${s.clause} AND d.status='won'
         AND substr(d.add_time,1,7) = substr(d.won_time,1,7)
         AND d.add_time >= @from AND d.add_time < @to ${thp.clause}
       GROUP BY month`
    )
    .all({ from, to, ...s.named, ...thp.named }) as any[];

  const map = new Map<string, { month: string; requests: number; revenue: number; wonCount: number }>();
  for (const r of reqRows)
    if (r.month) map.set(r.month, { month: r.month, requests: r.requests || 0, revenue: 0, wonCount: 0 });
  for (const r of revRows) {
    if (!r.month) continue;
    const e = map.get(r.month) || { month: r.month, requests: 0, revenue: 0, wonCount: 0 };
    e.revenue = Math.round(r.revenue || 0);
    e.wonCount = r.wonCount || 0;
    map.set(r.month, e);
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// ---------- Engineering: aanvragen / gewonnen / verloren per periode ----------
export type ActivityGranularity = "month" | "week";
export type DealMini = { id: number; title: string; client: string; value: number; url: string; addDate: string };
export type ActivityRow = {
  bucket: string;
  label: string;
  requests: number; // aanvragen (aanmaakdatum)
  wonCount: number; // gewonnen deals (win-datum)
  wonValue: number; // gewonnen omzet op product-prijs (win-datum)
  lostCount: number; // verloren deals (verlies-datum)
  reqDeals: DealMini[]; // deals achter 'aanvragen' (voor klik-detail)
  wonDeals: DealMini[]; // deals achter 'gewonnen'
  lostDeals: DealMini[]; // deals achter 'verloren'
};

export function parseYmd(s: string): Date {
  return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}

export function getEngineeringActivity(period: Period, granularity: ActivityGranularity, themeKey?: string, scope: EngScope = "all"): ActivityRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("ac_h");
  const th = engTheme(themeKey, "deals");

  // deal-niveau: aantallen (aanvragen / gewonnen / verloren) — LEAD-scope
  const rows = db
    .prepare(
      `SELECT id, account_key, title, status, value, add_time, won_time, lost_time, raw
       FROM deals
       WHERE ${engLeadScope(scope)} ${h.clause} ${th.clause}`
    )
    .all({ ...h.named, ...th.named }) as any[];

  // product-niveau: gewonnen omzet (op product-prijs), gebucket op win-datum
  const s = engScope(scope);
  const thp = engTheme(themeKey, "d", "thp");
  const prodRows = db
    .prepare(
      `SELECT d.won_time AS won_time, p.line_sum AS line_sum
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${s.clause} AND d.status='won' ${thp.clause}`
    )
    .all({ ...s.named, ...thp.named }) as any[];

  const pad = (n: number) => String(n).padStart(2, "0");
  const buckets = new Map<string, ActivityRow>();

  function bucketFor(dateStr: string): { key: string; label: string } {
    if (granularity === "month") {
      const key = dateStr.slice(0, 7);
      const label = `${MONTH_NAMES[+key.slice(5, 7) - 1].slice(0, 3)} '${key.slice(2, 4)}`;
      return { key, label };
    }
    const mon = mondayOf(parseYmd(dateStr.slice(0, 10)));
    const key = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
    const label = `W${pad(isoWeek(mon))} ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)}`;
    return { key, label };
  }

  function bucket(dateStr: string | null): ActivityRow | null {
    if (!dateStr) return null;
    if (dateStr < from || dateStr >= to) return null; // buiten gekozen periode
    const { key, label } = bucketFor(dateStr);
    let e = buckets.get(key);
    if (!e) {
      e = { bucket: key, label, requests: 0, wonCount: 0, wonValue: 0, lostCount: 0, reqDeals: [], wonDeals: [], lostDeals: [] };
      buckets.set(key, e);
    }
    return e;
  }

  for (const r of rows) {
    let raw: any = {};
    try {
      raw = JSON.parse(r.raw || "{}");
    } catch {}
    const domain = domainByKey[r.account_key] || "";
    const mini: DealMini = {
      id: r.id,
      title: r.title || "(zonder titel)",
      client: raw.org_name || raw.person_name || "(onbekend)",
      value: Math.round(r.value || 0),
      url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "",
      addDate: r.add_time ? String(r.add_time).slice(0, 10) : "",
    };
    const req = bucket(r.add_time);
    if (req) {
      req.requests++;
      req.reqDeals.push(mini);
    }
    if (r.status === "won") {
      const b = bucket(r.won_time);
      if (b) {
        b.wonCount++;
        b.wonDeals.push(mini);
      }
    }
    if (r.status === "lost") {
      const b = bucket(r.lost_time);
      if (b) {
        b.lostCount++;
        b.lostDeals.push(mini);
      }
    }
  }
  for (const p of prodRows) {
    const b = bucket(p.won_time);
    if (b) b.wonValue += p.line_sum || 0;
  }

  return Array.from(buckets.values())
    .map((r) => ({ ...r, wonValue: Math.round(r.wonValue) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

// ---------- Engineering: aanvragen per kanaal (tweelaags: hoofd/sub) ----------
export type ChannelSub = { sub: string; leads: number; won: number; open: number; lost: number };
export type ChannelRow = {
  channel: string; // hoofdkanaal
  leads: number;
  won: number;
  open: number;
  lost: number;
  subs: ChannelSub[]; // subkanalen (partners)
};

export function getEngineeringChannels(period: Period, themeKey?: string, scope: EngScope = "all"): ChannelRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("ch_h");
  const th = engTheme(themeKey, "deals", "cht");

  // leads (aangemaakt in periode) in de LEAD-scope
  const rows = db
    .prepare(
      `SELECT status, label_names
       FROM deals
       WHERE ${engLeadScope(scope)} AND add_time >= @from AND add_time < @to ${h.clause} ${th.clause}`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];

  type Acc = ChannelRow & { subMap: Map<string, ChannelSub> };
  const map = new Map<string, Acc>();
  const bump = (o: { leads: number; won: number; open: number; lost: number }, status: string) => {
    o.leads++;
    if (status === "won") o.won++;
    else if (status === "open") o.open++;
    else if (status === "lost") o.lost++;
  };

  for (const r of rows) {
    const infos = channelsInfoForLabels(r.label_names);
    for (const info of infos) {
      let e = map.get(info.main);
      if (!e) {
        e = { channel: info.main, leads: 0, won: 0, open: 0, lost: 0, subs: [], subMap: new Map() };
        map.set(info.main, e);
      }
      bump(e, r.status);
      if (info.sub) {
        let s = e.subMap.get(info.sub);
        if (!s) {
          s = { sub: info.sub, leads: 0, won: 0, open: 0, lost: 0 };
          e.subMap.set(info.sub, s);
        }
        bump(s, r.status);
      }
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      channel: e.channel,
      leads: e.leads,
      won: e.won,
      open: e.open,
      lost: e.lost,
      subs: Array.from(e.subMap.values()).sort((a, b) => b.leads - a.leads),
    }))
    .sort((a, b) => b.leads - a.leads);
}

// ---------- Engineering: verlies-redenen (ALLEEN 2026) ----------
export type LostDeal = { id: number; title: string; pipeline: string; accountName: string; url: string };
export type EngLostReasons = {
  reasons: { reason: string; count: number; unabo: number; tkn: number; deals: LostDeal[] }[];
  total: number;
  outside2026: boolean; // gekozen periode valt (deels) buiten 2026 -> dan tonen we niets
};

export const domainByKey = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.domain]));

export function getEngineeringLostReasons(period: Period, themeKey?: string, scope: EngScope = "all"): EngLostReasons {
  const db = getDb();
  const { from, to } = periodBounds(period);
  // afbakenen tot 2026
  const from26 = from < "2026-01-01" ? "2026-01-01" : from;
  const to26 = to > "2027-01-01" ? "2027-01-01" : to;
  if (from26 >= to26) {
    return { reasons: [], total: 0, outside2026: true };
  }

  const h = engHidden("lr_h");
  const th = engTheme(themeKey, "deals", "lrt");

  // ruwe deals ophalen (LEAD-scope), daarna in JS normaliseren en optellen over beide accounts
  const rows = db
    .prepare(
      `SELECT id, account_key, pipeline_name, title, lost_reason
       FROM deals
       WHERE ${engLeadScope(scope)} AND status='lost' AND lost_time >= @from AND lost_time < @to ${h.clause} ${th.clause}
       ORDER BY lost_time DESC`
    )
    .all({ from: from26, to: to26, ...h.named, ...th.named }) as any[];

  type Acc = { reason: string; count: number; unabo: number; tkn: number; deals: LostDeal[] };
  const map = new Map<string, Acc>();
  for (const r of rows) {
    const reason = normalizeLossReason(r.lost_reason);
    let e = map.get(reason);
    if (!e) {
      e = { reason, count: 0, unabo: 0, tkn: 0, deals: [] };
      map.set(reason, e);
    }
    e.count++;
    if (r.account_key === "unabo") e.unabo++;
    else e.tkn++;
    const domain = domainByKey[r.account_key] || "";
    e.deals.push({
      id: r.id,
      title: r.title || "(zonder titel)",
      pipeline: r.pipeline_name || "(geen pipeline)",
      accountName: nameByKey[r.account_key] || r.account_key,
      url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "",
    });
  }
  const reasons = Array.from(map.values()).sort((a, b) => b.count - a.count);
  return { reasons, total: reasons.reduce((a, r) => a + r.count, 0), outside2026: false };
}

// ---------- Engineering: KPI's (aanvragen = LEADS op add_time, niet productregels) ----------
export type EngKpis = { requests: number; wonCount: number; wonValue: number; avgDays: number | null };

function kpisForRange(from: string, to: string, themeKey?: string, scope: EngScope = "all"): EngKpis {
  const db = getDb();
  const h = engHidden("kpi_h");
  const th = engTheme(themeKey, "deals", "kpit");

  const cnt = db
    .prepare(
      `SELECT
         SUM(CASE WHEN add_time >= @from AND add_time < @to THEN 1 ELSE 0 END) AS requests,
         SUM(CASE WHEN status='won' AND won_time >= @from AND won_time < @to THEN 1 ELSE 0 END) AS wonCount,
         AVG(CASE WHEN status='won' AND won_time >= @from AND won_time < @to
                  THEN julianday(won_time) - julianday(add_time) END) AS avgDays
       FROM deals WHERE ${engLeadScope(scope)} ${h.clause} ${th.clause}`
    )
    .get({ from, to, ...h.named, ...th.named }) as any;

  const s = engScope(scope);
  const thp = engTheme(themeKey, "d", "kpitp");
  const val = db
    .prepare(
      `SELECT SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS wonValue
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${s.clause} ${thp.clause}`
    )
    .get({ from, to, ...s.named, ...thp.named }) as any;

  return {
    requests: cnt?.requests || 0,
    wonCount: cnt?.wonCount || 0,
    wonValue: Math.round(val?.wonValue || 0),
    avgDays: cnt?.avgDays != null ? Math.round(cnt.avgDays) : null,
  };
}

export function getEngineeringKpis(period: Period, themeKey?: string, scope: EngScope = "all"): EngKpis {
  const { from, to } = periodBounds(period);
  return kpisForRange(from, to, themeKey, scope);
}

// KPI's + vergelijking met de vorige, even lange periode (voor delta's).
export type EngKpisDelta = EngKpis & {
  prev: EngKpis | null;
  dRequests: number | null; // procentueel verschil
  dWonCount: number | null;
  dWonValue: number | null;
};

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getEngineeringKpisWithDelta(period: Period, themeKey?: string, scope: EngScope = "all"): EngKpisDelta {
  const { from, to } = periodBounds(period);
  const cur = kpisForRange(from, to, themeKey, scope);

  // effectieve einddatum = min(to, vandaag) zodat open-eindes (dit jaar / 12m) eerlijk vergelijken
  const today = isoDate(new Date());
  const eff = to > today ? today : to;
  const pct = (c: number, p: number): number | null => (p > 0 ? Math.round(((c - p) / p) * 100) : null);

  if (from <= "0001-01-01" || eff <= from) {
    return { ...cur, prev: null, dRequests: null, dWonCount: null, dWonValue: null };
  }
  const spanMs = parseYmd(eff).getTime() - parseYmd(from).getTime();
  const prevFrom = isoDate(new Date(parseYmd(from).getTime() - spanMs));
  const prev = kpisForRange(prevFrom, from, themeKey, scope);
  return {
    ...cur,
    prev,
    dRequests: pct(cur.requests, prev.requests),
    dWonCount: pct(cur.wonCount, prev.wonCount),
    dWonValue: pct(cur.wonValue, prev.wonValue),
  };
}

// ---------- Engineering: bundel vs. los (gewonnen deals) ----------
export type BundleSplit = {
  losCount: number;
  losValue: number; // engineering-productwaarde (= vrijwel deal value bij los)
  bundelCount: number;
  bundelDealValue: number; // volledige deal value van bundels
  bundelEngValue: number; // enkel de engineering-productwaarde binnen die bundels
};

export function getEngineeringBundleSplit(period: Period, themeKey?: string, scope: EngScope = "all"): BundleSplit {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("bl_h");
  const th = engTheme(themeKey, "deals", "blt");

  const wonDeals = db
    .prepare(
      `SELECT id, account_key, value FROM deals
       WHERE ${engLeadScope(scope)} AND status='won' AND won_time >= @from AND won_time < @to ${h.clause} ${th.clause}`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];

  // producten per deal
  const prodByDeal = new Map<string, { depts: Set<string>; engSum: number }>();
  for (const p of db
    .prepare("SELECT account_key, deal_id, department, line_sum FROM deal_products WHERE account_key IN ('unabo','tknburo')")
    .all() as any[]) {
    const key = p.account_key + ":" + p.deal_id;
    let e = prodByDeal.get(key);
    if (!e) {
      e = { depts: new Set(), engSum: 0 };
      prodByDeal.set(key, e);
    }
    e.depts.add(p.department);
    // engineering-waarde: bij UNABO enkel ENGINEERING-producten; bij TKN alle producten
    if (p.account_key === "tknburo" || p.department === "ENGINEERING") e.engSum += p.line_sum || 0;
  }

  const out: BundleSplit = { losCount: 0, losValue: 0, bundelCount: 0, bundelDealValue: 0, bundelEngValue: 0 };
  for (const d of wonDeals) {
    const info = prodByDeal.get(d.account_key + ":" + d.id) || { depts: new Set<string>(), engSum: 0 };
    // bundel = UNABO-deal met producten uit meerdere afdelingen; TKN = altijd los
    const isBundle = d.account_key === "unabo" && info.depts.size > 1;
    if (isBundle) {
      out.bundelCount++;
      out.bundelDealValue += d.value || 0;
      out.bundelEngValue += info.engSum;
    } else {
      out.losCount++;
      out.losValue += info.engSum;
    }
  }
  out.losValue = Math.round(out.losValue);
  out.bundelDealValue = Math.round(out.bundelDealValue);
  out.bundelEngValue = Math.round(out.bundelEngValue);
  return out;
}

// UNABO-only engineering lead-scope (custom-veld-analyses: enkel UNABO heeft die velden)
const ENG_UNABO_SCOPE =
  "account_key='unabo' AND (id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department='ENGINEERING') OR pipeline_name='UNABO-Engineering')";

// ---------- Engineering: motivatie bij verlies (UNABO custom fields, enkel 2026) ----------
export type EngMotivation = {
  influenceable: { label: string; count: number }[];
  cause: { label: string; count: number }[];
  total: number;
  filledInfluenceable: number;
  outside2026: boolean;
};
export function getEngineeringMotivation(period: Period, scope: EngScope = "all"): EngMotivation {
  // Deze velden bestaan enkel bij UNABO — bij TKN-only scope tonen we niets.
  if (scope === "tkn") return { influenceable: [], cause: [], total: 0, filledInfluenceable: 0, outside2026: false };
  const db = getDb();
  const { from, to } = periodBounds(period);
  const from26 = from < "2026-01-01" ? "2026-01-01" : from;
  const to26 = to > "2027-01-01" ? "2027-01-01" : to;
  if (from26 >= to26) return { influenceable: [], cause: [], total: 0, filledInfluenceable: 0, outside2026: true };
  const h = engHidden("mo_h");
  const rows = db
    .prepare(
      `SELECT custom_json FROM deals
       WHERE ${ENG_UNABO_SCOPE} AND status='lost' AND lost_time>=@from AND lost_time<@to ${h.clause}`
    )
    .all({ from: from26, to: to26, ...h.named }) as any[];
  const inflMap = new Map<string, number>();
  const causeMap = new Map<string, number>();
  let filledInfluenceable = 0;
  for (const r of rows) {
    if (!r.custom_json) continue;
    let c: any = {};
    try {
      c = JSON.parse(r.custom_json);
    } catch {}
    if (c.lost_influenceable) {
      filledInfluenceable++;
      inflMap.set(c.lost_influenceable, (inflMap.get(c.lost_influenceable) || 0) + 1);
    }
    if (c.lost_cause) causeMap.set(c.lost_cause, (causeMap.get(c.lost_cause) || 0) + 1);
  }
  const sort = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  return { influenceable: sort(inflMap), cause: sort(causeMap), total: rows.length, filledInfluenceable, outside2026: false };
}

// ---------- Engineering: projecttype (NIEUW — nog niet volledig gevuld) ----------
export type EngProjectType = {
  total: number;
  gebouwtype: { label: string; count: number }[];
  gebouwtypeFilled: number;
  typeAanvraag: { label: string; count: number }[];
  typeAanvraagFilled: number;
};
export function getEngineeringProjectType(period: Period, themeKey?: string, scope: EngScope = "all"): EngProjectType {
  // Gebouwtype/type-aanvraag zijn UNABO-velden — bij TKN-only scope niets tonen.
  if (scope === "tkn") return { total: 0, gebouwtype: [], gebouwtypeFilled: 0, typeAanvraag: [], typeAanvraagFilled: 0 };
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("pt_h");
  const th = engTheme(themeKey, "deals", "ptt");
  const rows = db
    .prepare(
      `SELECT custom_json FROM deals
       WHERE ${ENG_UNABO_SCOPE} AND add_time>=@from AND add_time<@to ${h.clause} ${th.clause}`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];
  const gMap = new Map<string, number>();
  const tMap = new Map<string, number>();
  let gFilled = 0;
  let tFilled = 0;
  for (const r of rows) {
    if (!r.custom_json) continue;
    let c: any = {};
    try {
      c = JSON.parse(r.custom_json);
    } catch {}
    if (c.gebouwtype) {
      gFilled++;
      gMap.set(c.gebouwtype, (gMap.get(c.gebouwtype) || 0) + 1);
    }
    if (c.type_aanvraag) {
      tFilled++;
      tMap.set(c.type_aanvraag, (tMap.get(c.type_aanvraag) || 0) + 1);
    }
  }
  const sort = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  return { total: rows.length, gebouwtype: sort(gMap), gebouwtypeFilled: gFilled, typeAanvraag: sort(tMap), typeAanvraagFilled: tFilled };
}

// ---------- Engineering: offerte-teller + tijd aanvraag -> offerte ----------
export type EngOfferte = { leadCount: number; offerteCount: number; avgDaysToOfferte: number | null; timingSample: number; exact: boolean };
export function getEngineeringOfferteStats(period: Period, themeKey?: string, scope: EngScope = "all"): EngOfferte {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("of_h");
  const th = engTheme(themeKey, "deals", "oft");

  // exacte offerte-tijdstippen uit de deal-flow (wanneer de deal in een offerte-fase kwam)
  const flow = new Map<string, string>();
  for (const f of db.prepare("SELECT account_key, deal_id, offerte_time FROM deal_flow WHERE offerte_time IS NOT NULL").all() as any[]) {
    flow.set(f.account_key + ":" + f.deal_id, f.offerte_time);
  }

  // offerte-drempel per pipeline (laagste stage_order van een offerte-fase)
  const stages = db
    .prepare(
      `SELECT DISTINCT account_key, pipeline_name, stage_name, stage_order
       FROM deals WHERE account_key IN ('unabo','tknburo') AND stage_name IS NOT NULL`
    )
    .all() as any[];
  const threshold = new Map<string, number>();
  for (const s of stages) {
    if (isOfferteStage(s.stage_name) && s.stage_order != null) {
      const key = s.account_key + "|" + s.pipeline_name;
      const cur = threshold.get(key);
      if (cur == null || s.stage_order < cur) threshold.set(key, s.stage_order);
    }
  }

  const rows = db
    .prepare(
      `SELECT id, status, pipeline_name, account_key, stage_name, stage_order, add_time
       FROM deals WHERE ${engLeadScope(scope)} AND add_time>=@from AND add_time<@to ${h.clause} ${th.clause}`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];

  let offerteCount = 0;
  let daysSum = 0;
  let timingSample = 0;
  for (const r of rows) {
    const thr = threshold.get(r.account_key + "|" + r.pipeline_name);
    const reached =
      r.status === "won" ||
      isOfferteStage(r.stage_name) ||
      (thr != null && r.stage_order != null && r.stage_order >= thr);
    if (reached) offerteCount++;
    // exacte timing: aanvraag -> moment dat de offerte de deur uit ging (uit deal-flow)
    const ot = flow.get(r.account_key + ":" + r.id);
    if (ot && r.add_time) {
      const d =
        (new Date(String(ot).replace(" ", "T") + "Z").getTime() -
          new Date(String(r.add_time).replace(" ", "T") + "Z").getTime()) /
        86400000;
      if (d >= 0 && d < 3650) {
        daysSum += d;
        timingSample++;
      }
    }
  }
  return {
    leadCount: rows.length,
    offerteCount,
    avgDaysToOfferte: timingSample ? Math.round(daysSum / timingSample) : null,
    timingSample,
    exact: timingSample > 0,
  };
}

// ---------- Engineering: timing van aanvragen (welke dag / welk uur) ----------
export type EngTiming = { byWeekday: { label: string; count: number }[]; byHour: { label: string; count: number }[]; total: number };
export function getEngineeringTiming(period: Period, themeKey?: string, scope: EngScope = "all"): EngTiming {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("tm_h");
  const th = engTheme(themeKey, "deals", "tmt");
  const rows = db
    .prepare(`SELECT add_time FROM deals WHERE ${engLeadScope(scope)} AND add_time>=@from AND add_time<@to ${h.clause} ${th.clause}`)
    .all({ from, to, ...h.named, ...th.named }) as any[];

  const wk = new Array(7).fill(0); // Ma..Zo
  const hr = new Array(24).fill(0);
  const wkIdx: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", hour12: false });
  let total = 0;
  for (const r of rows) {
    if (!r.add_time) continue;
    const d = new Date(String(r.add_time).replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) continue;
    const parts = fmt.formatToParts(d);
    const w = parts.find((p) => p.type === "weekday")?.value || "";
    const hStr = parts.find((p) => p.type === "hour")?.value || "0";
    if (!(w in wkIdx)) continue;
    wk[wkIdx[w]]++;
    hr[Number(hStr) % 24]++;
    total++;
  }
  return {
    byWeekday: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((l, i) => ({ label: l, count: wk[i] })),
    byHour: Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, "0"), count: hr[i] })),
    total,
  };
}

// ---------- TKN-Buro: verdeling Tekenwerk vs. Stabiliteitsstudie (per pipeline) ----------
export type TknSplitRow = { category: string; pipeline: string; requests: number; won: number; lost: number; omzet: number };
export function getEngineeringTknSplit(period: Period): TknSplitRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const cats: [string, string][] = [
    ["Tekenwerk", "TKN-Tekenwerk"],
    ["Stabiliteitsstudie", "TKN-Stabiliteitsstudie"],
  ];
  const map = new Map<string, TknSplitRow>(
    cats.map(([label, pl]) => [pl, { category: label, pipeline: pl, requests: 0, won: 0, lost: 0, omzet: 0 }])
  );
  const rows = db
    .prepare(
      `SELECT pipeline_name, status, add_time, won_time, lost_time
       FROM deals
       WHERE account_key='tknburo' AND pipeline_name IN ('TKN-Tekenwerk','TKN-Stabiliteitsstudie')`
    )
    .all() as any[];
  for (const r of rows) {
    const e = map.get(r.pipeline_name);
    if (!e) continue;
    if (r.add_time >= from && r.add_time < to) e.requests++;
    if (r.status === "won" && r.won_time >= from && r.won_time < to) e.won++;
    if (r.status === "lost" && r.lost_time >= from && r.lost_time < to) e.lost++;
  }
  const omz = db
    .prepare(
      `SELECT d.pipeline_name AS pn, SUM(p.line_sum) AS s
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE d.account_key='tknburo' AND d.status='won' AND d.won_time>=@from AND d.won_time<@to
         AND d.pipeline_name IN ('TKN-Tekenwerk','TKN-Stabiliteitsstudie')
       GROUP BY d.pipeline_name`
    )
    .all({ from, to }) as any[];
  for (const o of omz) {
    const e = map.get(o.pn);
    if (e) e.omzet = Math.round(o.s || 0);
  }
  return Array.from(map.values());
}

// ---------- Engineering: regio (projectadres uit deal-titel -> provincie + punt op de kaart) ----------
export type RegionRow = { province: string; won: number; open: number; lost: number; total: number };
export type RegionStatus = "won" | "open" | "lost";
export type RegionPoint = {
  id: number;
  lat: number;
  lng: number;
  status: RegionStatus;
  firma?: string; // firma-naam (voor de globale kaart, kleuren per firma)
  client: string;
  address: string;
  city: string;
  pipeline: string;
  value: number;
  currency: string;
  url: string;
  products: string[];
};
export type B2BOffice = { id: number; name: string; lat: number; lng: number; city: string; count: number; url: string };
export type UnplacedDeal = { id: number; title: string; client: string; status: RegionStatus; url: string };
export type EngRegion = {
  rows: RegionRow[];
  points: RegionPoint[];
  b2bOffices: B2BOffice[];
  unplacedDeals: UnplacedDeal[];
  placed: number; // met herkenbare provincie
  plotted: number; // effectief als punt op de kaart (postcode-coördinaat gevonden)
  unplaced: number;
  total: number;
};

const UNABO_ADDR_HASH = "851a82ca35b98f6f166752733ad0498887b2fc8c";

export function getEngineeringRegion(period: Period, themeKey?: string, scope: EngScope = "all"): EngRegion {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = engHidden("rg_h");
  const th = engTheme(themeKey, "deals", "rgt");
  // deals die in de periode vallen volgens hun status-datum (zelfde attributie als de KPI's)
  const rows = db
    .prepare(
      `SELECT id, account_key, title, status, value, currency, pipeline_name, raw
       FROM deals
       WHERE ${engLeadScope(scope)}
         AND ( (status='won'  AND won_time  >= @from AND won_time  < @to)
            OR (status='lost' AND lost_time >= @from AND lost_time < @to)
            OR (status='open' AND add_time  >= @from AND add_time  < @to) )
         ${h.clause} ${th.clause}`
    )
    .all({ from, to, ...h.named, ...th.named }) as any[];

  // producten per deal (voor de pop-up)
  const prodByDeal = new Map<string, string[]>();
  for (const p of db
    .prepare("SELECT account_key, deal_id, name FROM deal_products WHERE account_key IN ('unabo','tknburo') AND name IS NOT NULL")
    .all() as any[]) {
    const key = p.account_key + ":" + p.deal_id;
    const arr = prodByDeal.get(key) || [];
    const clean = String(p.name).replace(/^ENGINEERING:\s*/i, "").trim();
    if (clean && !arr.includes(clean)) arr.push(clean);
    prodByDeal.set(key, arr);
  }

  // organisatie-adressen (met coördinaat) voor de B2B-laag
  const orgMap = new Map<string, { name: string; city: string; lat: number; lng: number }>();
  for (const o of db
    .prepare("SELECT account_key, id, name, city, lat, lng FROM organizations WHERE lat IS NOT NULL")
    .all() as any[]) {
    orgMap.set(o.account_key + ":" + o.id, { name: o.name || "", city: o.city || "", lat: o.lat, lng: o.lng });
  }

  const provMap = new Map<string, RegionRow>();
  const points: RegionPoint[] = [];
  const b2bMap = new Map<string, B2BOffice>();
  const unplacedDeals: UnplacedDeal[] = [];
  let placed = 0;
  let unplaced = 0;
  let plotted = 0;
  for (const r of rows) {
    let raw: any = {};
    try {
      raw = JSON.parse(r.raw || "{}");
    } catch {}
    const status: RegionStatus = r.status === "won" ? "won" : r.status === "lost" ? "lost" : "open";
    const client = raw.org_name || raw.person_name || "(onbekend)";
    const domain = domainByKey[r.account_key] || "";
    const orgId = raw.org_id && typeof raw.org_id === "object" ? raw.org_id.value : raw.org_id;
    const pcField = r.account_key === "unabo" ? raw[UNABO_ADDR_HASH + "_postal_code"] || null : null;
    const loc = parseProjectLocation(r.title, pcField);
    if (!loc) {
      unplaced++;
      if (unplacedDeals.length < 500) {
        unplacedDeals.push({
          id: r.id,
          title: r.title || "(zonder titel)",
          client,
          status,
          url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "",
        });
      }
      // B2B-kantoor via organisatie-adres
      if (orgId) {
        const org = orgMap.get(r.account_key + ":" + orgId);
        if (org) {
          const key = r.account_key + ":" + orgId;
          let b = b2bMap.get(key);
          if (!b) {
            b = {
              id: orgId,
              name: org.name || client,
              lat: org.lat,
              lng: org.lng,
              city: org.city,
              count: 0,
              url: domain ? `https://${domain}.pipedrive.com/organization/${orgId}` : "",
            };
            b2bMap.set(key, b);
          }
          b.count++;
        }
      }
      continue;
    }
    placed++;
    let pr = provMap.get(loc.province);
    if (!pr) {
      pr = { province: loc.province, won: 0, open: 0, lost: 0, total: 0 };
      provMap.set(loc.province, pr);
    }
    pr[status]++;
    pr.total++;

    const coord = POSTCODE_COORDS[loc.postcode];
    if (coord) {
      plotted++;
      points.push({
        id: r.id,
        lat: coord[0],
        lng: coord[1],
        status,
        client,
        address: r.title || "",
        city: loc.city,
        pipeline: r.pipeline_name || "",
        value: Math.round(r.value || 0),
        currency: r.currency || "EUR",
        url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "",
        products: prodByDeal.get(r.account_key + ":" + r.id) || [],
      });
    }
  }
  return {
    rows: Array.from(provMap.values()).sort((a, b) => b.total - a.total),
    points,
    b2bOffices: Array.from(b2bMap.values()).sort((a, b) => b.count - a.count),
    unplacedDeals,
    placed,
    plotted,
    unplaced,
    total: placed + unplaced,
  };
}

// ---------- Globale kaart: ALLE deals van ALLE firma's (projectadres uit titel) ----------
export type GlobalMap = { points: RegionPoint[]; byFirma: { firma: string; count: number }[]; plotted: number; unplaced: number; total: number };
export function getGlobalMap(accountKey: string, status: "won" | "open" | "lost" | "all"): GlobalMap {
  const db = getDb();
  const accClause = accountKey === "all" ? "" : "AND account_key = @acc";
  const rows = db
    .prepare(`SELECT id, account_key, title, status, value, currency, pipeline_name, raw FROM deals WHERE 1=1 ${accClause}`)
    .all(accountKey === "all" ? {} : { acc: accountKey }) as any[];

  const points: RegionPoint[] = [];
  const firmaCount = new Map<string, number>();
  let plotted = 0;
  let unplaced = 0;
  let total = 0;
  for (const r of rows) {
    const st: RegionStatus = r.status === "won" ? "won" : r.status === "lost" ? "lost" : "open";
    if (status !== "all" && st !== status) continue;
    total++;
    let raw: any = {};
    try {
      raw = JSON.parse(r.raw || "{}");
    } catch {}
    const pcField = r.account_key === "unabo" ? raw[UNABO_ADDR_HASH + "_postal_code"] || null : null;
    const loc = parseProjectLocation(r.title, pcField);
    const coord = loc ? POSTCODE_COORDS[loc.postcode] : undefined;
    if (!loc || !coord) {
      unplaced++;
      continue;
    }
    plotted++;
    const firma = nameByKey[r.account_key] || r.account_key;
    firmaCount.set(firma, (firmaCount.get(firma) || 0) + 1);
    const domain = domainByKey[r.account_key] || "";
    points.push({
      id: r.id,
      lat: coord[0],
      lng: coord[1],
      status: st,
      firma,
      client: raw.org_name || raw.person_name || "(onbekend)",
      address: r.title || "",
      city: loc.city,
      pipeline: r.pipeline_name || "",
      value: Math.round(r.value || 0),
      currency: r.currency || "EUR",
      url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "",
      products: [],
    });
  }
  return {
    points,
    byFirma: Array.from(firmaCount.entries())
      .map(([firma, count]) => ({ firma, count }))
      .sort((a, b) => b.count - a.count),
    plotted,
    unplaced,
    total,
  };
}

// ---------- Sync-status ----------
export type SyncStatus = {
  account_key: string;
  name: string;
  last_sync: string | null;
  deal_count: number;
  status: string | null;
  message: string | null;
};

export function getSyncStatus(): SyncStatus[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM sync_meta").all() as any[];
  const byKey = new Map(rows.map((r) => [r.account_key, r]));
  return ACCOUNTS.map((a) => {
    const r = byKey.get(a.key);
    return {
      account_key: a.key,
      name: a.name,
      last_sync: r?.last_sync ?? null,
      deal_count: r?.deal_count ?? 0,
      status: r?.status ?? null,
      message: r?.message ?? null,
    };
  });
}

export function hasData(): boolean {
  const db = getDb();
  const r = db.prepare("SELECT COUNT(*) AS c FROM deals").get() as any;
  return (r?.c || 0) > 0;
}
