import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { leesParams } from "@/lib/agentApi";
import { getAdsOverview, getAdsCampaigns, getAdsSyncInfo } from "@/lib/adsQueries";

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

  const url = new URL(req.url);
  const account = url.searchParams.get("account") || "unabo";

  const o = getAdsOverview(p.periode, account);
  const rijen = getAdsCampaigns(p.periode, account);
  const sync = getAdsSyncInfo().find((s) => s.account_key === `ads:${account}`) || null;

  return NextResponse.json({
    account,
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
