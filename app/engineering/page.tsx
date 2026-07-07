import {
  getEngineeringKpisWithDelta,
  getEngineeringCombined,
  getEngineeringServices,
  getEngineeringByMonth,
  getEngineeringChannels,
  getEngineeringLostReasons,
  getEngineeringActivity,
  getEngineeringBundleSplit,
  getEngineeringMotivation,
  getEngineeringProjectType,
  getEngineeringOfferteStats,
  type ActivityGranularity,
  hasData,
  periodRange,
  isValidPeriod,
  monthOptions2026,
  weekOptions2026,
  PERIOD_OPTIONS,
  type Period,
} from "@/lib/queries";
import { THEMES, getTheme } from "@/lib/themes";
import { euro, num } from "@/lib/format";
import { EngineeringTrendChart, ChannelChart, RequestsBarChart, WonBarChart, LostBarChart } from "@/components/Charts";
import { ServiceTable } from "@/components/ServiceTable";
import { ChannelTable } from "@/components/ChannelTable";
import { LostReasonsTable } from "@/components/LostReasonsTable";
import { SubNav } from "@/components/SubNav";
import { AnalysePanel } from "@/components/AnalysePanel";
import { PeriodSelector, MonthSelector, WeekSelector, GranularitySelector, ThemeSelector } from "@/components/Controls";
import { Kpi, Card, Highlight, CombineRow } from "@/components/ui";
import { LastSync } from "@/components/LastSync";

export const dynamic = "force-dynamic";

const PATH = "/engineering";
const THEME_OPTIONS = THEMES.map((t) => ({ key: t.key, label: t.label }));

