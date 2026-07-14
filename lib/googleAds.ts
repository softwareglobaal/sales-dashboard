// Google Ads API-client (server-only). Leest campagne-prestaties read-only uit.
// Auth: OAuth2 refresh-token -> access-token; developer-token in de header.
// Alle geheimen komen uit .env(.local) — nooit in de code of in git.

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v21";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// access-token cache (in-memory, per serverproces)
let _token: { value: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _token.expires - 60_000) return _token.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth: ${json.error || res.status} ${json.error_description || ""}`.trim());
  }
  _token = { value: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return _token.value;
}

function headers(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  };
  // login-customer-id enkel meesturen als hij ingevuld is (bij manager-toegang).
  const login = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/[^0-9]/g, "");
  if (login) h["login-customer-id"] = login;
  return h;
}

// Voert een GAQL-query uit tegen één account. Volgt paginering (nextPageToken).
export async function gaqlSearch(customerId: string, query: string, retries = 3): Promise<any[]> {
  const cid = customerId.replace(/[^0-9]/g, "");
  const rows: any[] = [];
  let pageToken: string | undefined;

  do {
    let lastErr: unknown;
    let ok = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${BASE}/customers/${cid}/googleAds:search`, {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
          cache: "no-store",
        });
        if (res.status === 429 || res.status >= 500) {
          await sleep(Math.min(2000 * (attempt + 1), 10000));
          lastErr = new Error(`Google Ads status ${res.status}`);
          continue;
        }
        const json = await res.json();
        if (!res.ok) {
          const msg = json?.error?.message || `status ${res.status}`;
          throw new Error(`Google Ads (${cid}): ${msg}`);
        }
        for (const r of json.results || []) rows.push(r);
        pageToken = json.nextPageToken;
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 8000));
      }
    }
    if (!ok) throw lastErr;
  } while (pageToken);

  return rows;
}

export type AdCampaignDim = {
  campaignId: string;
  name: string;
  status: string;
  channelType: string;
  finalUrl: string | null;
};

export type AdDailyMetric = {
  campaignId: string;
  date: string;
  costMicros: number;
  clicks: number;
  impressions: number;
  conversions: number;
  convValue: number;
};

// Campagne-dimensies + representatieve landingspagina (meest getoonde ad-URL per campagne).
export async function fetchCampaignDims(customerId: string, from: string, to: string): Promise<AdCampaignDim[]> {
  const camps = await gaqlSearch(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
     FROM campaign
     WHERE campaign.status != 'REMOVED'`
  );

  // landingspagina's: neem per campagne de final_url van de ad met de meeste impressies
  const ads = await gaqlSearch(
    customerId,
    `SELECT campaign.id, ad_group_ad.ad.final_urls, metrics.impressions
     FROM ad_group_ad
     WHERE ad_group_ad.status != 'REMOVED' AND segments.date BETWEEN '${from}' AND '${to}'`
  );
  const bestUrl = new Map<string, { url: string; impr: number }>();
  for (const r of ads) {
    const cid = String(r.campaign?.id ?? "");
    const urls: string[] = r.adGroupAd?.ad?.finalUrls || [];
    const impr = Number(r.metrics?.impressions ?? 0);
    if (!cid || urls.length === 0) continue;
    const cur = bestUrl.get(cid);
    if (!cur || impr > cur.impr) bestUrl.set(cid, { url: urls[0], impr });
  }

  return camps.map((r) => {
    const cid = String(r.campaign?.id ?? "");
    return {
      campaignId: cid,
      name: r.campaign?.name ?? "",
      status: r.campaign?.status ?? "UNKNOWN",
      channelType: r.campaign?.advertisingChannelType ?? "UNKNOWN",
      finalUrl: bestUrl.get(cid)?.url ?? null,
    };
  });
}

// Per-campagne, per-dag prestatiecijfers (zodat de periode-selector kan filteren).
export async function fetchDailyMetrics(customerId: string, from: string, to: string): Promise<AdDailyMetric[]> {
  const rows = await gaqlSearch(
    customerId,
    `SELECT campaign.id, segments.date,
            metrics.cost_micros, metrics.clicks, metrics.impressions,
            metrics.conversions, metrics.conversions_value
     FROM campaign
     WHERE segments.date BETWEEN '${from}' AND '${to}'`
  );
  return rows.map((r) => ({
    campaignId: String(r.campaign?.id ?? ""),
    date: r.segments?.date ?? "",
    costMicros: Number(r.metrics?.costMicros ?? 0),
    clicks: Number(r.metrics?.clicks ?? 0),
    impressions: Number(r.metrics?.impressions ?? 0),
    conversions: Number(r.metrics?.conversions ?? 0),
    convValue: Number(r.metrics?.conversionsValue ?? 0),
  }));
}
