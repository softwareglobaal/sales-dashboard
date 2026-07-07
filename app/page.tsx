import { ACCOUNTS } from "@/lib/accounts";
import {
  getAccountStats,
  getTotals,
  getLeadsByMonth,
  getLeadsByPipeline,
  getPipelineOptions,
  getFunnel,
  getLostReasons,
  getUnaboDepartments,
  getEngineeringCombined,
  getSyncStatus,
  hasData,
  periodRange,
  isValidPeriod,
  monthOptions2026,
  weekOptions2026,
  PERIOD_OPTIONS,
  type Period,
} from "@/lib/queries";
import Link from "next/link";
import { THEMES, getTheme } from "@/lib/themes";
import { euro, num, pct, dateTime } from "@/lib/format";
import { LeadsByMonthChart, ValueByAccountChart, FunnelChart, DepartmentChart } from "@/components/Charts";
import { SyncButton } from "@/components/SyncButton";
import { NotesPanel } from "@/components/NotesPanel";
import { PeriodSelector, MonthSelector, WeekSelector, ThemeSelector, FunnelPicker } from "@/components/Controls";
import { Kpi, Card, CombineRow } from "@/components/ui";

export const dynamic = "force-dynamic";

const THEME_OPTIONS = THEMES.map((t) => ({ key: t.key, label: t.label }));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; fa?: string; fp?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = isValidPeriod(sp.period) ? (sp.period as Period) : "ytd";
  const themeKey = getTheme(sp.t)?.key;
  const themeLabel = getTheme(sp.t)?.label;
  const periodLabel = periodRange(period).label;
  const monthOpts = monthOptions2026();
  const weekOpts = weekOptions2026();
  const params = sp as Record<string, string | undefined>;

  const dataPresent = hasData();
  const syncStatus = getSyncStatus();

  if (!dataPresent) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Header period={period} monthOpts={monthOpts} weekOpts={weekOpts} themeKey={themeKey} params={params} />
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-800">Nog geen data</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Klik op <strong>&ldquo;Data verversen&rdquo;</strong> rechtsboven om je deals uit de 4
            Pipedrive-accounts op te halen.
          </p>
        </div>
      </main>
    );
  }

  const stats = getAccountStats(period);
  const totals = getTotals(period);
  const leadsByMonth = getLeadsByMonth(period);
  const leadsByPipeline = getLeadsByPipeline(period, 12);
  const lostReasons = getLostReasons(period, 8);

  // Trechter: gekozen pipeline (default = grootste)
  const pipelineOptions = getPipelineOptions();
  const selFa = sp.fa || pipelineOptions[0]?.account_key || "";
  const selFp = sp.fp || pipelineOptions[0]?.pipeline || "";
  const funnel = selFa && selFp ? getFunnel(period, selFa, selFp) : [];

  // UNABO afdelingen + gecombineerd Engineering (thema-filterbaar; productgebaseerd)
  const departments = getUnaboDepartments(period, themeKey);
  const eng = getEngineeringCombined(period, themeKey);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-black/10 bg-[#d7dde7]/85 px-6 pt-7 backdrop-blur-md">
        <Header period={period} monthOpts={monthOpts} weekOpts={weekOpts} themeKey={themeKey} params={params} />
        <div className="flex flex-wrap gap-2 pb-3 text-[11.5px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Periode: <b className="text-zinc-800">{periodLabel}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Thema: <b className="text-zinc-800">{themeLabel || "Alle"}</b>
          </span>
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-zinc-400">
            Leads &amp; open = aangemaakt · gewonnen &amp; verloren = afgesloten (win-/verlies-datum)
          </span>
        </div>
      </div>
      {themeLabel && (
        <p className="-mt-2 mb-4 text-xs text-violet-700">
          Thema-filter <strong>{themeLabel}</strong> actief. Dit filtert de productgebaseerde secties
          (UNABO-afdelingen, Engineering); de accounttotalen blijven ongefilterd.
        </p>
      )}

      {/* KPI-kaarten */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Nieuwe leads" value={num(totals.leadCount)} sub="aangemaakt in periode" />
        <Kpi label="Open" value={`${num(totals.openCount)} deals`} sub={euro(totals.openValue)} />
        <Kpi label="Gewonnen" value={`${num(totals.wonCount)} deals`} sub={euro(totals.wonValue)} />
        <Kpi label="Win-ratio" value={pct(totals.winRate)} sub={`${num(totals.lostCount)} verloren`} />
      </section>

      {/* Grafieken */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Leadinstroom per maand">
          <LeadsByMonthChart data={leadsByMonth} accounts={ACCOUNTS} />
        </Card>
        <Card title="Open vs. gewonnen waarde per account">
          <ValueByAccountChart
            data={stats.map((s) => ({
              name: s.name,
              openValue: Math.round(s.openValue),
              wonValue: Math.round(s.wonValue),
            }))}
          />
        </Card>
      </section>

      {/* Vergelijkingstabel */}
      <section className="mb-8">
        <Card title="Vergelijking per account">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Account</th>
                  <th className="py-2 pr-4 text-right font-medium">Nieuwe leads</th>
                  <th className="py-2 pr-4 text-right font-medium">Open</th>
                  <th className="py-2 pr-4 text-right font-medium">Open waarde</th>
                  <th className="py-2 pr-4 text-right font-medium">Gewonnen</th>
                  <th className="py-2 pr-4 text-right font-medium">Gewonnen waarde</th>
                  <th className="py-2 pr-4 text-right font-medium">Verloren</th>
                  <th className="py-2 pr-4 text-right font-medium">Win-ratio</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.key} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: s.color }} />
                      {s.name}
                    </td>
                    <td className="py-2 pr-4 text-right">{num(s.leadCount)}</td>
                    <td className="py-2 pr-4 text-right">{num(s.openCount)}</td>
                    <td className="py-2 pr-4 text-right">{euro(s.openValue)}</td>
                    <td className="py-2 pr-4 text-right">{num(s.wonCount)}</td>
                    <td className="py-2 pr-4 text-right">{euro(s.wonValue)}</td>
                    <td className="py-2 pr-4 text-right">{num(s.lostCount)}</td>
                    <td className="py-2 pr-4 text-right">{pct(s.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Instroom per pipeline + verlies-redenen */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Instroom per pipeline (brug naar Google Ads)">
          <ul className="divide-y divide-zinc-100">
            {leadsByPipeline.map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate font-medium text-zinc-800">{p.label}</span>
                  <span className="shrink-0 text-zinc-400">· {p.account}</span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="text-zinc-500">{num(p.won)} gewonnen</span>
                  <span className="w-20 text-right font-medium text-zinc-800">{num(p.leads)} leads</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Verlies-redenen">
          {lostReasons.length ? (
            <ul className="divide-y divide-zinc-100">
              {lostReasons.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-zinc-700">{r.reason}</span>
                  <span className="shrink-0 font-medium text-zinc-800">{num(r.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">Geen verloren deals in deze periode.</p>
          )}
        </Card>
      </section>

      {/* UNABO afdelingen (op product-prijs) */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="UNABO — omzet per afdeling (op product-prijs)">
            <DepartmentChart
              data={departments.map((d) => ({
                department: d.department,
                wonRevenue: d.wonRevenue,
                unassigned: d.unassigned,
              }))}
            />
            {departments.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-500">
                      <th className="py-2 pr-4 font-medium">Afdeling</th>
                      <th className="py-2 pr-4 text-right font-medium">Gewonnen omzet</th>
                      <th className="py-2 pr-4 text-right font-medium">Gewonnen regels</th>
                      <th className="py-2 pr-4 text-right font-medium">Open waarde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d.department} className={"border-b border-zinc-100 " + (d.unassigned ? "bg-red-50" : "")}>
                        <td className="py-2 pr-4">
                          {d.unassigned ? <span className="font-medium text-red-600">⚠ {d.department}</span> : d.department}
                        </td>
                        <td className="py-2 pr-4 text-right">{euro(d.wonRevenue)}</td>
                        <td className="py-2 pr-4 text-right">{num(d.wonLines)}</td>
                        <td className="py-2 pr-4 text-right">{euro(d.openValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-zinc-400">
                  Rood = producten zonder herkenbare afdeling (geen voorvoegsel vóór de dubbele punt). Corrigeer
                  de naam in Pipedrive om ze juist toe te wijzen.
                </p>
              </div>
            )}
          </Card>
        </div>

        <Card title="Engineering (TKN-Buro + UNABO Engineering)">
          <p className="mb-4 text-xs text-zinc-500">
            UNABO Engineering wordt gerund door TKN-Buro. Hier wordt de Engineering-omzet van UNABO (op product-prijs)
            opgeteld bij de volledige omzet van TKN-Buro.
          </p>
          <div className="space-y-3">
            <CombineRow label="UNABO Engineering" won={eng.unaboEngWon} open={eng.unaboEngOpen} />
            <CombineRow label="TKN-Buro (totaal)" won={eng.tknWon} open={eng.tknOpen} />
            <div className="border-t border-zinc-200 pt-3">
              <CombineRow label="Totaal" won={eng.totalWon} open={eng.totalOpen} bold />
            </div>
          </div>
          <Link
            href={`/engineering?period=${period}`}
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            → Open Engineering dashboard
          </Link>
        </Card>
      </section>

      {/* Trechter per fase */}
      <section className="mb-8">
        <Card title="Trechter per fase">
          <div className="mb-4">
            {pipelineOptions.length > 0 && (
              <FunnelPicker options={pipelineOptions} current={`${selFa}|||${selFp}`} params={params} />
            )}
          </div>
          <FunnelChart data={funnel} />
          <p className="mt-2 text-xs text-zinc-400">
            Hover over een balk voor het aantal open deals en de <strong>gemiddelde tijd in de huidige fase</strong>
            (indicatie van waar deals blijven hangen). Volledige tijd-per-fase over de hele historiek vergt de
            deal-flow en is nog niet beschikbaar.
          </p>
        </Card>
      </section>

      {/* Notities / to-do */}
      <section className="mb-8">
        <NotesPanel />
      </section>

      {/* Sync-status */}
      <section>
        <Card title="Synchronisatiestatus">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {syncStatus.map((s) => (
              <div key={s.account_key} className="rounded-lg border border-zinc-100 p-3 text-sm">
                <div className="font-medium text-zinc-800">{s.name}</div>
                <div className={s.status === "error" ? "text-red-600" : "text-zinc-500"}>
                  {s.status === "ok"
                    ? `${num(s.deal_count)} deals`
                    : s.status === "error"
                      ? "Fout"
                      : "Nog niet gesynct"}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{dateTime(s.last_sync)}</div>
                {s.status === "error" && s.message && (
                  <div className="mt-1 text-xs text-red-500">{s.message}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

function Header({
  period,
  monthOpts,
  weekOpts,
  themeKey,
  params,
}: {
  period: Period;
  monthOpts: { key: string; label: string }[];
  weekOpts: { key: string; label: string }[];
  themeKey?: string;
  params: Record<string, string | undefined>;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Sales &amp; Marketing Dashboard</h1>
        <p className="text-sm text-zinc-500">Pipedrive — {ACCOUNTS.map((a) => a.name).join(" · ")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector options={PERIOD_OPTIONS} current={period} params={params} />
        {monthOpts.length > 0 && <MonthSelector options={monthOpts} current={period} params={params} />}
        {weekOpts.length > 0 && <WeekSelector options={weekOpts} current={period} params={params} />}
        <ThemeSelector options={THEME_OPTIONS} current={themeKey || ""} params={params} />
        <SyncButton />
      </div>
    </header>
  );
}


