import { getDb } from "./db";
import { periodRange, type Period } from "./queries";
import { AD_CATALOG, ADS_ACCOUNTS } from "./googleAdsConfig";

// Een periode is ofwel een Period van de agent-API (queries.ts), ofwel een
// concreet venster { van, tot } (tot exclusief) zoals de dienstlaag het geeft
// (lib/afdelingen.ts bereik()). De SEO/SEA-tab gebruikt dat laatste, zodat de
// periodeknoppen dezelfde zijn als op de dienstpagina's.
export type Venster = Period | { van: string; tot: string };

// Periode-grenzen als concrete datums (JJJJ-MM-DD). null -> heel ver weg.
function bounds(period: Venster): { from: string; to: string } {
  if (typeof period === "object") return { from: period.van, to: period.tot };
  const { from, to } = periodRange(period);
  return { from: from ?? "0000-01-01", to: to ?? "9999-12-31" };
}

// Alle query's hieronder nemen één Ads-account (databanksleutel, bv. 'unabo')
// of een lijst ervan. Een lijst telt de accounts op: zo staan UNABO en UNABO
// Regularisatie samen in de KPI's, terwijl de campagnetabel ze apart houdt.
type AccountSel = string | string[];
function keysOf(sel: AccountSel): string[] {
  const keys = Array.isArray(sel) ? sel : [sel];
  return keys.length > 0 ? keys : ["__geen__"];
}
function inClause(keys: string[]): string {
  return `(${keys.map(() => "?").join(",")})`;
}

export function adsHasData(sel: AccountSel = "unabo"): boolean {
  const db = getDb();
  const keys = keysOf(sel);
  const r = db.prepare(`SELECT COUNT(*) AS c FROM ad_metrics_daily WHERE account_key IN ${inClause(keys)}`).get(...keys) as any;
  return (r?.c || 0) > 0;
}

export type AdsSyncInfo = { account_key: string; last_sync: string | null; status: string; message: string | null };
export function getAdsSyncInfo(): AdsSyncInfo[] {
  const db = getDb();
  return db
    .prepare("SELECT account_key, last_sync, status, message FROM sync_meta WHERE account_key LIKE 'ads:%' ORDER BY account_key")
    .all() as AdsSyncInfo[];
}

export type AdsOverview = {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  convValue: number;
  ctr: number; // klik-doorklikratio (0..1)
  avgCpc: number; // gem. kost per klik
  costPerConv: number | null; // kost per (Google-)conversie
  activeCampaigns: number;
  totalCampaigns: number;
};

export function getAdsOverview(period: Venster, sel: AccountSel = "unabo"): AdsOverview {
  const db = getDb();
  const { from, to } = bounds(period);
  const keys = keysOf(sel);
  const m = db
    .prepare(
      `SELECT COALESCE(SUM(cost_micros),0) AS cost, COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(impressions),0) AS impr, COALESCE(SUM(conversions),0) AS conv,
              COALESCE(SUM(conv_value),0) AS convVal
       FROM ad_metrics_daily WHERE account_key IN ${inClause(keys)} AND date >= ? AND date < ?`
    )
    .get(...keys, from, to) as any;
  const camps = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status='ENABLED' THEN 1 ELSE 0 END) AS active,
         COUNT(*) AS total
       FROM ad_campaigns WHERE account_key IN ${inClause(keys)}`
    )
    .get(...keys) as any;

  const spend = (m.cost || 0) / 1e6;
  const clicks = m.clicks || 0;
  const impressions = m.impr || 0;
  const conversions = m.conv || 0;
  return {
    spend,
    clicks,
    impressions,
    conversions,
    convValue: m.convVal || 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgCpc: clicks > 0 ? spend / clicks : 0,
    costPerConv: conversions > 0 ? spend / conversions : null,
    activeCampaigns: camps?.active || 0,
    totalCampaigns: camps?.total || 0,
  };
}

export type AdCampaignRow = {
  accountKey: string; // Ads-account (databanksleutel)
  accountLabel: string;
  campaignId: string;
  name: string;
  status: string;
  channelType: string;
  finalUrl: string | null;
  serviceKey: string | null;
  serviceLabel: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  costPerConv: number | null;
  eersteDag: string | null; // eerste dag met kosten binnen de periode
};

const serviceLabelByKey = new Map(AD_CATALOG.map((s) => [s.key, s.label]));

export function getAdsCampaigns(period: Venster, sel: AccountSel = "unabo"): AdCampaignRow[] {
  const db = getDb();
  const { from, to } = bounds(period);
  const keys = keysOf(sel);
  const rows = db
    .prepare(
      `SELECT c.account_key AS accountKey, c.campaign_id AS campaignId, c.name AS name, c.status AS status,
              c.channel_type AS channelType, c.final_url AS finalUrl, c.service_key AS serviceKey,
              COALESCE(SUM(m.cost_micros),0) AS cost, COALESCE(SUM(m.clicks),0) AS clicks,
              COALESCE(SUM(m.impressions),0) AS impr, COALESCE(SUM(m.conversions),0) AS conv,
              MIN(CASE WHEN m.cost_micros > 0 THEN m.date END) AS eerste
       FROM ad_campaigns c
       LEFT JOIN ad_metrics_daily m
         ON m.account_key = c.account_key AND m.campaign_id = c.campaign_id
        AND m.date >= ? AND m.date < ?
       WHERE c.account_key IN ${inClause(keys)}
       GROUP BY c.account_key, c.campaign_id
       ORDER BY cost DESC, c.name ASC`
    )
    .all(from, to, ...keys) as any[];

  return rows.map((r) => {
    const spend = (r.cost || 0) / 1e6;
    const clicks = r.clicks || 0;
    const impressions = r.impr || 0;
    const conversions = r.conv || 0;
    return {
      accountKey: r.accountKey,
      accountLabel: adsAccountLabel(r.accountKey),
      campaignId: r.campaignId,
      name: r.name || "(naamloos)",
      status: r.status || "UNKNOWN",
      channelType: r.channelType || "UNKNOWN",
      finalUrl: r.finalUrl || null,
      serviceKey: r.serviceKey || null,
      serviceLabel: r.serviceKey ? serviceLabelByKey.get(r.serviceKey) || null : null,
      spend,
      clicks,
      impressions,
      conversions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      avgCpc: clicks > 0 ? spend / clicks : 0,
      costPerConv: conversions > 0 ? spend / conversions : null,
      eersteDag: r.eerste || null,
    };
  });
}

export function adsAccountLabel(accountKey = "unabo"): string {
  return ADS_ACCOUNTS.find((a) => a.key === accountKey)?.label || accountKey;
}
