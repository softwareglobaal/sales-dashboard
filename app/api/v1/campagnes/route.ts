import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { leesParams } from "@/lib/agentApi";
import { getAdsOverview, getAdsCampaigns, getAdsSyncInfo } from "@/lib/adsQueries";
import { ADS_ACCOUNTS, adsAccountByKey, adsAccountsForPipedrive } from "@/lib/googleAdsConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google Ads-prestaties per campagne. Let op het onderscheid:
//  - 'conversies' zijn wat Google telt op de site;
//  - 'aanvragen' (zie /api/v1/kpi) zijn deals in Pipedrive.
// Die twee lopen niet gelijk; de kost per aanvraag is de eerlijkste maatstaf en
// staat daarom apart in de kanalen/kpi-endpoints.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const p = leesParams(req, false);
  if (!p.ok) return p.antwoord;

  // ?account= is een Ads-account uit config/ads.json ('unabo', 'unabo-regularisatie').
  // Sinds 23 september 2026 hangen er twee Ads-accounts onder UNABO; met
  // ?account=alle:unabo komen ze samen (opgeteld), anders blijft het één account.
  const url = new URL(req.url);
  const gevraagd = url.searchParams.get("account") || "unabo";
  const samen = gevraagd.startsWith("alle:") ? adsAccountsForPipedrive(gevraagd.slice(5)).map((a) => a.key) : null;
  const account = gevraagd;
  const keys = samen ?? [gevraagd];
  const bekend = samen ? samen.length > 0 : Boolean(adsAccountByKey(gevraagd));
  if (!bekend) {
    return NextResponse.json(
      { fout: `Onbekend Ads-account '${gevraagd}'`, accounts: ADS_ACCOUNTS.map((a) => a.key) },
      { status: 400 }
    );
  }

  const o = getAdsOverview(p.periode, keys);
  const rijen = getAdsCampaigns(p.periode, keys);
  const syncs = getAdsSyncInfo().filter((s) => keys.includes(s.account_key.replace(/^ads:/, "")));
  const sync = syncs.find((s) => s.status === "error") || syncs[0] || null;

  return NextResponse.json({
    account,
    accounts: ADS_ACCOUNTS.map((a) => ({ key: a.key, label: a.label, customerId: a.customerId, pipedrive: a.pipedriveKey })),
    periode: p.periode,
    bereik: p.bereik,
    versheid: sync ? { laatsteSync: sync.last_sync, status: sync.status, melding: sync.message } : null,
    totaal: {
      uitgaven: o.spend,
      klikken: o.clicks,
      vertoningen: o.impressions,
      conversies: o.conversions,
      conversiewaarde: o.convValue,
      ctr: o.ctr,
      gemKostPerKlik: o.avgCpc,
      kostPerConversie: o.costPerConv,
      actieveCampagnes: o.activeCampaigns,
      totaalCampagnes: o.totalCampaigns,
    },
    campagnes: rijen.map((r) => ({
      id: r.campaignId,
      account: r.accountKey,
      naam: r.name,
      status: r.status,
      soort: r.channelType,
      landingspagina: r.finalUrl,
      dienst: r.serviceLabel,
      uitgaven: r.spend,
      klikken: r.clicks,
      vertoningen: r.impressions,
      conversies: r.conversions,
      ctr: r.ctr,
      gemKostPerKlik: r.avgCpc,
      kostPerConversie: r.costPerConv,
    })),
  });
}
