// Google Ads per campagne en per dienst (SEO/SEA-tab, spec §17).
//
// Kosten komen uit Google Ads (lib/adsQueries.ts). Een campagne hoort bij een
// dienst via haar service_key: de dienst is de afdeling waarvan `kanalen.ads` die
// sleutel noemt (config/afdelingen.json). De aanvragen komen uit de generieke
// dienstlaag (lib/afdelingen.ts: dataset + kpis), dus met exact dezelfde telling
// als op de dienstpagina met het firmafilter op de firma achter het Ads-account.
// Hier wordt niets opnieuw geteld.

import { AFDELINGEN, FIRMAS, dataset, kpis, type Afdeling, type Dataset } from "./afdelingen";
import { getAdsCampaigns, type AdCampaignRow } from "./adsQueries";
import { ADS_ACCOUNTS } from "./googleAdsConfig";
import { getDb } from "./db";

export type Periodevenster = { van: string; tot: string }; // tot exclusief, zoals bereik() in lib/afdelingen.ts

/** De dienst (afdeling) van een advertentiedienst uit config/ads.json. */
export function afdelingVoorService(serviceKey: string | null): Afdeling | null {
  if (!serviceKey) return null;
  return AFDELINGEN.find((a) => a.kanalen.ads.includes(serviceKey)) || null;
}

export type CampagneRij = AdCampaignRow & {
  afdeling: Afdeling | null;
  kostPerAanvraag: number | null; // enkel als dit de enige campagne met kosten voor de dienst is
};

export type DienstAdsRij = {
  afdeling: Afdeling | null; // null = campagnes zonder dienst
  naam: string;
  accounts: string[]; // labels van de Ads-accounts met campagnes voor deze dienst
  campagnes: number;
  actief: number;
  kost: number;
  klikken: number;
  vertoningen: number;
  conversies: number;
  aandeel: number; // aandeel in de totale advertentiekost (0..1)
  aanvragen: number | null; // null = geen koppeling (geen dienst)
  aanvragenVanaf: string; // vanaf wanneer de aanvragen tellen (eerste advertentiedag of begin periode)
  kostPerAanvraag: number | null;
  kostPerConversie: number | null;
};

export type AccountSplit = {
  key: string;
  label: string;
  kost: number;
  diensten: { rij: DienstAdsRij; kost: number; aandeel: number }[]; // aandeel in het budget van dit account
};

export type AdsPerDienst = {
  campagnes: CampagneRij[];
  diensten: DienstAdsRij[];
  accounts: AccountSplit[];
  firmaNamen: string[]; // firma's waarvan de aanvragen tellen
  firmaSleutels: string[];
  totaal: { kost: number; klikken: number; vertoningen: number; conversies: number; actief: number; campagnes: number };
};

const accountLabel = (key: string) => ADS_ACCOUNTS.find((a) => a.key === key)?.label || key;

/** De leads van de firma's achter de Ads-accounts (bv. UNABO), met dezelfde regels als het firmafilter. */
function vanFirmas(d: Dataset, firmas: string[]): Dataset {
  return { leads: d.leads.filter((l) => firmas.includes(l.firma)), omzet: d.omzet.filter((o) => firmas.includes(o.firma)) };
}

/**
 * Kosten per campagne en per dienst in een periode.
 * - accountKeys: de Ads-accounts (allemaal van dezelfde Pipedrive-account).
 * - dienst: optioneel één dienst; dan telt enkel die.
 */
