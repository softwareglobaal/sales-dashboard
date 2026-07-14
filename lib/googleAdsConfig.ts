import cfg from "@/config/ads.json";

export type AdsAccount = { pipedriveKey: string; customerId: string; label: string };
export type AdService = {
  key: string;
  label: string;
  themeKey: string | null;
  pipelineMatch: string[];
  adMatch: string[];
  urlMatch: string[];
};

export const ADS_ACCOUNTS: AdsAccount[] = (cfg.accounts as AdsAccount[]) || [];

export const AD_CATALOG: AdService[] = ((cfg.catalog as any[]) || []).map((s) => ({
  key: s.key,
  label: s.label,
  themeKey: s.themeKey ?? null,
  pipelineMatch: (s.pipelineMatch || []).map((m: string) => m.toLowerCase()),
  adMatch: (s.adMatch || []).map((m: string) => m.toLowerCase()),
  urlMatch: (s.urlMatch || []).map((m: string) => m.toLowerCase()),
}));

export function adsAccountByKey(pipedriveKey: string): AdsAccount | undefined {
  return ADS_ACCOUNTS.find((a) => a.pipedriveKey === pipedriveKey);
}

// Koppelt een campagne (naam + landingspagina) aan een dienst uit de catalogus.
// Matcht eerst op campagnenaam, dan op de landingspagina-URL. Geen match -> null.
export function serviceForCampaign(name: string | null, finalUrl: string | null): AdService | null {
  const n = (name || "").toLowerCase();
  const u = (finalUrl || "").toLowerCase();
  for (const s of AD_CATALOG) {
    if (s.adMatch.some((m) => n.includes(m))) return s;
  }
  for (const s of AD_CATALOG) {
    if (s.urlMatch.some((m) => u.includes(m))) return s;
  }
  return null;
}

// Zijn alle vereiste Google Ads-omgevingsvariabelen aanwezig?
export function adsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      ADS_ACCOUNTS.length > 0
  );
}
