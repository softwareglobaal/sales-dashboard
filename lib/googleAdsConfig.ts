import cfg from "@/config/ads.json";

// Eén Google Ads-account. 'key' is de sleutel in de databank (account_key),
// 'pipedriveKey' de Pipedrive-account waarvan de leads erbij horen. Meerdere
// Ads-accounts mogen dezelfde Pipedrive-account delen (UNABO en UNABO
// Regularisatie horen allebei bij 'unabo'). 'loginCustomerId' is de manager-id
// voor sub-accounts onder een manager: die eisen de header login-customer-id,
// de rechtstreekse accounts weigeren hem (403). Dus per account, nooit globaal.
export type AdsAccount = {
  key: string;
  pipedriveKey: string;
  customerId: string;
  loginCustomerId: string | null;
  label: string;
};
export type AdService = {
  key: string;
  label: string;
  themeKey: string | null;
  pipelineMatch: string[];
  adMatch: string[];
  urlMatch: string[];
};

export const ADS_ACCOUNTS: AdsAccount[] = ((cfg.accounts as any[]) || []).map((a) => ({
  // oudere config zonder 'key': de Pipedrive-sleutel was toen ook de databanksleutel
  key: String(a.key || a.pipedriveKey),
  pipedriveKey: String(a.pipedriveKey),
  customerId: String(a.customerId).replace(/[^0-9]/g, ""),
  loginCustomerId: a.loginCustomerId ? String(a.loginCustomerId).replace(/[^0-9]/g, "") : null,
  label: String(a.label || a.pipedriveKey),
}));

export const AD_CATALOG: AdService[] = ((cfg.catalog as any[]) || []).map((s) => ({
  key: s.key,
  label: s.label,
  themeKey: s.themeKey ?? null,
  pipelineMatch: (s.pipelineMatch || []).map((m: string) => m.toLowerCase()),
  adMatch: (s.adMatch || []).map((m: string) => m.toLowerCase()),
  urlMatch: (s.urlMatch || []).map((m: string) => m.toLowerCase()),
}));

// Ads-account op databanksleutel (bv. 'unabo', 'unabo-regularisatie').
export function adsAccountByKey(key: string): AdsAccount | undefined {
  return ADS_ACCOUNTS.find((a) => a.key === key);
}

// Alle Ads-accounts die bij één Pipedrive-account horen, in configvolgorde.
export function adsAccountsForPipedrive(pipedriveKey: string): AdsAccount[] {
  return ADS_ACCOUNTS.filter((a) => a.pipedriveKey === pipedriveKey);
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
