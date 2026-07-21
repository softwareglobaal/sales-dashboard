import {
  getEnergyKpisWithDelta,
  getEnergyServices,
  getEnergyByMonth,
  getEnergyChannels,
  getEnergyLostReasons,
  getEnergyActivity,
  getEnergyTiming,
  energyHasData,
  periodRange,
} from "@/lib/energyQueries";
import {
  isValidPeriod,
  monthOptions2026,
  weekOptions2026,
  PERIOD_OPTIONS,
  type Period,
  type ActivityGranularity,
} from "@/lib/queries";
import { euro, num } from "@/lib/format";
import { EngineeringTrendChart, ChannelChart, RequestsBarChart, WonBarChart, LostBarChart, TimingBars } from "@/components/Charts";
import { ServiceTable } from "@/components/ServiceTable";
import { ChannelTable } from "@/components/ChannelTable";
import { LostReasonsTable } from "@/components/LostReasonsTable";
import { SubNav } from "@/components/SubNav";
import { SyncFreshness } from "@/components/SyncFreshness";
import { PeriodSelector, MonthSelector, WeekSelector, GranularitySelector } from "@/components/Controls";
import { Card, Highlight } from "@/components/ui";
import { LastSync } from "@/components/LastSync";

export const dynamic = "force-dynamic";

const PATH = "/energy";

