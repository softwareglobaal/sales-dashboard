import {
  isValidPeriod,
  periodRange,
  monthOptions2026,
  weekOptions2026,
  PERIOD_OPTIONS,
  type Period,
} from "@/lib/queries";
import {
  adsHasData,
  getAdsOverview,
  getAdsCampaigns,
  getServiceCoverage,
  getAdsSyncInfo,
  adsAccountLabel,
} from "@/lib/adsQueries";
import { adsConfigured } from "@/lib/googleAdsConfig";
import { euro, euroShort, num, pct } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";
import { PeriodSelector, MonthSelector, WeekSelector } from "@/components/Controls";
import { SubNav } from "@/components/SubNav";
import { SyncFreshness } from "@/components/SyncFreshness";
import { SpendByServiceChart, CostPerLeadChart } from "@/components/AdsCharts";

export const dynamic = "force-dynamic";

const PATH = "/seo-sea";
const ACCOUNT = "unabo";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Zoeken",
  PERFORMANCE_MAX: "Performance Max",
  DISPLAY: "Display",
  VIDEO: "Video",
  SHOPPING: "Shopping",
  MULTI_CHANNEL: "Multi-channel",
  DEMAND_GEN: "Demand Gen",
  LOCAL: "Lokaal",
};
const channelLabel = (c: string) => CHANNEL_LABELS[c] || c.replaceAll("_", " ").toLowerCase();

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ENABLED: { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Actief" },
    PAUSED: { cls: "border-zinc-200 bg-zinc-100 text-zinc-500", label: "Gepauzeerd" },
  };
  const s = map[status] || { cls: "border-zinc-200 bg-zinc-50 text-zinc-500", label: status.toLowerCase() };
  return <span className={"inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium " + s.cls}>{s.label}</span>;
}

