import { getDb } from "./db";
import { ADS_ACCOUNTS, serviceForCampaign, adsConfigured } from "./googleAdsConfig";
import { fetchCampaignDims, fetchDailyMetrics } from "./googleAds";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Ophaalvenster: vanaf begin vorig jaar t/m vandaag, zodat de periode-selector
// (ytd, 12m, vorig jaar, maanden 2026, ...) altijd gedekt is.
function syncWindow(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear() - 1}-01-01`;
  return { from, to: ymd(now) };
}

export type AdsSyncResult = {
  account: string;
  customerId: string;
  campaigns: number;
  days: number;
  status: "ok" | "error";
  message?: string;
};

async function syncAdsAccount(acc: { pipedriveKey: string; customerId: string; label: string }): Promise<AdsSyncResult> {
  const db = getDb();
  const { from, to } = syncWindow();
  try {
    const [dims, metrics] = await Promise.all([
      fetchCampaignDims(acc.customerId, from, to),
      fetchDailyMetrics(acc.customerId, from, to),
    ]);

    const insCampaign = db.prepare(`
      INSERT OR REPLACE INTO ad_campaigns
        (account_key, customer_id, campaign_id, name, status, channel_type, final_url, service_key)
      VALUES (@account_key, @customer_id, @campaign_id, @name, @status, @channel_type, @final_url, @service_key)
    `);
    const insMetric = db.prepare(`
      INSERT OR REPLACE INTO ad_metrics_daily
        (account_key, campaign_id, date, cost_micros, clicks, impressions, conversions, conv_value)
      VALUES (@account_key, @campaign_id, @date, @cost_micros, @clicks, @impressions, @conversions, @conv_value)
    `);

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM ad_campaigns WHERE account_key = ?").run(acc.pipedriveKey);
      db.prepare("DELETE FROM ad_metrics_daily WHERE account_key = ?").run(acc.pipedriveKey);
      for (const c of dims) {
        const svc = serviceForCampaign(c.name, c.finalUrl);
        insCampaign.run({
          account_key: acc.pipedriveKey,
          customer_id: acc.customerId,
          campaign_id: c.campaignId,
          name: c.name,
          status: c.status,
          channel_type: c.channelType,
          final_url: c.finalUrl,
          service_key: svc?.key ?? null,
        });
      }
      for (const m of metrics) {
        insMetric.run({
          account_key: acc.pipedriveKey,
          campaign_id: m.campaignId,
          date: m.date,
          cost_micros: m.costMicros,
          clicks: m.clicks,
          impressions: m.impressions,
          conversions: m.conversions,
          conv_value: m.convValue,
        });
      }
    });
    tx();

    db.prepare(`
      INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message)
      VALUES (?, ?, ?, 'ok', ?)
    `).run(`ads:${acc.pipedriveKey}`, new Date().toISOString(), dims.length, `${dims.length} campagnes · ${metrics.length} dag-rijen`);

    return { account: acc.pipedriveKey, customerId: acc.customerId, campaigns: dims.length, days: metrics.length, status: "ok" };
  } catch (err: any) {
    const message = err?.message || String(err);
    db.prepare(`
      INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message)
      VALUES (?, ?, 0, 'error', ?)
    `).run(`ads:${acc.pipedriveKey}`, new Date().toISOString(), message);
    return { account: acc.pipedriveKey, customerId: acc.customerId, campaigns: 0, days: 0, status: "error", message };
  }
}

// Synchroniseert alle geconfigureerde Google Ads-accounts. No-op als niet geconfigureerd.
export async function syncGoogleAds(): Promise<AdsSyncResult[]> {
  if (!adsConfigured()) return [];
  const results: AdsSyncResult[] = [];
  for (const acc of ADS_ACCOUNTS) {
    results.push(await syncAdsAccount(acc));
  }
  return results;
}