export default async function EngineeringPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; g?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = isValidPeriod(sp.period) ? (sp.period as Period) : "ytd";
  const granularity: ActivityGranularity = sp.g === "week" ? "week" : "month";
  const themeKey = getTheme(sp.t)?.key;
  const themeLabel = getTheme(sp.t)?.label;
  const periodLabel = periodRange(period).label;
  const monthOpts = monthOptions2026();
  const weekOpts = weekOptions2026();
  const params = sp as Record<string, string | undefined>;

  if (!hasData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-zinc-500">Nog geen data. Ga naar het Algemeen dashboard en klik op &ldquo;Data verversen&rdquo;.</p>
      </main>
    );
  }

  const kpis = getEngineeringKpisWithDelta(period, themeKey);
  const eng = getEngineeringCombined(period, themeKey);
  const bundle = getEngineeringBundleSplit(period, themeKey);
  const services = getEngineeringServices(period, themeKey);
  const trend = getEngineeringByMonth(period, themeKey);
  const channels = getEngineeringChannels(period, themeKey);
  const channelLeadTotal = channels.reduce((a, c) => a + c.leads, 0);
  const lost = getEngineeringLostReasons(period, themeKey);
  const activity = getEngineeringActivity(period, granularity, themeKey);
  const motivation = getEngineeringMotivation(period);
  const projectType = getEngineeringProjectType(period, themeKey);
  const offerte = getEngineeringOfferteStats(period, themeKey);

  // motivatie: Ja/Nee-rollup
  const inflRollup = motivation.influenceable.reduce<Record<string, number>>((acc, r) => {
    const k = r.label.startsWith("Ja") ? "Wél beïnvloedbaar" : r.label.startsWith("Nee") ? "Niet beïnvloedbaar" : "Onbekend";
    acc[k] = (acc[k] || 0) + r.count;
    return acc;
  }, {});

  // Inzicht-highlights (per dienst)
  const bestseller = services.reduce<typeof services[number] | null>(
    (best, s) => (!best || s.soldCount > best.soldCount ? s : best),
    null
  );
  const mostRequested = services.reduce<typeof services[number] | null>(
    (best, s) => (!best || s.requests > best.requests ? s : best),
    null
  );
  const fastest = services
    .filter((s) => s.soldCount >= 2 && s.avgDays != null)
    .reduce<typeof services[number] | null>(
      (best, s) => (!best || (s.avgDays as number) < (best.avgDays as number) ? s : best),
      null
    );

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-black/10 bg-[#d7dde7]/85 px-6 pt-7 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Engineering</h1>
            <p className="text-[12.5px] text-zinc-500">UNABO Engineering + TKN-Buro · lead-scope</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector options={PERIOD_OPTIONS} current={period} params={params} path={PATH} />
            {monthOpts.length > 0 && <MonthSelector options={monthOpts} current={period} params={params} path={PATH} />}
            {weekOpts.length > 0 && <WeekSelector options={weekOpts} current={period} params={params} path={PATH} />}
            <ThemeSelector options={THEME_OPTIONS} current={themeKey || ""} params={params} path={PATH} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11.5px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Periode: <b className="text-zinc-800">{periodLabel}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Weergave: <b className="text-zinc-800">{granularity === "week" ? "Per week" : "Per maand"}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Thema: <b className="text-zinc-800">{themeLabel || "Alle"}</b>
          </span>
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-zinc-400">
            Leads &amp; open op aanmaakdatum · gewonnen op win-datum · omzet op product-prijs
          </span>
        </div>
        <SubNav
          items={[
            { id: "overzicht", label: "Overzicht" },
            { id: "analyse", label: "Analyse & advies" },
            { id: "overtijd", label: "Over tijd" },
            { id: "kanalen", label: "Kanalen" },
            { id: "verlies", label: "Verlies" },
            { id: "omzet", label: "Omzet & bundel" },
            { id: "diensten", label: "Diensten" },
            { id: "projecttype", label: "Projecttype" },
          ]}
        />
      </div>

      {/* KPI's */}
      <section id="overzicht" className="mb-8 grid scroll-mt-40 grid-cols-2 gap-4 lg:grid-cols-4">
        {/* primaire KPI (omzet) */}
        <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-[#16204a] to-[#243a86] p-5 text-white shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-200">Omzet (gewonnen)</div>
          <div className="text-[30px] font-extrabold leading-none tracking-tight">{euro(kpis.wonValue)}</div>
          <Delta v={kpis.dWonValue} hero />
          <div className="mt-auto text-[11.5px] text-indigo-200/80">op product-prijs</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Aanvragen</div>
          <div className="text-2xl font-bold text-zinc-900">{num(kpis.requests)}</div>
          <Delta v={kpis.dRequests} />
          <div className="text-xs text-zinc-500">leads binnengekomen in periode</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Verkocht</div>
          <div className="text-2xl font-bold text-zinc-900">{num(kpis.wonCount)}</div>
          <Delta v={kpis.dWonCount} />
          <div className="text-xs text-zinc-500">gewonnen deals in periode</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Gem. tijd tot verkoop</div>
          <div className="text-2xl font-bold text-zinc-900">{kpis.avgDays != null ? `${num(kpis.avgDays)} dagen` : "—"}</div>
          <div className="mt-auto text-xs text-zinc-500">aanvraag → gewonnen</div>
        </div>
      </section>

      {/* Offerte-strip */}
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm">
          <span className="font-semibold text-zinc-700">Offertes</span>
          <span className="text-zinc-600">
            <strong className="text-zinc-900">{num(offerte.offerteCount)}</strong> verstuurd
            {offerte.leadCount > 0 && (
              <span className="text-zinc-400"> · {Math.round((offerte.offerteCount / offerte.leadCount) * 100)}% van de aanvragen</span>
            )}
          </span>
          <span className="text-zinc-600">
            Gem. aanvraag → offerte:{" "}
            <strong className="text-zinc-900">{offerte.avgDaysToOfferte != null ? `${num(offerte.avgDaysToOfferte)} dagen` : "—"}</strong>
            <span className="ml-1 text-xs text-amber-700">
              (indicatief — enkel deals nu in offerte-fase, n={num(offerte.timingSample)}; volledige tijd vergt deal-flow)
            </span>
          </span>
        </div>
      </section>

      {/* Analyse & advies (Claude AI) */}
      <AnalysePanel period={period} themeKey={themeKey} />

      {/* Aanvragen / gewonnen / verloren over tijd — apart */}
      <section id="overtijd" className="mb-8 scroll-mt-40">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Over tijd (per {granularity === "week" ? "week" : "maand"})</h2>
            <p className="text-xs text-zinc-500">
              Aanvragen op aanmaakdatum · gewonnen op win-datum · verloren op verlies-datum.
            </p>
          </div>
          <GranularitySelector current={granularity} params={params} path={PATH} />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <Card title={`Aanvragen per ${granularity === "week" ? "week" : "maand"}`}>
            <RequestsBarChart data={activity} />
          </Card>
          <Card title={`Gewonnen per ${granularity === "week" ? "week" : "maand"}`}>
            <WonBarChart data={activity} />
          </Card>
          <Card title={`Verloren per ${granularity === "week" ? "week" : "maand"}`}>
            <LostBarChart data={activity} />
          </Card>
        </div>
      </section>

      {/* Aanvragen per kanaal (hoofd/subkanaal) */}
      <section id="kanalen" className="mb-8 scroll-mt-40">
        <Card title="Aanvragen per kanaal">
          {channels.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Geen aanvragen in deze periode.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChannelChart data={channels} />
              <div>
                <ChannelTable rows={channels} total={channelLeadTotal} />
                <p className="mt-2 text-xs text-zinc-400">
                  Klik een hoofdkanaal open voor de subkanalen (partners). Kanaal komt uit het deal-label;
                  vertaling in <code className="rounded bg-zinc-100 px-1">config/engineering.json</code>.
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Verlies-redenen (gecombineerd + genormaliseerd, enkel 2026) */}
      <section id="verlies" className="mb-8 scroll-mt-40">
        <Card title="Verlies-redenen — UNABO Engineering + TKN-Buro samen (enkel 2026)">
          {lost.outside2026 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Dit overzicht toont enkel data van 2026. Kies een periode binnen 2026.
            </p>
          ) : lost.reasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Geen verloren deals in deze periode.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-zinc-500">
                {num(lost.total)} verloren deals in 2026. Redenen zijn samengevoegd en opgeteld over beide
                Pipedrives. <strong>Hover</strong> over een reden voor de deals, of <strong>klik</strong> om alle
                deals te openen (met link naar Pipedrive).
              </p>
              <LostReasonsTable reasons={lost.reasons} total={lost.total} />

              {/* Motivatie — Invloedbaar door UNABO? (UNABO-data) */}
              {!motivation.outside2026 && motivation.filledInfluenceable > 0 && (
                <div className="mt-6 border-t border-zinc-100 pt-4">
                  <h4 className="mb-1 text-sm font-semibold text-zinc-700">
                    Was het verlies beïnvloedbaar door UNABO?
                  </h4>
                  <p className="mb-3 text-xs text-zinc-400">
                    Uit het verplichte veld &ldquo;Invloedbaar door UNABO?&rdquo; ({num(motivation.filledInfluenceable)} van{" "}
                    {num(motivation.total)} verloren UNABO-deals ingevuld). TKN-Buro heeft dit veld niet.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Object.entries(inflRollup).map(([k, v]) => (
                      <div
                        key={k}
                        className={
                          "rounded-lg border p-3 " +
                          (k.startsWith("Wél") ? "border-red-200 bg-red-50" : k.startsWith("Niet") ? "border-green-200 bg-green-50" : "border-zinc-200 bg-zinc-50")
                        }
                      >
                        <div className="text-xs uppercase tracking-wide text-zinc-500">{k}</div>
                        <div className="text-lg font-bold text-zinc-900">{num(v)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {motivation.influenceable.map((r) => (
                          <tr key={r.label} className="border-b border-zinc-100">
                            <td className="py-1.5 pr-4 text-zinc-600">{r.label}</td>
                            <td className="py-1.5 pr-4 text-right font-medium text-zinc-800">{num(r.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      {/* Trend + verdeling + bundel/los */}
      <section id="omzet" className="mb-8 grid scroll-mt-40 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Aanvragen vs. direct gewonnen omzet (zelfde maand)">
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              Eerlijke vergelijking: de balken tonen <strong>leads die in die maand binnenkwamen</strong>; de lijn
              toont <strong>omzet uit deals die in diezelfde maand zijn aangemaakt én gewonnen</strong> (meteen
              gewonnen). Zo zie je hoeveel van de maand-instroom je direct binnenhaalt (deals die later winnen,
              tellen mee in hún aanvraagmaand).
            </div>
            <EngineeringTrendChart data={trend} />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Verdeling omzet (gewonnen)">
            <div className="space-y-3">
              <CombineRow label="UNABO Engineering" won={eng.unaboEngWon} open={eng.unaboEngOpen} />
              <CombineRow label="TKN-Buro (totaal)" won={eng.tknWon} open={eng.tknOpen} />
              <div className="border-t border-zinc-200 pt-3">
                <CombineRow label="Totaal" won={eng.totalWon} open={eng.totalOpen} bold />
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              TKN-Buro op deal value; UNABO Engineering op product-prijs. Open waarde oogt laag: veel open deals
              hebben (nog) geen bedrag ingevuld.
            </p>
          </Card>
          <Card title="Bundel vs. los (gewonnen)">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Los verkocht</span>
                <span className="font-medium text-zinc-800">{num(bundle.losCount)} · {euro(bundle.losValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">In bundel</span>
                <span className="font-medium text-zinc-800">{num(bundle.bundelCount)}</span>
              </div>
              {bundle.bundelCount > 0 && (
                <div className="rounded-lg bg-zinc-50 p-2 text-xs text-zinc-500">
                  Bundel deal value: <strong className="text-zinc-700">{euro(bundle.bundelDealValue)}</strong> ·
                  waarvan engineering: <strong className="text-zinc-700">{euro(bundle.bundelEngValue)}</strong>
                  <div className="mt-0.5">
                    Verschil (andere diensten in de bundel): {euro(bundle.bundelDealValue - bundle.bundelEngValue)}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* Analyse per dienst */}
      <section id="diensten" className="mb-8 scroll-mt-40">
        <Card title="Analyse per dienst">
          {services.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Geen Engineering-diensten in deze periode.</p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Highlight
                  label="Meest verkocht"
                  value={bestseller?.service ?? "—"}
                  sub={bestseller ? `${num(bestseller.soldCount)} verkocht · ${euro(bestseller.revenue)}` : ""}
                  tone="green"
                />
                <Highlight
                  label="Snelst verkocht"
                  value={fastest?.service ?? "—"}
                  sub={fastest ? `gem. ${num(fastest.avgDays as number)} dagen · ${num(fastest.soldCount)} verkocht` : "te weinig data"}
                  tone="blue"
                />
                <Highlight
                  label="Meeste aanvragen"
                  value={mostRequested?.service ?? "—"}
                  sub={mostRequested ? `${num(mostRequested.requests)} keer aangevraagd` : ""}
                  tone="amber"
                />
              </div>
              <p className="mb-2 text-xs text-zinc-400">
                Klik op een kolomtitel om te sorteren. &ldquo;Aanvragen&rdquo; hier = aantal keer dat de dienst op
                een deal is aangevraagd (productregels), niet het aantal leads.
              </p>
              <ServiceTable rows={services} />
            </>
          )}
        </Card>
      </section>

      {/* Projecttype (NIEUW — nog niet volledig gevuld) */}
      <section id="projecttype" className="mb-8 scroll-mt-40">
        <Card title="Projecttype (UNABO Engineering)">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 font-semibold text-white">NIEUW</span>
            Deze velden zijn net ingevoerd en nog niet volledig ingevuld — behandel als indicatief, nog geen
            harde conclusies.
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-zinc-700">Gebouwtype</span>
                <span className="text-xs text-zinc-400">
                  {num(projectType.gebouwtypeFilled)}/{num(projectType.total)} ingevuld (
                  {projectType.total ? Math.round((projectType.gebouwtypeFilled / projectType.total) * 100) : 0}%)
                </span>
              </div>
              {projectType.gebouwtype.length === 0 ? (
                <p className="py-3 text-sm text-zinc-400">Nog niet gevuld.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {projectType.gebouwtype.map((r) => (
                      <tr key={r.label} className="border-b border-zinc-100">
                        <td className="py-1.5 pr-4 text-zinc-700">{r.label}</td>
                        <td className="py-1.5 text-right font-medium text-zinc-800">{num(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-zinc-700">Type aanvraag / situatie</span>
                <span className="text-xs text-zinc-400">
                  {num(projectType.typeAanvraagFilled)}/{num(projectType.total)} ingevuld (
                  {projectType.total ? Math.round((projectType.typeAanvraagFilled / projectType.total) * 100) : 0}%)
                </span>
              </div>
              {projectType.typeAanvraag.length === 0 ? (
                <p className="py-3 text-sm text-zinc-400">Nog niet gevuld.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {projectType.typeAanvraag.map((r) => (
                      <tr key={r.label} className="border-b border-zinc-100">
                        <td className="py-1.5 pr-4 text-zinc-700">{r.label}</td>
                        <td className="py-1.5 text-right font-medium text-zinc-800">{num(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Card>
      </section>

      <LastSync />
    </main>
  );
}

function Delta({ v, hero = false }: { v: number | null; hero?: boolean }) {
  if (v == null) {
    return <span className={"text-[11.5px] " + (hero ? "text-indigo-200/70" : "text-zinc-400")}>geen vergelijking</span>;
  }
  const up = v >= 0;
  const pill = hero
    ? up
      ? "bg-emerald-400/15 text-emerald-300"
      : "bg-red-400/20 text-red-300"
    : up
      ? "bg-emerald-50 text-emerald-600"
      : "bg-red-50 text-red-500";
  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold">
      <span className={"rounded-md px-1.5 py-0.5 text-[11px] " + pill}>
        {up ? "▲" : "▼"} {Math.abs(v)}%
      </span>
      <span className={hero ? "text-indigo-200/80" : "text-zinc-400"}>vs. vorige periode</span>
    </span>
  );
}