export default async function SeoSeaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = isValidPeriod(sp.period) ? (sp.period as Period) : "ytd";
  const periodLabel = periodRange(period).label;
  const monthOpts = monthOptions2026();
  const weekOpts = weekOptions2026();
  const params = sp as Record<string, string | undefined>;
  const label = adsAccountLabel(ACCOUNT);

  const Header = () => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">SEO / SEA</h1>
        <p className="text-[12.5px] text-zinc-500">Google Ads — {label} · advertentieprestaties &amp; leads</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelector options={PERIOD_OPTIONS} current={period} params={params} path={PATH} />
        {monthOpts.length > 0 && <MonthSelector options={monthOpts} current={period} params={params} path={PATH} />}
        {weekOpts.length > 0 && <WeekSelector options={weekOpts} current={period} params={params} path={PATH} />}
      </div>
    </div>
  );

  // 1) Niet geconfigureerd (geen credentials) — toon per variabele of hij gevonden is,
  // zodat je meteen ziet wat er mist (zonder de waarde te tonen).
  if (!adsConfigured()) {
    const checks: { name: string; ok: boolean }[] = [
      { name: "GOOGLE_ADS_CLIENT_ID", ok: Boolean(process.env.GOOGLE_ADS_CLIENT_ID) },
      { name: "GOOGLE_ADS_CLIENT_SECRET", ok: Boolean(process.env.GOOGLE_ADS_CLIENT_SECRET) },
      { name: "GOOGLE_ADS_REFRESH_TOKEN", ok: Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN) },
      { name: "GOOGLE_ADS_DEVELOPER_TOKEN", ok: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN) },
    ];
    const missing = checks.filter((c) => !c.ok);
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Header />
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-800">Google Ads nog niet gekoppeld</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            De app ziet {missing.length === checks.length ? "geen enkele" : `${missing.length} van de`}{" "}
            <code className="rounded bg-zinc-100 px-1">GOOGLE_ADS_*</code>-variabele(n) nog niet. Zet ze in het env-bestand op de VM (zelfde plek als de <code className="rounded bg-zinc-100 px-1">PIPEDRIVE_TOKEN_*</code>) en <strong>herstart de app</strong>.
          </p>
          <ul className="mx-auto mt-4 inline-block text-left text-sm">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2 py-0.5 font-mono text-[12.5px]">
                <span className={c.ok ? "text-emerald-600" : "text-red-500"}>{c.ok ? "✓" : "✗"}</span>
                <span className={c.ok ? "text-zinc-600" : "text-red-600"}>{c.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-400">
            (De waarden worden nooit getoond — enkel of ze gevonden zijn. Herstart is nodig omdat variabelen bij het opstarten van het proces worden geladen.)
          </p>
        </div>
      </main>
    );
  }

  const syncInfo = getAdsSyncInfo();
  const err = syncInfo.find((s) => s.status === "error");

  // 2) Geconfigureerd maar nog geen data gesynct
  if (!adsHasData(ACCOUNT)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Header />
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-800">Nog geen Google Ads-data</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Klik op <strong>&ldquo;Data verversen&rdquo;</strong> (zijbalk) om de campagnes van {label} op te halen.
          </p>
          {err && <p className="mx-auto mt-3 max-w-lg text-xs text-red-500">Laatste fout: {err.message}</p>}
        </div>
      </main>
    );
  }

  const overview = getAdsOverview(period, ACCOUNT);
  const campaigns = getAdsCampaigns(period, ACCOUNT);
  const coverage = getServiceCoverage(period, ACCOUNT);
  const withAds = coverage.filter((c) => c.everAds);
  const withoutAds = coverage.filter((c) => !c.everAds);
  const activeCampaigns = campaigns.filter((c) => c.status === "ENABLED");

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-black/10 bg-[#d7dde7]/85 px-6 pt-7 backdrop-blur-md">
        <Header />
        <div className="flex flex-wrap gap-2 text-[11.5px]">
          <SyncFreshness />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-emerald-800">
            Account: <b>{label}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Periode: <b className="text-zinc-800">{periodLabel}</b>
          </span>
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-zinc-400">
            Ads-cijfers uit Google Ads · leads uit de UNABO-pipeline (Pipedrive)
          </span>
        </div>
        <SubNav
          items={[
            { id: "overzicht", label: "Overzicht" },
            { id: "dekking", label: "Dekking & gap" },
            { id: "rendement", label: "Rendement (leads)" },
            { id: "campagnes", label: "Campagnes" },
          ]}
        />
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Let op: de laatste Google Ads-sync gaf een fout ({err.message}). De getoonde cijfers kunnen verouderd zijn.
        </div>
      )}

      {/* KPI's */}
      <section id="overzicht" className="mb-8 grid scroll-mt-40 grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-[#16204a] to-[#243a86] p-5 text-white shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-200">Advertentiekosten</div>
          <div className="text-[30px] font-extrabold leading-none tracking-tight">{euro(overview.spend)}</div>
          <div className="mt-auto text-[11.5px] text-indigo-200/80">
            {num(overview.activeCampaigns)} actieve · {num(overview.totalCampaigns)} campagnes
          </div>
        </div>
        <Kpi label="Klikken" value={num(overview.clicks)} sub={`CTR ${pct(overview.ctr)} · gem. ${euro(overview.avgCpc)}/klik`} />
        <Kpi label="Vertoningen" value={num(overview.impressions)} sub="impressies in periode" />
        <Kpi
          label="Conversies (Google)"
          value={num(Math.round(overview.conversions))}
          sub={overview.costPerConv != null ? `${euro(overview.costPerConv)} per conversie` : "geen conversies"}
        />
      </section>

      {/* Dekking & gap-analyse */}
      <section id="dekking" className="mb-8 scroll-mt-40">
        <Card title="Dekking per dienst — waar draaien we ads, en waar niet?">
          <p className="mb-4 -mt-1 text-xs text-zinc-500">
            Alle UNABO-diensten uit <code className="rounded bg-zinc-100 px-1">config/ads.json</code>. Blauwe balk = advertentiekosten in de periode; grijs = géén ads.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SpendByServiceChart data={coverage.map((c) => ({ label: c.label, spend: c.spend, hasAds: c.hasAds }))} />
            <div>
              {withoutAds.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Diensten zonder ads</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {withoutAds.map((c) => (
                      <span key={c.key} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[12px] text-amber-800">
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-amber-700/80">
                    Kandidaten om te overwegen voor een campagne — nu komen hier geen betaalde bezoekers op af.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Diensten met ads</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {withAds.length === 0 ? (
                    <span className="text-[12px] text-emerald-700">—</span>
                  ) : (
                    withAds.map((c) => (
                      <span key={c.key} className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[12px] text-emerald-800">
                        {c.label}
                        {!c.hasAds && <span className="ml-1 text-emerald-600/60">(gepauzeerd)</span>}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Rendement: ads vs. echte leads */}
      <section id="rendement" className="mb-8 scroll-mt-40">
        <Card title="Rendement — advertenties vs. echte aanvragen (UNABO Pipedrive)">
          <p className="mb-4 -mt-1 text-xs text-zinc-500">
            Presteren de ads? Advertentiekosten &amp; Google-conversies naast de <strong>echte leads en gewonnen deals in de UNABO-pipeline</strong> (via thema-match op de diensten). TKN-Buro telt hier niet mee.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="py-2 pr-3 font-medium">Dienst</th>
                    <th className="py-2 pr-3 text-right font-medium">Kosten</th>
                    <th className="py-2 pr-3 text-right font-medium">Leads</th>
                    <th className="py-2 pr-3 text-right font-medium">Gewonnen</th>
                    <th className="py-2 pr-3 text-right font-medium">Kost/lead</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage
                    .filter((c) => c.spend > 0 || c.leads > 0)
                    .sort((a, b) => b.spend - a.spend)
                    .map((c) => (
                      <tr key={c.key} className="border-b border-zinc-100">
                        <td className="py-2 pr-3">
                          <span className="text-zinc-800">{c.label}</span>
                          {!c.hasAds && c.everAds && <span className="ml-1.5 text-[11px] text-zinc-400">(ads gepauzeerd)</span>}
                          {!c.everAds && <span className="ml-1.5 text-[11px] text-amber-600">(geen ads)</span>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{c.spend > 0 ? euro(c.spend) : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(c.leads)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(c.won)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium text-zinc-900">
                          {c.costPerLead != null ? euro(c.costPerLead) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-zinc-400">
                Kost/lead = advertentiekosten ÷ UNABO-leads voor die dienst in de periode. &ldquo;Leads&rdquo; zijn aanvragen op aanmaakdatum; matching op productnaam (thema&#39;s in <code className="rounded bg-zinc-100 px-1">themes.json</code>).
              </p>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-zinc-500">Kost per lead per dienst</div>
              <CostPerLeadChart data={coverage.map((c) => ({ label: c.label, costPerLead: c.costPerLead }))} />
            </div>
          </div>
        </Card>
      </section>

      {/* Campagnes + landingspagina's */}
      <section id="campagnes" className="mb-8 scroll-mt-40">
        <Card title={`Campagnes (${num(campaigns.length)}) — met landingspagina`}>
          <p className="mb-3 -mt-1 text-xs text-zinc-500">
            {num(activeCampaigns.length)} actief. Klik op de landingspagina om te zien wat de bezoeker ziet. Gesorteerd op kosten.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Campagne</th>
                  <th className="py-2 pr-3 font-medium">Dienst</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 text-right font-medium">Kosten</th>
                  <th className="py-2 pr-3 text-right font-medium">Klikken</th>
                  <th className="py-2 pr-3 text-right font-medium">CTR</th>
                  <th className="py-2 pr-3 text-right font-medium">Conv.</th>
                  <th className="py-2 pr-3 text-right font-medium">Kost/conv.</th>
                  <th className="py-2 pr-3 font-medium">Landingspagina</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaignId} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <span className="text-zinc-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {c.serviceLabel || <span className="text-amber-600">niet toegewezen</span>}
                    </td>
                    <td className="py-2 pr-3 text-zinc-500">{channelLabel(c.channelType)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{euro(c.spend)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(c.clicks)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-600">{pct(c.ctr)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(Math.round(c.conversions))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-600">{c.costPerConv != null ? euro(c.costPerConv) : "—"}</td>
                    <td className="py-2 pr-3">
                      {c.finalUrl ? (
                        <a
                          href={c.finalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap text-blue-600 hover:underline"
                          title={c.finalUrl}
                        >
                          {c.finalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 34)} ↗
                        </a>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <p className="mt-10 text-center text-xs text-zinc-400">
        Advertentiecijfers uit Google Ads ({label}) · leads uit de UNABO-pipeline (Pipedrive) · bedragen incl. Google Ads-kost, excl. btw.
      </p>
    </main>
  );
}
