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
  type EngOfferte,
  type BundleSplit,
  type EngMotivation,
  type EngProjectType,
  type EngRegion,
  type RegionRow,
  type RegionPoint,
  type RegionStatus,
  type B2BOffice,
  type UnplacedDeal,
  UNABO_ADDR_HASH,
} from "./queries";
import { HIDDEN_PIPELINES } from "./hiddenPipelines";
import { channelsInfoForLabels, isOfferteStage } from "./engineeringConfig";
import { parseProjectLocation } from "./regio";
import { POSTCODE_COORDS } from "./postcodeCoords";
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
// Geëxporteerd omdat de concurrentiemonitor exact dezelfde afbakening moet
// gebruiken: anders vergelijk je onze projecten met een andere dealverzameling
// dan de rest van de Energy-tab toont.
export const LEAD_SCOPE =
  "(account_key='unabo' AND (" +
  "id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department='" +
  DEPT +
  // Spaties wegnormaliseren: de pipeline heet "UNABO - Energy" in Pipedrive,
  // niet "UNABO-Energy". Zonder dit vielen de leads zonder product weg.
  "') OR REPLACE(pipeline_name, ' ', '')='" +
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

// ---------- Offertes: teller + tijd aanvraag -> offerte ----------
// Zelfde afleiding als Engineering: een offerte is "verstuurd" zodra de deal in een
// offerte-fase zit of erlangs is (fase-volgorde), of gewonnen is. Exacte timing komt
// uit deal_flow (fase-historiek), die sinds sept 2026 ook voor Energy-deals gevuld wordt.
export function getEnergyOfferteStats(period: Period): EngOfferte {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("eof_h");

  const flow = new Map<number, string>();
  for (const f of db.prepare("SELECT deal_id, offerte_time FROM deal_flow WHERE account_key='unabo' AND offerte_time IS NOT NULL").all() as any[]) {
    flow.set(f.deal_id, f.offerte_time);
  }

  // offerte-drempel per pipeline (laagste stage_order van een offerte-fase)
  const stages = db
    .prepare("SELECT DISTINCT pipeline_name, stage_name, stage_order FROM deals WHERE account_key='unabo' AND stage_name IS NOT NULL")
    .all() as any[];
  const threshold = new Map<string, number>();
  for (const s of stages) {
    if (isOfferteStage(s.stage_name) && s.stage_order != null) {
      const cur = threshold.get(s.pipeline_name);
      if (cur == null || s.stage_order < cur) threshold.set(s.pipeline_name, s.stage_order);
    }
  }

  const rows = db
    .prepare(
      `SELECT id, status, pipeline_name, stage_name, stage_order, add_time
       FROM deals WHERE ${LEAD_SCOPE} AND add_time>=@from AND add_time<@to ${h.clause}`
    )
    .all({ from, to, ...h.named }) as any[];

  let offerteCount = 0;
  let daysSum = 0;
  let timingSample = 0;
  for (const r of rows) {
    const thr = threshold.get(r.pipeline_name);
    const reached =
      r.status === "won" || isOfferteStage(r.stage_name) || (thr != null && r.stage_order != null && r.stage_order >= thr);
    if (reached) offerteCount++;
    const ot = flow.get(r.id);
    if (ot && r.add_time) {
      const d =
        (new Date(String(ot).replace(" ", "T") + "Z").getTime() - new Date(String(r.add_time).replace(" ", "T") + "Z").getTime()) /
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

// ---------- Bundel vs. los (gewonnen) ----------
// Los = ENERGY is de enige afdeling op de deal; bundel = samen met andere afdelingen
// (typisch de pipeline "UNABO - Bundel": EPB + ventilatie + engineering in één offerte).
// Bij bundels tonen we zowel de volledige deal value als het Energy-aandeel.
export function getEnergyBundleSplit(period: Period): BundleSplit {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("ebs_h");
  const wonDeals = db
    .prepare(`SELECT id, value FROM deals WHERE ${LEAD_SCOPE} AND status='won' AND won_time >= @from AND won_time < @to ${h.clause}`)
    .all({ from, to, ...h.named }) as any[];

  const prodByDeal = new Map<number, { depts: Set<string>; energySum: number }>();
  for (const p of db.prepare("SELECT deal_id, department, line_sum FROM deal_products WHERE account_key='unabo'").all() as any[]) {
    let e = prodByDeal.get(p.deal_id);
    if (!e) {
      e = { depts: new Set(), energySum: 0 };
      prodByDeal.set(p.deal_id, e);
    }
    e.depts.add(p.department);
    if (p.department === DEPT) e.energySum += p.line_sum || 0;
  }

  const out: BundleSplit = { losCount: 0, losValue: 0, bundelCount: 0, bundelDealValue: 0, bundelEngValue: 0 };
  for (const d of wonDeals) {
    const info = prodByDeal.get(d.id) || { depts: new Set<string>(), energySum: 0 };
    if (info.depts.size > 1) {
      out.bundelCount++;
      out.bundelDealValue += d.value || 0;
      out.bundelEngValue += info.energySum;
    } else {
      out.losCount++;
      out.losValue += info.energySum;
    }
  }
  out.losValue = Math.round(out.losValue);
  out.bundelDealValue = Math.round(out.bundelDealValue);
  out.bundelEngValue = Math.round(out.bundelEngValue);
  return out;
}

// ---------- Motivatie bij verlies (UNABO custom fields, enkel 2026) ----------
export function getEnergyMotivation(period: Period): EngMotivation {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const from26 = from < "2026-01-01" ? "2026-01-01" : from;
  const to26 = to > "2027-01-01" ? "2027-01-01" : to;
  if (from26 >= to26) return { influenceable: [], cause: [], total: 0, filledInfluenceable: 0, outside2026: true };
  const h = hidden("emo_h");
  const rows = db
    .prepare(`SELECT custom_json FROM deals WHERE ${LEAD_SCOPE} AND status='lost' AND lost_time>=@from AND lost_time<@to ${h.clause}`)
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

// ---------- Projecttype (gebouwtype / type aanvraag — nog niet volledig gevuld) ----------
export function getEnergyProjectType(period: Period): EngProjectType {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("ept_h");
  const rows = db
    .prepare(`SELECT custom_json FROM deals WHERE ${LEAD_SCOPE} AND add_time>=@from AND add_time<@to ${h.clause}`)
    .all({ from, to, ...h.named }) as any[];
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

// ---------- Regio: projectlocaties (postcode-veld of adres in de titel) ----------
export function getEnergyRegion(period: Period): EngRegion {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("erg_h");
  // deals die in de periode vallen volgens hun status-datum (zelfde attributie als de KPI's)
  const rows = db
    .prepare(
      `SELECT id, account_key, title, status, value, currency, pipeline_name, raw
       FROM deals
       WHERE ${LEAD_SCOPE}
         AND ( (status='won'  AND won_time  >= @from AND won_time  < @to)
            OR (status='lost' AND lost_time >= @from AND lost_time < @to)
            OR (status='open' AND add_time  >= @from AND add_time  < @to) )
         ${h.clause}`
    )
    .all({ from, to, ...h.named }) as any[];

  const prodByDeal = new Map<number, string[]>();
  for (const p of db.prepare("SELECT deal_id, name FROM deal_products WHERE account_key='unabo' AND name IS NOT NULL").all() as any[]) {
    const arr = prodByDeal.get(p.deal_id) || [];
    const clean = String(p.name).replace(/^ENERGY:\s*/i, "").trim();
    if (clean && !arr.includes(clean)) arr.push(clean);
    prodByDeal.set(p.deal_id, arr);
  }

  const orgMap = new Map<number, { name: string; city: string; lat: number; lng: number }>();
  for (const o of db.prepare("SELECT id, name, city, lat, lng FROM organizations WHERE account_key='unabo' AND lat IS NOT NULL").all() as any[]) {
    orgMap.set(o.id, { name: o.name || "", city: o.city || "", lat: o.lat, lng: o.lng });
  }

  const domain = domainByKey["unabo"] || "";
  const provMap = new Map<string, RegionRow>();
  const points: RegionPoint[] = [];
  const b2bMap = new Map<number, B2BOffice>();
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
    const orgId = raw.org_id && typeof raw.org_id === "object" ? raw.org_id.value : raw.org_id;
    const loc = parseProjectLocation(r.title, raw[UNABO_ADDR_HASH + "_postal_code"] || null);
    if (!loc) {
      unplaced++;
      if (unplacedDeals.length < 500) {
        unplacedDeals.push({ id: r.id, title: r.title || "(zonder titel)", client, status, url: domain ? `https://${domain}.pipedrive.com/deal/${r.id}` : "" });
      }
      if (orgId) {
        const org = orgMap.get(orgId);
        if (org) {
          let b = b2bMap.get(orgId);
          if (!b) {
            b = { id: orgId, name: org.name || client, lat: org.lat, lng: org.lng, city: org.city, count: 0, url: domain ? `https://${domain}.pipedrive.com/organization/${orgId}` : "" };
            b2bMap.set(orgId, b);
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
        products: prodByDeal.get(r.id) || [],
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

// ---------- Trechter per fase (conversie per fase + tijd in huidige fase) ----------
// Per pipeline waarin Energy-leads zitten (UNABO - Energy, UNABO - Bundel). "Bereikt" =
// het aantal leads uit de periode dat minstens tot die fase is geraakt: gewonnen deals
// zijn tot het einde geraakt, open en verloren deals staan (bleven staan) in hun huidige
// fase. Pipedrive bewaart per deal alleen de huidige fase, dus dit is een afleiding uit
// de fase-volgorde — de volledige fase-historiek per deal zit niet in de sync.
export type FunnelStage = {
  stage: string;
  order: number;
  reached: number; // leads die minstens tot hier geraakten
  open: number; // staan nu in deze fase
  lost: number; // vielen in deze fase af
  won: number;
  pctOfLeads: number | null; // bereikt / totaal leads
  pctOfPrev: number | null; // bereikt / bereikt vorige fase (doorstroom)
  avgDaysInStage: number | null; // open deals: gem. dagen sinds laatste fase-wissel
};
export type PipelineFunnel = { pipeline: string; leads: number; stages: FunnelStage[] };

export function getEnergyFunnel(period: Period): PipelineFunnel[] {
  const db = getDb();
  const { from, to } = periodBounds(period);
  const h = hidden("efn_h");

  // volledige fase-lijst per pipeline (over alle tijd, anders ontbreken lege fasen)
  const stageRows = db
    .prepare(
      `SELECT DISTINCT pipeline_name, stage_name, stage_order FROM deals
       WHERE ${LEAD_SCOPE} AND stage_name IS NOT NULL AND stage_order IS NOT NULL ${h.clause}
       ORDER BY pipeline_name, stage_order`
    )
    .all({ ...h.named }) as any[];
  const stagesByPipeline = new Map<string, { stage: string; order: number }[]>();
  for (const s of stageRows) {
    const arr = stagesByPipeline.get(s.pipeline_name) || [];
    if (!arr.some((x) => x.order === s.stage_order)) arr.push({ stage: s.stage_name, order: s.stage_order });
    stagesByPipeline.set(s.pipeline_name, arr);
  }

  const deals = db
    .prepare(
      `SELECT pipeline_name, status, stage_order,
              json_extract(raw,'$.stage_change_time') AS stage_change_time
       FROM deals WHERE ${LEAD_SCOPE} AND add_time>=@from AND add_time<@to AND stage_order IS NOT NULL ${h.clause}`
    )
    .all({ from, to, ...h.named }) as any[];

  const now = Date.now();
  const out: PipelineFunnel[] = [];
  for (const [pipeline, stages] of stagesByPipeline) {
    const mine = deals.filter((d) => d.pipeline_name === pipeline);
    if (mine.length === 0) continue;
    let prev: number | null = null;
    const fs: FunnelStage[] = stages.map((s) => {
      let reached = 0;
      let open = 0;
      let lost = 0;
      let won = 0;
      let daysSum = 0;
      let daysN = 0;
      for (const d of mine) {
        const isWon = d.status === "won";
        if (isWon || d.stage_order >= s.order) reached++;
        if (d.stage_order === s.order) {
          if (isWon) won++;
          else if (d.status === "lost") lost++;
          else {
            open++;
            if (d.stage_change_time) {
              const t = new Date(String(d.stage_change_time).replace(" ", "T") + "Z").getTime();
              if (!isNaN(t)) {
                daysSum += (now - t) / 86400000;
                daysN++;
              }
            }
          }
        }
      }
      const row: FunnelStage = {
        stage: s.stage,
        order: s.order,
        reached,
        open,
        lost,
        won,
        pctOfLeads: mine.length ? Math.round((reached / mine.length) * 100) : null,
        pctOfPrev: prev != null && prev > 0 ? Math.round((reached / prev) * 100) : null,
        avgDaysInStage: daysN ? Math.round(daysSum / daysN) : null,
      };
      prev = reached;
      return row;
    });
    out.push({ pipeline, leads: mine.length, stages: fs });
  }
  // grootste pipeline eerst
  return out.sort((a, b) => b.leads - a.leads);
}

// periodRange wordt in de page gebruikt voor het periode-label; hier doorgeven zodat
// de Energy-page enkel uit deze module hoeft te importeren voor de data.
export { periodRange };