export default async function EnergyPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; g?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = isValidPeriod(sp.period) ? (sp.period as Period) : "ytd";
  const granularity: ActivityGranularity = sp.g === "week" ? "week" : "month";
  const periodLabel = periodRange(period).label;
  const monthOpts = monthOptions2026();
  const weekOpts = weekOptions2026();
  const params = sp as Record<string, string | undefined>;

  if (!energyHasData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-zinc-500">
          Nog geen Energy-data. Ga naar het Algemeen dashboard en klik op &ldquo;Data verversen&rdquo;.
        </p>
      </main>
    );
  }

  const kpis = getEnergyKpisWithDelta(period);
  const services = getEnergyServices(period);
  const trend = getEnergyByMonth(period);
  const channels = getEnergyChannels(period);
  const channelLeadTotal = channels.reduce((a, c) => a + c.leads, 0);
  const lost = getEnergyLostReasons(period);
  const activity = getEnergyActivity(period, granularity);
  const timing = getEnergyTiming(period);

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

  const conversion = kpis.requests > 0 ? Math.round((kpis.wonCount / kpis.requests) * 100) : null;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-black/10 bg-[#d7dde7]/85 px-6 pt-7 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Energy</h1>
            <p className="text-[12.5px] text-zinc-500">UNABO Energy · lead-scope (ENERGY-product óf UNABO-Energy-pipeline)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector options={PERIOD_OPTIONS} current={period} params={params} path={PATH} />
            {monthOpts.length > 0 && <MonthSelector options={monthOpts} current={period} params={params} path={PATH} />}
            {weekOpts.length > 0 && <WeekSelector options={weekOpts} current={period} params={params} path={PATH} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11.5px]">
          <SyncFreshness />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-emerald-800">
            Firma: <b>UNABO Energy</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Periode: <b className="text-zinc-800">{periodLabel}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Weergave: <b className="text-zinc-800">{granularity === "week" ? "Per week" : "Per maand"}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 font-medium text-zinc-600">
            Alle bedragen <b className="text-zinc-800">excl. btw</b>
          </span>
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-zinc-400">
            Leads &amp; open op aanmaakdatum · gewonnen op win-datum · omzet op product-prijs
          </span>
        </div>
        <SubNav
          items={[
            { id: "overzicht", label: "Overzicht" },
            { id: "overtijd", label: "Over tijd" },
            { id: "timing", label: "Dag & uur" },
            { id: "kanalen", label: "Kanalen" },
            { id: "verlies", label: "Verlies" },
            { id: "omzet", label: "Omzet" },
            { id: "diensten", label: "Diensten" },
          ]}
        />
      </div>

      {/* KPI's */}
      <section id="overzicht" className="mb-8 grid scroll-mt-40 grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Conversie-strip */}
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm">
          <span className="font-semibold text-zinc-700">Conversie</span>
          <span className="text-zinc-600">
            <strong className="text-zinc-900">{conversion != null ? `${conversion}%` : "—"}</strong>
            <span className="ml-1 text-xs text-zinc-400">
              (gewonnen/aanvragen deze periode — kies een langere periode voor een stabieler cijfer)
            </span>
          </span>
        </div>
      </section>

      {/* Aanvragen / gewonnen / verloren over tijd */}
      <section id="overtijd" className="mb-8 scroll-mt-40">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Over tijd (per {granularity === "week" ? "week" : "maand"})</h2>
            <p className="text-xs text-zinc-500">Aanvragen op aanmaakdatum · gewonnen op win-datum · verloren op verlies-datum.</p>
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

      {/* Wanneer komen aanvragen binnen (dag / uur) */}
      <section id="timing" className="mb-8 scroll-mt-40">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-zinc-900">Wanneer komen aanvragen binnen?</h2>
          <p className="text-xs text-zinc-500">
            Op basis van de aanmaakdatum/-tijd van de aanvraag (Belgische tijd).{" "}
            {timing.total > 0 ? `${num(timing.total)} aanvragen in deze periode.` : ""}
          </p>
        </div>
        {timing.total === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400 shadow-sm">
            Geen aanvragen in deze periode.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Per weekdag">
              <TimingBars data={timing.byWeekday} name="Aanvragen" color="#6366f1" />
            </Card>
            <Card title="Per uur van de dag">
              <TimingBars data={timing.byHour} name="Aanvragen" color="#0891b2" />
            </Card>
          </div>
        )}
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
                  Klik een hoofdkanaal open voor de subkanalen. Kanaal komt uit het deal-label; vertaling in{" "}
                  <code className="rounded bg-zinc-100 px-1">config/engineering.json</code>.
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Verlies-redenen (genormaliseerd, enkel 2026) */}
      <section id="verlies" className="mb-8 scroll-mt-40">
        <Card title="Verlies-redenen — UNABO Energy (enkel 2026)">
          {lost.outside2026 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Dit overzicht toont enkel data van 2026. Kies een periode binnen 2026.</p>
          ) : lost.reasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Geen verloren deals in deze periode.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-zinc-500">
                {num(lost.total)} verloren deals in 2026. Redenen zijn samengevoegd en opgeteld. <strong>Hover</strong> over een
                reden voor de deals, of <strong>klik</strong> om alle deals te openen (met link naar Pipedrive).
              </p>
              <LostReasonsTable reasons={lost.reasons} total={lost.total} />
            </>
          )}
        </Card>
      </section>

      {/* Aanvragen vs. omzet die dezelfde maand meteen werd gewonnen */}
      <section id="omzet" className="mb-8 scroll-mt-40">
        <Card title="Aanvragen vs. omzet die dezelfde maand meteen werd gewonnen">
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
            <b>Wat toont dit?</b> De balken = <strong>alle aanvragen (leads) die in die maand binnenkwamen</strong>. De lijn =
            enkel de <strong>omzet uit deals die in diezelfde maand zijn binnengekomen én meteen gewonnen</strong>. Deals die
            pas later winnen, tellen niet in de lijn maar wél in hun aanvraagmaand-balk. Dit is dus géén totale maandomzet — voor
            de volledige gewonnen omzet: zie de KPI bovenaan of &ldquo;Over tijd → Gewonnen&rdquo;.
          </div>
          <EngineeringTrendChart data={trend} />
        </Card>
      </section>

      {/* Analyse per dienst */}
      <section id="diensten" className="mb-8 scroll-mt-40">
        <Card title="Analyse per dienst">
          {services.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Geen Energy-diensten in deze periode.</p>
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
                Klik op een kolomtitel om te sorteren. &ldquo;Aanvragen&rdquo; hier = aantal keer dat de dienst op een deal is
                aangevraagd (productregels), niet het aantal leads. <b className="text-zinc-500">Let op:</b> &ldquo;verkocht&rdquo;
                kan hoger zijn dan &ldquo;aanvragen&rdquo; in dezelfde periode (aanvragen tellen op aanvraagdatum, verkocht op
                win-datum).
              </p>
              <ServiceTable rows={services} />
            </>
          )}
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
