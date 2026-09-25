import { getDb } from "./db";
import { periodRange, type Period } from "./queries";
import { getTheme } from "./themes";
import { AD_CATALOG, ADS_ACCOUNTS, adsAccountsForPipedrive, type AdService, type AdsAccount } from "./googleAdsConfig";

// Periode-grenzen als concrete datums (JJJJ-MM-DD). null -> heel ver weg.
function bounds(period: Period): { from: string; to: string } {
  const { from, to } = periodRange(period);
  return { from: from ?? "0000-01-01", to: to ?? "9999-12-31" };
}

// Alle query's hieronder nemen één Ads-account (databanksleutel, bv. 'unabo')
// of een lijst ervan. Een lijst telt de accounts op: zo staan UNABO en UNABO
// Regularisatie samen in de KPI's, terwijl de tabel per account ze apart houdt.
type AccountSel = string | string[];
function keysOf(sel: AccountSel): string[] {
  const keys = Array.isArray(sel) ? sel : [sel];
  return keys.length > 0 ? keys : ["__geen__"];
}
function inClause(keys: string[]): string {
  return `(${keys.map(() => "?").join(",")})`;
}

// De Pipedrive-account waarvan de leads bij deze Ads-accounts horen. Oudere
// aanroepen geven de Pipedrive-sleutel zelf mee ('unabo'); die valt hier ook goed.
function pipedriveKeyFor(sel: AccountSel): string {
  const first = keysOf(sel)[0];
  return ADS_ACCOUNTS.find((a) => a.key === first)?.pipedriveKey || first;
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

export function getAdsOverview(period: Period, sel: AccountSel = "unabo"): AdsOverview {
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
};

const serviceLabelByKey = new Map(AD_CATALOG.map((s) => [s.key, s.label]));

export function getAdsCampaigns(period: Period, sel: AccountSel = "unabo"): AdCampaignRow[] {
  const db = getDb();
  const { from, to } = bounds(period);
  const keys = keysOf(sel);
  const rows = db
    .prepare(
      `SELECT c.account_key AS accountKey, c.campaign_id AS campaignId, c.name AS name, c.status AS status,
              c.channel_type AS channelType, c.final_url AS finalUrl, c.service_key AS serviceKey,
              COALESCE(SUM(m.cost_micros),0) AS cost, COALESCE(SUM(m.clicks),0) AS clicks,
              COALESCE(SUM(m.impressions),0) AS impr, COALESCE(SUM(m.conversions),0) AS conv
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
    };
  });
}

// Telt UNABO-leads/gewonnen voor een dienst. 'pipelineMatch' heeft voorrang
// (gedeeltelijke match op de Pipedrive pipeline-naam — betrouwbaarder dan
// producten); bij afwezigheid valt hij terug op thema-match op de productnamen.
// pipedriveKey is de Pipedrive-account (niet het Ads-account).
function pipedriveLeadsForService(service: AdService, period: Period, pipedriveKey: string): { leads: number; won: number } {
  const db = getDb();
  const { from, to } = bounds(period);

  // condition + params bouwen op basis van de gekozen matchmethode
  let cond: string;
  let condParams: string[];
  if (service.pipelineMatch.length > 0) {
    const likes = service.pipelineMatch.map(() => "lower(d.pipeline_name) LIKE ?").join(" OR ");
    cond = `(${likes})`;
    condParams = service.pipelineMatch.map((m) => `%${m}%`);
  } else {
    const theme = service.themeKey ? getTheme(service.themeKey) : undefined;
    if (!theme || !theme.match.length) return { leads: 0, won: 0 };
    const likes = theme.match.map(() => "lower(dp.name) LIKE ?").join(" OR ");
    cond = `d.id IN (SELECT dp.deal_id FROM deal_products dp WHERE dp.account_key = d.account_key AND (${likes}))`;
    condParams = theme.match.map((m) => `%${m.toLowerCase()}%`);
  }

  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN d.add_time >= ? AND d.add_time < ? THEN 1 ELSE 0 END) AS leads,
         SUM(CASE WHEN d.status='won' AND d.won_time >= ? AND d.won_time < ? THEN 1 ELSE 0 END) AS won
       FROM deals d
       WHERE d.account_key = ? AND ${cond}`
    )
    .get(from, to, from, to, pipedriveKey, ...condParams) as any;
  return { leads: row?.leads || 0, won: row?.won || 0 };
}

export type ServiceCoverageRow = {
  key: string;
  label: string;
  hasAds: boolean; // draait er nu (ENABLED) een campagne voor?
  everAds: boolean; // ooit een campagne (ook PAUSED) voor deze dienst?
  spend: number; // advertentiekosten in periode
  clicks: number;
  adConversions: number; // conversies gemeten door Google Ads
  leads: number; // echte aanvragen op UNABO (Pipedrive) voor deze dienst
  won: number; // gewonnen deals (Pipedrive)
  costPerLead: number | null; // spend / leads
};

// Dekkingsanalyse: per dienst uit de catalogus — draait er een ad, wat kost het,
// en hoeveel leads/gewonnen levert het op in Pipedrive (UNABO). Zo zie je meteen
// welke diensten géén ads hebben.
export function getServiceCoverage(period: Period, sel: AccountSel = "unabo"): ServiceCoverageRow[] {
  const db = getDb();
  const { from, to } = bounds(period);
  const keys = keysOf(sel);
  const pipedriveKey = pipedriveKeyFor(sel);
  return AD_CATALOG.map((s) => {
    const camp = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status='ENABLED' THEN 1 ELSE 0 END) AS active,
           COUNT(*) AS total
         FROM ad_campaigns WHERE account_key IN ${inClause(keys)} AND service_key = ?`
      )
      .get(...keys, s.key) as any;
    const metrics = db
      .prepare(
        `SELECT COALESCE(SUM(m.cost_micros),0) AS cost, COALESCE(SUM(m.clicks),0) AS clicks,
                COALESCE(SUM(m.conversions),0) AS conv
         FROM ad_metrics_daily m
         JOIN ad_campaigns c ON c.account_key = m.account_key AND c.campaign_id = m.campaign_id
         WHERE m.account_key IN ${inClause(keys)} AND c.service_key = ? AND m.date >= ? AND m.date < ?`
      )
      .get(...keys, s.key, from, to) as any;

    const spend = (metrics.cost || 0) / 1e6;
    const { leads, won } = pipedriveLeadsForService(s, period, pipedriveKey);
    return {
      key: s.key,
      label: s.label,
      hasAds: (camp?.active || 0) > 0,
      everAds: (camp?.total || 0) > 0,
      spend,
      clicks: metrics.clicks || 0,
      adConversions: metrics.conv || 0,
      leads,
      won,
      costPerLead: leads > 0 ? spend / leads : null,
    };
  });
}

export function adsAccountLabel(accountKey = "unabo"): string {
  return ADS_ACCOUNTS.find((a) => a.key === accountKey)?.label || accountKey;
}

export type AdsAccountSummary = {
  key: string;
  label: string;
  customerId: string;
  overview: AdsOverview;
  services: string[]; // diensten waarvoor dit account (ooit) campagnes had
  leads: number; // Pipedrive-leads voor die diensten in de periode
  won: number;
  costPerLead: number | null; // kosten van dit account ÷ die leads
  sync: AdsSyncInfo | null;
};

// Per Ads-account van één Pipedrive-account (UNABO en UNABO Regularisatie):
// kosten, klikken, conversies en de kost per aanvraag. Leads worden per dienst
// geteld in Pipedrive (pipelineMatch/thema) en hier opgeteld over de diensten
// waarvoor het account campagnes heeft; zo blijft de kost per aanvraag per
// account leesbaar, ook al komen de leads uit dezelfde pipelines.
export function getAdsAccountsSummary(period: Period, pipedriveKey = "unabo"): AdsAccountSummary[] {
  const db = getDb();
  const syncInfo = getAdsSyncInfo();
  const accounts: AdsAccount[] = adsAccountsForPipedrive(pipedriveKey);
  return accounts.map((acc) => {
    const overview = getAdsOverview(period, acc.key);
    const svcRows = db
      .prepare(`SELECT DISTINCT service_key AS k FROM ad_campaigns WHERE account_key = ? AND service_key IS NOT NULL`)
      .all(acc.key) as { k: string }[];
    const services = svcRows.map((r) => r.k);
    let leads = 0;
    let won = 0;
    for (const s of AD_CATALOG) {
      if (!services.includes(s.key)) continue;
      const r = pipedriveLeadsForService(s, period, pipedriveKey);
      leads += r.leads;
      won += r.won;
    }
    return {
      key: acc.key,
      label: acc.label,
      customerId: acc.customerId,
      overview,
      services,
      leads,
      won,
      costPerLead: leads > 0 ? overview.spend / leads : null,
      sync: syncInfo.find((s) => s.account_key === `ads:${acc.key}`) || null,
    };
  });
}
