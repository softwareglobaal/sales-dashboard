// ---------- Energy (UNABO Energy) — afdelings-querymodule ----------
//
// Zelfde denkwijze en datum-regels als Engineering (zie DASHBOARD-SPEC.md), maar
// afgebakend tot UNABO en de afdeling ENERGY. Bewust een APART bestand zodat de
// Engineering-logica ongemoeid blijft; gedeelde, generieke helpers worden uit
// queries.ts geïmporteerd i.p.v. gedupliceerd.
//
// Scope-definities (spiegelt Engineering):
//  - Lead-scope (aantallen): UNABO-deals met een ENERGY-product ÓF in de pipeline
//    UNABO-Energy. Zo tellen "plannen op aanvraag" zonder product óók als lead.
//  - Omzet-scope (waarde/diensten): UNABO ENERGY-productregels; omzet = product-prijs.
//  - Verborgen UNABO-pipelines (SETUP, ARCHIVE, …) worden uitgesloten.

import { getDb } from "./db";
import {
  periodBounds,
  periodRange,
  parseYmd,
  mondayOf,
  isoWeek,
  domainByKey,
  nameByKey,
  MONTH_NAMES,
  type Period,
  type ServiceRow,
  type ChannelRow,
  type ChannelSub,
  type ActivityRow,
  type ActivityGranularity,
  type DealMini,
  type EngKpisDelta,
  type EngKpis,
  type EngLostReasons,
  type LostDeal,
  type EngTiming,
} from "./queries";
import { HIDDEN_PIPELINES } from "./hiddenPipelines";
import { channelsInfoForLabels } from "./engineeringConfig";
import { normalizeLossReason } from "./lossReasons";

const DEPT = "ENERGY";
const PIPELINE = "UNABO-Energy";

// Verborgen UNABO-pipelines als named params (met vrij te kiezen prefix).
function hidden(prefix: string): { clause: string; named: Record<string, string> } {
  const names = HIDDEN_PIPELINES["unabo"] || [];
  const named: Record<string, string> = {};
  const keys = names.map((n, i) => {
    const k = `${prefix}${i}`;
    named[k] = n;
    return `@${k}`;
  });
  const clause = keys.length ? ` AND (pipeline_name IS NULL OR pipeline_name NOT IN (${keys.join(", ")}))` : "";
  return { clause, named };
}

// Deal-niveau LEAD-scope (UNABO ENERGY-product óf UNABO-Energy-pipeline).
const LEAD_SCOPE =
  "(account_key='unabo' AND (" +
  "id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department='" +
  DEPT +
  "') OR pipeline_name='" +
  PIPELINE +
  "'))";

// Product-niveau scope (aliassen d = deals, p = deal_products).
const PRODUCT_SCOPE = "(d.account_key='unabo' AND p.department='" + DEPT + "')";

export function energyHasData(): boolean {
  const db = getDb();
  const r = db.prepare(`SELECT 1 FROM deals WHERE ${LEAD_SCOPE} LIMIT 1`).get();
  return !!r;
}

// ---------- KPI's (aanvragen = LEADS op add_time) ----------
function kpisForRange(from: string, to: string): EngKpis {
  const db = getDb();
  const h = hidden("ekpi_h");
  const cnt = db
    .prepare(
      `SELECT
         SUM(CASE WHEN add_time >= @from AND add_time < @to THEN 1 ELSE 0 END) AS requests,
         SUM(CASE WHEN status='won' AND won_time >= @from AND won_time < @to THEN 1 ELSE 0 END) AS wonCount,
         AVG(CASE WHEN status='won' AND won_time >= @from AND won_time < @to
                  THEN julianday(won_time) - julianday(add_time) END) AS avgDays
       FROM deals WHERE ${LEAD_SCOPE} ${h.clause}`
    )
    .get({ from, to, ...h.named }) as any;

  const val = db
    .prepare(
      `SELECT SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS wonValue
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${PRODUCT_SCOPE}`
    )
    .get({ from, to }) as any;

  return {
    requests: cnt?.requests || 0,
    wonCount: cnt?.wonCount || 0,
    wonValue: Math.round(val?.wonValue || 0),
    avgDays: cnt?.avgDays != null ? Math.round(cnt.avgDays) : null,
  };
}

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getEnergyKpisWithDelta(period: Period): EngKpisDelta {
  const { from, to } = periodBounds(period);
  const cur = kpisForRange(from, to);
  const today = isoDate(new Date());
  const eff = to > today ? today : to;
  const pct = (c: number, p: number): number | null => (p > 0 ? Math.round(((c - p) / p) * 100) : null);

  if (from <= "0001-01-01" || eff <= from) {
    return { ...cur, prev: null, dRequests: null, dWonCount: null, dWonValue: null };
  }
  const spanMs = parseYmd(eff).getTime() - parseYmd(from).getTime();
  const prevFrom = isoDate(new Date(parseYmd(from).getTime() - spanMs));
  const prev = kpisForRange(prevFrom, from);
  return {
    ...cur,
    prev,
    dRequests: pct(cur.requests, prev.requests),
    dWonCount: pct(cur.wonCount, prev.wonCount),
    dWonValue: pct(cur.wonValue, prev.wonValue),
  };
}

// ---------- Analyse per dienst (sub-diensten binnen ENERGY) ----------
function cleanServiceName(name: string | null): string {
  if (!name) return "(geen productnaam)";
  return name.replace(/^ENERGY:\s*/i, "").trim() || name;
}

