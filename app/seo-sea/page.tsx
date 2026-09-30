import Link from "next/link";
import { afdeling } from "@/lib/afdelingen";
import { campagnes } from "@/lib/kanalen";
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
  getAdsAccountsSummary,
  adsAccountLabel,
} from "@/lib/adsQueries";
import { adsConfigured, adsAccountsForPipedrive, AD_CATALOG } from "@/lib/googleAdsConfig";
import { euro, euroShort, num, pct } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";
import { PeriodSelector, MonthSelector, WeekSelector } from "@/components/Controls";
import { SubNav } from "@/components/SubNav";
import { SyncFreshness } from "@/components/SyncFreshness";
import { SpendByServiceChart, CostPerLeadChart } from "@/components/AdsCharts";

export const dynamic = "force-dynamic";

const PATH = "/seo-sea";
// De Pipedrive-account waarvan de leads bij deze pagina horen. Daar kunnen
// meerdere Google Ads-accounts onder hangen (config/ads.json): UNABO en, sinds
// 23 september 2026, UNABO Regularisatie. De KPI's tellen ze op; de tabel
// "Per account" en de campagnetabel houden ze uit elkaar.
const PIPEDRIVE = "unabo";

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
const adsLabel = (syncKey: string) => adsAccountLabel(syncKey.replace(/^ads:/, ""));
const serviceName = (key: string) => AD_CATALOG.find((s) => s.key === key)?.label || key;

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
  searchParams: Promise<{ period?: string; dienst?: string }>;
}) {
  const sp = await searchParams;
  const vanDienst = sp.dienst ? afdeling(sp.dienst) : undefined;
  const dienstCampagnes = vanDienst ? campagnes(vanDienst) : [];
  const period: Period = isValidPeriod(sp.period) ? (sp.period as Period) : "ytd";
  const periodLabel = periodRange(period).label;
  const monthOpts = monthOptions2026();
  const weekOpts = weekOptions2026();
  const params = sp as Record<string, string | undefined>;
  const accounts = adsAccountsForPipedrive(PIPEDRIVE);
  const accountKeys = accounts.map((a) => a.key);
  const label = accounts.map((a) => a.label).join(" + ") || PIPEDRIVE;
  const meerdere = accounts.length > 1;

  // Doorklik vanaf een dienst (spec §17): eerst de campagnes van die dienst, daarna de volledige tab.
  const DienstBanner = () =>
    vanDienst ? (
      <div className="paneel mb-4">
        <div className="kop">
          <h2>Campagnes voor {vanDienst.naam}</h2>
          <Link href={`/${vanDienst.pad}/kanalen`} className="text-[12px] font-medium underline">
            ← terug naar {vanDienst.naam}
          </Link>
        </div>
        {dienstCampagnes.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Er loopt geen campagne voor deze dienst.</p>
        ) : (
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Campagne</th>
                  <th>Status</th>
                  <th className="num">Kost dit jaar</th>
                  <th className="num">Klikken</th>
                  <th className="num">Conversies</th>
                  <th className="num">Kost per conversie</th>
                </tr>
              </thead>
              <tbody>
                {dienstCampagnes.map((c) => (
                  <tr key={c.account + c.id}>
                    <td className="font-medium">
                      {c.naam}
                      <div className="text-[11.5px] font-normal text-zinc-500">{c.account}</div>
                    </td>
                    <td>
                      <span className={c.status === "ENABLED" ? "chip goed" : "chip"}>{c.status === "ENABLED" ? "Actief" : "Gepauzeerd"}</span>
                    </td>
                    <td className="num">{euro(c.kost)}</td>
                    <td className="num">{num(c.klikken)}</td>
                    <td className="num">{num(c.conversies)}</td>
                    <td className="num">{c.conversies ? euro(c.kost / c.conversies) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ) : null;

  const Header = () => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="h1-glas">SEO / SEA</h1>
        <p className="text-[12.5px] text-zinc-500">Google Ads — {label} · advertentieprestaties &amp; leads</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelector options={PERIOD_OPTIONS} current={period} params={params} path={PATH} />
        {monthOpts.length > 0 && <MonthSelector options={monthOpts} current={period} params={params} path={PATH} />}
        {weekOpts.length > 0 && <WeekSelector options={weekOpts} current={period} params={params} path={PATH} />}
      </div>
    </div>
  );

  // 1) Niet geconfigureerd (geen credentials)
  if (!adsConfigured()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Header />
        <DienstBanner />
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-800">Google Ads nog niet gekoppeld</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Zet de <code className="rounded bg-zinc-100 px-1">GOOGLE_ADS_*</code>-variabelen in <code className="rounded bg-zinc-100 px-1">.env.local</code> (of op de VM) en klik daarna op &ldquo;Data verversen&rdquo;.
          </p>
        </div>
      </main>
    );
  }

  const syncInfo = getAdsSyncInfo().filter((s) => accountKeys.includes(s.account_key.replace(/^ads:/, "")));
  const errs = syncInfo.filter((s) => s.status === "error");
  const err = errs[0];

  // 2) Geconfigureerd maar nog geen data gesynct
  if (!adsHasData(accountKeys)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Header />
        <DienstBanner />
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

  const overview = getAdsOverview(period, accountKeys);
  const campaigns = getAdsCampaigns(period, accountKeys);
  const coverage = getServiceCoverage(period, accountKeys);
  const perAccount = getAdsAccountsSummary(period, PIPEDRIVE);
  const withAds = coverage.filter((c) => c.everAds);
  const withoutAds = coverage.filter((c) => !c.everAds);
  const activeCampaigns = campaigns.filter((c) => c.status === "ENABLED");

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="kopbalk">
        <Header />
        <DienstBanner />
        <div className="flex flex-wrap gap-2 text-[11.5px]">
          <SyncFreshness />
          {accounts.map((a) => (
            <span
              key={a.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-emerald-800"
              title={`Google Ads ${a.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`}
            >
              Account: <b>{a.label}</b>
            </span>
          ))}
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
            ...(meerdere ? [{ id: "accounts", label: "Per account" }] : []),
            { id: "dekking", label: "Dekking & gap" },
            { id: "rendement", label: "Rendement (leads)" },
            { id: "campagnes", label: "Campagnes" },
          ]}
        />
      </div>

      {errs.map((e) => (
        <div key={e.account_key} className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Let op: de laatste Google Ads-sync van {adsLabel(e.account_key)} gaf een fout ({e.message}). De getoonde cijfers kunnen verouderd zijn.
        </div>
      ))}

      {/* KPI's */}
      <section id="overzicht" className="mb-8 grid scroll-mt-40 grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-2 paneel donker">
          <div className="label">Advertentiekosten</div>
          <div className="kpi-groot">{euro(overview.spend)}</div>
          <div className="mt-auto text-[11.5px] opacity-60">
            {num(overview.activeCampaigns)} actieve · {num(overview.totalCampaigns)} campagnes
            {meerdere && ` · ${num(accounts.length)} accounts`}
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

      {/* Per Google Ads-account: kosten en kost per aanvraag naast elkaar */}
      {meerdere && (
        <section id="accounts" className="mb-8 scroll-mt-40">
          <Card title="Per account — kosten en kost per aanvraag">
            <p className="mb-3 -mt-1 text-xs text-zinc-500">
              Elk Google Ads-account apart, zodat de kost per aanvraag per account leesbaar blijft. Leads = UNABO-aanvragen (Pipedrive) voor de diensten waarvoor dat account campagnes heeft.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="py-2 pr-3 font-medium">Account</th>
                    <th className="py-2 pr-3 font-medium">Diensten</th>
                    <th className="py-2 pr-3 text-right font-medium">Kosten</th>
                    <th className="py-2 pr-3 text-right font-medium">Klikken</th>
                    <th className="py-2 pr-3 text-right font-medium">Conv. (Google)</th>
                    <th className="py-2 pr-3 text-right font-medium">Leads</th>
                    <th className="py-2 pr-3 text-right font-medium">Gewonnen</th>
                    <th className="py-2 pr-3 text-right font-medium">Kost/aanvraag</th>
                    <th className="py-2 pr-3 text-right font-medium">Campagnes</th>
                    <th className="py-2 pr-3 font-medium">Laatste sync</th>
                  </tr>
                </thead>
                <tbody>
                  {perAccount.map((a) => (
                    <tr key={a.key} className="border-b border-zinc-100">
                      <td className="py-2 pr-3">
                        <div className="text-zinc-800">{a.label}</div>
                        <div className="text-[11px] text-zinc-400">{a.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}</div>
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {a.services.length === 0 ? (
                          <span className="text-zinc-400">nog geen campagnes</span>
                        ) : (
                          a.services.map((k) => serviceName(k)).join(", ")
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{euro(a.overview.spend)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(a.overview.clicks)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{num(Math.round(a.overview.conversions))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{a.services.length > 0 ? num(a.leads) : "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">{a.services.length > 0 ? num(a.won) : "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium text-zinc-900">
                        {a.costPerLead != null ? euro(a.costPerLead) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-600">
                        {num(a.overview.activeCampaigns)} actief · {num(a.overview.totalCampaigns)}
                      </td>
                      <td className="py-2 pr-3 text-[11.5px] text-zinc-500">
                        {a.sync ? (
                          <span className={a.sync.status === "error" ? "text-red-600" : ""}>
                            {a.sync.last_sync ? new Date(a.sync.last_sync).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }) : "—"}
                            {a.sync.status === "error" && " · fout"}
                          </span>
                        ) : (
                          <span className="text-zinc-400">nog niet gesynct</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

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
            {num(activeCampaigns.length)} actief{meerdere && `, over ${num(accounts.length)} Google Ads-accounts`}. Klik op de landingspagina om te zien wat de bezoeker ziet. Gesorteerd op kosten.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Campagne</th>
                  {meerdere && <th className="py-2 pr-3 font-medium">Account</th>}
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
                  <tr key={`${c.accountKey}:${c.campaignId}`} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <span className="text-zinc-800">{c.name}</span>
                      </div>
                    </td>
                    {meerdere && <td className="py-2 pr-3 text-zinc-600">{c.accountLabel}</td>}
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