export function adsPerDienst(v: Periodevenster, accountKeys: string[], dienst?: Afdeling): AdsPerDienst {
  const pipedrive = new Set(ADS_ACCOUNTS.filter((a) => accountKeys.includes(a.key)).map((a) => a.pipedriveKey));
  const firmas = FIRMAS.filter((f) => pipedrive.has(f.account));
  const firmaKeys = firmas.map((f) => f.sleutel);

  const alle = getAdsCampaigns(v, accountKeys)
    .map((c) => ({ ...c, afdeling: afdelingVoorService(c.serviceKey) }))
    .filter((c) => !dienst || c.afdeling?.pad === dienst.pad)
    // Verwijderde campagnes zonder kosten in de periode zijn ruis.
    .filter((c) => c.status !== "REMOVED" || c.spend > 0);

  // Diensten: alle afdelingen met een advertentiedienst in de config, plus wat er
  // aan campagnes binnenkomt (ook zonder dienst).
  const sleutels = new Map<string, Afdeling | null>();
  for (const a of AFDELINGEN) if (a.kanalen.ads.length && (!dienst || a.pad === dienst.pad)) sleutels.set(a.pad, a);
  for (const c of alle) sleutels.set(c.afdeling?.pad || "", c.afdeling);

  const totKost = alle.reduce((s, c) => s + c.spend, 0);
  const diensten: DienstAdsRij[] = [...sleutels.values()].map((a) => {
    const cs = alle.filter((c) => (c.afdeling?.pad || "") === (a?.pad || ""));
    const kost = cs.reduce((s, c) => s + c.spend, 0);
    const klikken = cs.reduce((s, c) => s + c.clicks, 0);
    const conversies = cs.reduce((s, c) => s + c.conversions, 0);
    // Aanvragen tellen vanaf de eerste advertentiedag in de periode: een campagne
    // die pas op 26 september start, mag niet de aanvragen van januari meekrijgen.
    const eerste = cs.map((c) => c.eersteDag).filter((d): d is string => !!d).sort()[0];
    const vanaf = eerste && eerste > v.van ? eerste : v.van;
    const aanvragen = a ? kpis(vanFirmas(dataset(a), firmaKeys), vanaf, v.tot).aanvragen : null;
    return {
      afdeling: a,
      naam: a?.naam || "Zonder dienst",
      accounts: [...new Set(cs.map((c) => accountLabel(c.accountKey)))],
      campagnes: cs.length,
      actief: cs.filter((c) => c.status === "ENABLED").length,
      kost,
      klikken,
      vertoningen: cs.reduce((s, c) => s + c.impressions, 0),
      conversies,
      aandeel: totKost > 0 ? kost / totKost : 0,
      aanvragen,
      aanvragenVanaf: vanaf,
      kostPerAanvraag: kost > 0 && aanvragen ? kost / aanvragen : null,
      kostPerConversie: conversies > 0 ? kost / conversies : null,
    };
  });
  diensten.sort((x, y) => y.kost - x.kost || y.campagnes - x.campagnes || x.naam.localeCompare(y.naam));

  // Per campagne: de kost per aanvraag bestaat enkel als de campagne de enige met
  // kosten voor haar dienst is. Anders zijn de aanvragen niet aan één campagne toe
  // te wijzen (Pipedrive weet niet via welke advertentie iemand binnenkwam).
  const campagnes: CampagneRij[] = alle.map((c) => {
    const pad = c.afdeling?.pad || "";
    const metKost = alle.filter((x) => (x.afdeling?.pad || "") === pad && x.spend > 0);
    const rij = diensten.find((d) => (d.afdeling?.pad || "") === pad);
    const alleen = c.spend > 0 && metKost.length === 1;
    return { ...c, kostPerAanvraag: alleen && rij ? rij.kostPerAanvraag : null };
  });
  campagnes.sort((x, y) => y.spend - x.spend || Number(y.status === "ENABLED") - Number(x.status === "ENABLED") || x.name.localeCompare(y.name));

  const accounts: AccountSplit[] = accountKeys.map((key) => {
    const cs = alle.filter((c) => c.accountKey === key);
    const kost = cs.reduce((s, c) => s + c.spend, 0);
    const per = diensten
      .map((rij) => {
        const k = cs.filter((c) => (c.afdeling?.pad || "") === (rij.afdeling?.pad || "")).reduce((s, c) => s + c.spend, 0);
        return { rij, kost: k, aandeel: kost > 0 ? k / kost : 0 };
      })
      .filter((x) => x.kost > 0)
      .sort((x, y) => y.kost - x.kost);
    return { key, label: accountLabel(key), kost, diensten: per };
  });

  return {
    campagnes,
    diensten,
    accounts,
    firmaNamen: firmas.map((f) => f.naam),
    firmaSleutels: firmaKeys,
    totaal: {
      kost: totKost,
      klikken: alle.reduce((s, c) => s + c.clicks, 0),
      vertoningen: alle.reduce((s, c) => s + c.impressions, 0),
      conversies: alle.reduce((s, c) => s + c.conversions, 0),
      actief: alle.filter((c) => c.status === "ENABLED").length,
      campagnes: alle.length,
    },
  };
}

/** Bestaat er minstens één (niet-verwijderde) campagne voor een van deze advertentiediensten? */
export function heeftCampagnes(serviceKeys: string[]): boolean {
  if (!serviceKeys.length) return false;
  const r = getDb()
    .prepare(`SELECT 1 FROM ad_campaigns WHERE status != 'REMOVED' AND service_key IN (${serviceKeys.map(() => "?").join(",")}) LIMIT 1`)
    .get(...serviceKeys);
  return !!r;
}