export function getEnergyServices(period: Period): ServiceRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("esv_h");
  const rows = db
    .prepare(
      `SELECT
         'UNABO Energy' AS source,
         COALESCE(NULLIF(TRIM(p.name), ''), '(geen productnaam)') AS rawName,
         SUM(CASE WHEN d.add_time >= @from AND d.add_time < @to THEN 1 ELSE 0 END) AS requests,
         SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN 1 ELSE 0 END) AS soldCount,
         SUM(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to THEN p.line_sum ELSE 0 END) AS revenue,
         AVG(CASE WHEN d.status='won' AND d.won_time >= @from AND d.won_time < @to
                  THEN julianday(d.won_time) - julianday(d.add_time) END) AS avgDays
       FROM deal_products p
       JOIN deals d ON d.account_key = p.account_key AND d.id = p.deal_id
       WHERE ${PRODUCT_SCOPE} ${h.clause}
       GROUP BY rawName
       HAVING requests > 0 OR soldCount > 0
       ORDER BY revenue DESC`
    )
    .all({ from, to, ...h.named }) as any[];

  return rows.map((r) => ({
    service: cleanServiceName(r.rawName),
    source: r.source,
    requests: r.requests || 0,
    soldCount: r.soldCount || 0,
    revenue: Math.round(r.revenue || 0),
    avgDays: r.avgDays != null ? Math.round(r.avgDays) : null,
  }));
}

// ---------- Aanvragen + omzet per maand (same-month cohort) ----------
export function getEnergyByMonth(period: Period): { month: string; requests: number; revenue: number; wonCount: number }[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("ebm_h");

  const reqRows = db
    .prepare(
      `SELECT substr(add_time,1,7) AS month, COUNT(*) AS requests
       FROM deals
       WHERE ${LEAD_SCOPE} AND add_time >= @from AND add_time < @to ${h.clause}
       GROUP BY month`
    )
    .all({ from, to, ...h.named }) as any[];

  const revRows = db
    .prepare(
      `SELECT substr(d.add_time,1,7) AS month, SUM(p.line_sum) AS revenue, COUNT(DISTINCT d.id) AS wonCount
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${PRODUCT_SCOPE} AND d.status='won'
         AND substr(d.add_time,1,7) = substr(d.won_time,1,7)
         AND d.add_time >= @from AND d.add_time < @to
       GROUP BY month`
    )
    .all({ from, to }) as any[];

  const map = new Map<string, { month: string; requests: number; revenue: number; wonCount: number }>();
  for (const r of reqRows) if (r.month) map.set(r.month, { month: r.month, requests: r.requests || 0, revenue: 0, wonCount: 0 });
  for (const r of revRows) {
    if (!r.month) continue;
    const e = map.get(r.month) || { month: r.month, requests: 0, revenue: 0, wonCount: 0 };
    e.revenue = Math.round(r.revenue || 0);
    e.wonCount = r.wonCount || 0;
    map.set(r.month, e);
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// ---------- Aanvragen / gewonnen / verloren over tijd ----------
export function getEnergyActivity(period: Period, granularity: ActivityGranularity): ActivityRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("eac_h");

  const rows = db
    .prepare(
      `SELECT id, account_key, title, status, value, add_time, won_time, lost_time, raw
       FROM deals WHERE ${LEAD_SCOPE} ${h.clause}`
    )
    .all({ ...h.named }) as any[];

  const prodRows = db
    .prepare(
      `SELECT d.won_time AS won_time, p.line_sum AS line_sum
       FROM deal_products p JOIN deals d ON d.account_key=p.account_key AND d.id=p.deal_id
       WHERE ${PRODUCT_SCOPE} AND d.status='won'`
    )
    .all() as any[];

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
    if (dateStr < from || dateStr >= to) return null;
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

// ---------- Aanvragen per kanaal (tweelaags: hoofd/sub) ----------
export function getEnergyChannels(period: Period): ChannelRow[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("ech_h");
  const rows = db
    .prepare(
      `SELECT status, label_names
       FROM deals
       WHERE ${LEAD_SCOPE} AND add_time >= @from AND add_time < @to ${h.clause}`
    )
    .all({ from, to, ...h.named }) as any[];

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

// ---------- Verlies-redenen (ALLEEN 2026, genormaliseerd) ----------
export function getEnergyLostReasons(period: Period): EngLostReasons {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const from26 = from < "2026-01-01" ? "2026-01-01" : from;
  const to26 = to > "2027-01-01" ? "2027-01-01" : to;
  if (from26 >= to26) return { reasons: [], total: 0, outside2026: true };

  const h = hidden("elr_h");
  const rows = db
    .prepare(
      `SELECT id, account_key, pipeline_name, title, lost_reason
       FROM deals
       WHERE ${LEAD_SCOPE} AND status='lost' AND lost_time >= @from AND lost_time < @to ${h.clause}
       ORDER BY lost_time DESC`
    )
    .all({ from: from26, to: to26, ...h.named }) as any[];

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
    e.unabo++; // Energy is 100% UNABO
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

// ---------- Timing: wanneer komen aanvragen binnen (dag / uur, Belgische tijd) ----------
export function getEnergyTiming(period: Period): EngTiming {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("etm_h");
  const rows = db
    .prepare(`SELECT add_time FROM deals WHERE ${LEAD_SCOPE} AND add_time>=@from AND add_time<@to ${h.clause}`)
    .all({ from, to, ...h.named }) as any[];

  const wk = new Array(7).fill(0);
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

// periodRange wordt in de page gebruikt voor het periode-label; hier doorgeven zodat
// de Energy-page enkel uit deze module hoeft te importeren voor de data.
export { periodRange };
