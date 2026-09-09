import {
  concurrentieHeeftData,
  getMarktKpis,
  getConcurrentenInMarkt,
  getSterksteOnline,
  getActiefstePubliceerders,
  getDienstenDekking,
  getSignalen,
  getCrawlStatus,
  getMarktBronnen,
  getZoekwoorden,
  getZoekwoordStatus,
  getAdverteerders,
  getLeaderboard,
  getHerschrijfKansen,
  getOnzeGscPosities,
  gscStatus,
  getArchitectRegios,
  getArchitectenPerProvincie,
  getArchitectenPerGemeente,
  getArchitectRegisterStatus,
  telNietGevolgdeArchitecten,
  type RegioFilter,
} from "@/lib/concurrentieQueries";
import { serpBron } from "@/lib/zoekwoorden";
import { gscBeschikbaar } from "@/lib/searchConsole";
import { num } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";
import { SubNav } from "@/components/SubNav";
import { Beoordeling } from "@/components/Beoordeling";

export const dynamic = "force-dynamic";

const MARKT = "architectuur" as const;
const ONS_DOMEIN = "h-architects.be";
const PAD = "/h-architects/concurrentie";

const TABS = [
  { id: "leaders", label: "Leaders" },
  { id: "regio", label: "Regio" },
  { id: "markt", label: "De markt" },
  { id: "concurrenten", label: "Concurrenten" },
  { id: "nakijken", label: "Nakijken" },
  { id: "diensten", label: "Diensten" },
  { id: "zoekwoorden", label: "Zoekwoorden" },
  { id: "signalen", label: "Signalen" },
];

/** Zie de Energie-pagina: bij een gehackte site is de nieuwste "publicatie" spam. */
function Datum({ d, href, verdacht }: { d: string | null; href?: string | null; verdacht?: boolean }) {
  if (verdacht) return <span className="text-zinc-400" title="Site gehackt — datum onbetrouwbaar">n.v.t.</span>;
  if (!d) return <span className="text-zinc-300">—</span>;
  const tekst = d.split("-").reverse().join("/");
  if (!href) return <span>{tekst}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener"
       className="text-blue-600 hover:underline" title="Open het laatste artikel">
      {tekst}
    </a>
  );
}

/** Pagina-aantal: 0 uit een sitemap is iets anders dan geen sitemap gevonden. */
function Paginas({ n, sitemap }: { n: number | null; sitemap: number | null }) {
  if (sitemap === 0) return <span className="text-zinc-400" title="Geen sitemap gevonden — aantal onbekend">geen sitemap</span>;
  if (n === null || n === undefined) return <span className="text-zinc-300">—</span>;
  return <>{num(n)}</>;
}

function Diensten({ json }: { json: string | null }) {
  let lijst: string[] = [];
  try { lijst = json ? JSON.parse(json) : []; } catch { lijst = []; }
  if (!lijst.length) return <span className="text-zinc-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {lijst.slice(0, 5).map((d) => (
        <span key={d} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{d}</span>
      ))}
      {lijst.length > 5 && <span className="text-[11px] text-zinc-400">+{lijst.length - 5}</span>}
    </div>
  );
}

export default async function ArchitectuurConcurrentiePage({
  searchParams,
}: {
  searchParams: Promise<{ toon?: string; provincie?: string; gemeente?: string }>;
}) {
  const sp = await searchParams;
  const toonAlles = sp.toon === "alles";

  if (!concurrentieHeeftData(MARKT)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-bold text-zinc-900">Concurrentie — Architectuur</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="font-medium">Het architectenregister is nog niet ingelezen</div>
          <p className="mt-1">
            Deze markt steunt op het publieke ledenregister van de Orde van Architecten
            (Vlaamse Raad). Het bronbestand staat in{" "}
            <code className="rounded bg-white px-1.5 py-0.5">data-bronnen/architecten-orde-2026-09.json</code>.
            Draai{" "}
            <code className="rounded bg-white px-1.5 py-0.5">/api/concurrentie?import=1&amp;crawl=0</code>{" "}
            om het in te lezen, en daarna{" "}
            <code className="rounded bg-white px-1.5 py-0.5">/api/concurrentie?herbereken=1</code>{" "}
            om de indeling te maken.
          </p>
        </div>
      </main>
    );
  }

  // ---- Regiofilter ------------------------------------------------------
  // De keuzes komen uit het register zelf, niet uit een vaste lijst: een
  // provincienaam die daar niet in staat kan hier nooit gekozen worden, en dus
  // ook nooit in de SQL belanden.
  const regios = getArchitectRegios(sp.provincie);
  const provincie = regios.provincies.some((p) => p.p === sp.provincie) ? sp.provincie : undefined;
  const gemeente =
    provincie && regios.gemeenten.some((g) => g.g === sp.gemeente) ? sp.gemeente : undefined;
  const regio: RegioFilter = { provincie, gemeente };
  const heeftRegio = Boolean(provincie || gemeente);
  const gebied = gemeente || provincie || "heel Vlaanderen";

  const k = getMarktKpis(MARKT, regio);
  const status = getCrawlStatus(MARKT);
  const bronnen0 = getMarktBronnen(MARKT);
  const reg = getArchitectRegisterStatus();
  const perProvincie = getArchitectenPerProvincie();
  const gemeenten = getArchitectenPerGemeente(provincie, 20);
  const perGemeente = gemeenten.rijen;
  const nietGevolgd = telNietGevolgdeArchitecten(regio);
  const sterkste = getSterksteOnline(15, MARKT, regio);
  const actiefste = getActiefstePubliceerders(10, MARKT, regio);
  const diensten = getDienstenDekking(MARKT, regio);
  const concurrenten = getConcurrentenInMarkt(MARKT, "concurrent", regio);
  const rest = getConcurrentenInMarkt(MARKT, "rest", regio);
  const signalen = getSignalen(40, MARKT);
  const wij = getConcurrentenInMarkt(MARKT, "eigen").find((c) => c.domein === ONS_DOMEIN);
  const zoekwoorden = getZoekwoorden(MARKT);
  const zwStatus = getZoekwoordStatus(MARKT);
  const adverteerders = getAdverteerders(15, MARKT);
  const leaderboard = getLeaderboard(8, 5, toonAlles, MARKT);
  const herschrijf = getHerschrijfKansen(12, MARKT);
  const gsc = gscBeschikbaar();
  const gscCijfers = gscStatus(MARKT);
  const onzePosities = getOnzeGscPosities(12, MARKT);

  const perTerm = leaderboard.reduce<Record<string, typeof leaderboard>>((acc, r) => {
    (acc[r.term] ||= []).push(r);
    return acc;
  }, {});
  const bron = serpBron();

  const bronnen = [
    {
      naam: "Register Orde van Architecten",
      klaar: reg.inschrijvingen > 0,
      uitleg: reg.inschrijvingen
        ? `${num(reg.inschrijvingen)} inschrijvingen · ${num(reg.domeinen)} domeinen`
        : "bronbestand nog niet ingelezen",
    },
    {
      naam: "Sitecrawl",
      klaar: (k.gemeten || 0) > 0,
      uitleg: `${num(k.gemeten || 0)} sites in dit gebied gemeten`,
    },
    {
      naam: "Zoekvolume (Google Ads)",
      klaar: zwStatus.met_volume > 0,
      uitleg: zwStatus.met_volume > 0
        ? `${num(zwStatus.met_volume)} van ${num(zwStatus.termen)} termen`
        : "draai /api/zoekwoorden?markt=architectuur&volumes=1",
    },
    {
      naam: "Posities concurrenten (SerpApi)",
      klaar: bron.klaar && !!zwStatus.positie_datum,
      uitleg: zwStatus.positie_datum
        ? `gemeten op ${zwStatus.positie_datum.split("-").reverse().join("/")}`
        : bron.klaar ? "nog geen meting voor deze markt" : "gratis SERPAPI_KEY instellen",
    },
  ];

  const uitRegister = bronnen0.find((b) => b.bron === "register")?.n || 0;
  const uitSerp = bronnen0.find((b) => b.bron === "serp")?.n || 0;
  const uitCrawl = bronnen0.find((b) => b.bron === "crawl")?.n || 0;

  const link = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const s = { toon: toonAlles ? "alles" : undefined, provincie, gemeente, ...extra };
    for (const [key, waarde] of Object.entries(s)) if (waarde) q.set(key, waarde);
    const qs = q.toString();
    return qs ? `${PAD}?${qs}` : PAD;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="sticky top-0 z-10 -mx-6 border-b border-zinc-200 bg-white/95 px-6 pb-0 pt-4 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-zinc-900">Concurrentie — Architectuur</h1>
          <div className="text-xs text-zinc-500">
            {gebied} · laatste sitecontrole{" "}
            {status.laatste_crawl ? status.laatste_crawl.split("-").reverse().join("/") : "nog niet"}
            {status.nooit_gecrawld > 0 && ` · ${num(status.nooit_gecrawld)} domeinen nog te meten`}
          </div>
        </div>
        <SubNav items={TABS} />
      </div>

      {/* ------------------------------------------------------------------ */}
      <section id="leaders" className="scroll-mt-36 pt-8">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {bronnen.map((b) => (
            <div key={b.naam} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3">
              <span className={"mt-1 h-2 w-2 shrink-0 rounded-full " + (b.klaar ? "bg-emerald-500" : "bg-zinc-300")} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-700">{b.naam}</div>
                <div className="truncate text-[11px] text-zinc-500" title={b.uitleg}>{b.uitleg}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Regiofilter. Een gewone GET-form: geen javascript nodig, en het
            adres blijft deelbaar. */}
        <form method="get" action={PAD} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div>
            <label htmlFor="provincie" className="block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Provincie
            </label>
            <select id="provincie" name="provincie" defaultValue={provincie || ""}
                    className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800">
              <option value="">Heel Vlaanderen</option>
              {regios.provincies.map((p) => (
                <option key={p.p} value={p.p}>{p.p} ({num(p.n)})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gemeente" className="block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Gemeente
            </label>
            <select id="gemeente" name="gemeente" defaultValue={gemeente || ""}
                    disabled={!provincie}
                    className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400">
              <option value="">Alle gemeenten</option>
              {regios.gemeenten.map((g) => (
                <option key={g.g} value={g.g}>{g.g} ({num(g.n)})</option>
              ))}
            </select>
          </div>
          {toonAlles && <input type="hidden" name="toon" value="alles" />}
          <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
            Toon
          </button>
          {heeftRegio && (
            <a href={link({ provincie: undefined, gemeente: undefined })}
               className="rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
              Wis filter
            </a>
          )}
          <p className="ml-auto max-w-md text-[11px] text-zinc-500">
            Kies eerst een provincie; de gemeentelijst volgt daaruit. Provincie en gemeente komen
            uit het register, niet uit de crawl — het is de tabel waarop de architect ingeschreven
            staat, niet noodzakelijk waar hij werkt.
          </p>
        </form>

        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="font-medium text-zinc-800">Hoe deze lijst tot stand komt</div>
          <p className="mt-1">
            Anders dan bij stabiliteit bestaat hier wél een register: elke architect in België moet
            ingeschreven zijn bij de Orde van Architecten, en de Orde publiceert dat register.{" "}
            <span className="font-medium text-zinc-800">{num(uitRegister)}</span> domeinen komen
            daaruit en{" "}
            <span className="font-medium text-zinc-800">{num(uitSerp)}</span> uit de zoekresultaten
            op onze zoektermen — dat tweede spoor vangt de spelers die géén architect zijn maar wel
            om dezelfde bouwheer vechten, zoals sleutel-op-de-deurbouwers. De crawler zelf mag hier
            niemand toevoegen{uitCrawl > 0 ? ` (${num(uitCrawl)} oude indelingen staan nog open)` : ""}:
            met een volledig register hoeft hij niet te raden, en zou hij vooral EPB-bureaus
            binnenhalen die toevallig over omgevingsvergunningen schrijven. Van de{" "}
            {num(reg.inschrijvingen)} inschrijvingen gaven er {num(reg.met_website)} zelf een
            website op; {num(reg.zonder_domein)} hebben geen enkel eigen domein en zijn online dus
            onvindbaar.
          </p>
        </div>

        <Card title={`Wie leidt er online${heeftRegio ? ` in ${gebied}` : ""}`}>
          {leaderboard.length > 0 && !heeftRegio ? (
            <>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="text-zinc-500">
                  Top 5 in Google per zoekterm — stand van{" "}
                  {zwStatus.positie_datum?.split("-").reverse().join("/")}
                  {!toonAlles && " · overheid en portalen verborgen"}
                </span>
                <a href={link({ toon: toonAlles ? undefined : "alles" })}
                   className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-zinc-600 hover:bg-zinc-50">
                  {toonAlles ? "Verberg overheid en portalen" : "Toon ook overheid en portalen"}
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(perTerm).map(([term, rijen]) => (
                  <div key={term} className="rounded-lg border border-zinc-200 p-3">
                    <div className="truncate text-sm font-medium text-zinc-800" title={term}>{term}</div>
                    <div className="mb-2 text-[11px] text-zinc-400">
                      {rijen[0].volume ? `${num(rijen[0].volume)} zoekopdrachten/maand` : rijen[0].thema}
                    </div>
                    <ol className="space-y-1">
                      {rijen.map((r) => (
                        <li key={r.positie} className="flex items-baseline gap-2 text-xs">
                          <span className={
                            "w-4 shrink-0 text-right tabular-nums " +
                            (r.positie <= 3 ? "font-semibold text-zinc-700" : "text-zinc-400")
                          }>{r.positie}</span>
                          <span className={
                            "truncate " + (r.van_ons ? "font-semibold text-emerald-700" : "text-zinc-600")
                          } title={r.naam || r.domein}>
                            {r.domein}{r.van_ons ? " ← wij" : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 text-xs text-zinc-500">
                {heeftRegio ? (
                  <>
                    Google-posities gelden voor heel Vlaanderen en zijn niet per gemeente te
                    filteren. Dit is daarom de rangorde op wat we zelf meten in {gebied}: hoeveel
                    pagina&rsquo;s een bureau over ontwerpwerk heeft, hoeveel het publiceert en hoe
                    recent.
                  </>
                ) : (
                  <>
                    Google-posities voor deze markt zijn nog niet gemeten. Dit is de rangorde op wat
                    we zelf meten: hoeveel pagina&rsquo;s een bureau over ontwerpwerk heeft, hoeveel
                    het publiceert en hoe recent.
                  </>
                )}
              </div>
              {sterkste.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nog geen enkele site in {gebied} is gemeten. Het architectenregister is vijf keer
                  zo groot als dat van VEKA; de crawler werkt de lijst af van oudste controle naar
                  nieuwste, dus dit vult zich over enkele dagen.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {sterkste.slice(0, 5).map((b, i) => (
                    <div key={b.domein} className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex items-baseline gap-2">
                        <span className={"text-lg font-bold tabular-nums " + (i === 0 ? "text-emerald-700" : "text-zinc-300")}>
                          {i + 1}
                        </span>
                        <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                           className="truncate text-sm font-medium text-zinc-800 hover:text-blue-700 hover:underline"
                           title={b.domein}>{b.domein}</a>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                        <div>
                          <span className="font-semibold text-zinc-700">{num(b.omvang || 0)}</span>{" "}
                          {b.omvang === 1 ? "ontwerppagina" : "ontwerppagina's"}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-700">{num(b.architecten || 0)}</span>{" "}
                          {b.architecten === 1 ? "inschrijving" : "inschrijvingen"}
                          {b.gemeente ? ` · ${b.gemeente}` : ""}
                        </div>
                        <div>
                          {(b.spam_verdacht || 0) >= 3 ? (
                            <span className="text-red-600">site gehackt</span>
                          ) : b.laatste_blog_url && b.laatste_blog ? (
                            <a href={b.laatste_blog_url} target="_blank" rel="noreferrer noopener"
                               className="text-blue-600 hover:underline">
                              laatste post {b.laatste_blog.split("-").reverse().join("/")}
                            </a>
                          ) : (
                            <span className="text-zinc-400">geen recente post</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {onzePosities.length > 0 && (
            <div className="mt-4 rounded-lg border border-zinc-200 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">
                Onze eigen posities volgens Google — Search Console,{" "}
                {gscCijfers.datum?.split("-").reverse().join("/")}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {onzePosities.map((r) => (
                    <tr key={r.site + r.term} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1 pr-4">
                        <a href={r.url} target="_blank" rel="noreferrer noopener"
                           className="text-zinc-700 hover:text-blue-700 hover:underline">{r.term}</a>
                        {!r.in_lijst && (
                          <span className="ml-2 rounded bg-amber-50 px-1 text-[10px] text-amber-700"
                                title="Google toont ons hierop, maar de term staat niet in onze lijst">
                            niet in lijst
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-4 whitespace-nowrap text-right tabular-nums text-zinc-500">
                        {num(r.vertoningen)} vert.
                      </td>
                      <td className="py-1 whitespace-nowrap text-right tabular-nums font-semibold text-zinc-800">
                        #{r.positie.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex items-baseline gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Wij:</span>
            <span>
              {wij
                ? `${num(wij.omvang || 0)} ${wij.omvang === 1 ? "ontwerppagina" : "ontwerppagina's"}, ` +
                  `${num(wij.blog_artikels || 0)} ${wij.blog_artikels === 1 ? "artikel" : "artikels"}`
                : "nog niet gemeten"}{" "}
              op {ONS_DOMEIN}
            </span>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="regio" className="scroll-mt-36 pt-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Het register per provincie">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-medium">Provincie</th>
                    <th className="pb-2 pr-3 text-right font-medium">Inschrijvingen</th>
                    <th className="pb-2 pr-3 text-right font-medium">Vennootschappen</th>
                    <th className="pb-2 pr-3 text-right font-medium">Domeinen</th>
                    <th className="pb-2 text-right font-medium">Met website</th>
                  </tr>
                </thead>
                <tbody>
                  {perProvincie.map((p) => (
                    <tr key={p.provincie} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-3">
                        <a href={link({ provincie: p.provincie, gemeente: undefined })}
                           className={"hover:underline " + (p.provincie === provincie ? "font-semibold text-blue-700" : "text-zinc-800")}>
                          {p.provincie}
                        </a>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-zinc-800">{num(p.inschrijvingen)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-600">{num(p.vennootschappen)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-600">{num(p.domeinen)}</td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-600">{num(p.met_website)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              &ldquo;Inschrijvingen&rdquo; telt personen én vennootschappen: een bureau met drie
              vennoten en een BV staat er vier keer in. Wie de markt in bureaus wil tellen, kijkt
              naar het aantal domeinen — dat is ook wat wij crawlen.
            </p>
          </Card>

          <Card title={`Drukste gemeenten${provincie ? ` in ${provincie}` : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-medium">Gemeente</th>
                    <th className="pb-2 pr-3 text-right font-medium">Bureaus</th>
                    <th className="pb-2 text-right font-medium">Inschrijvingen</th>
                  </tr>
                </thead>
                <tbody>
                  {perGemeente.map((g) => (
                    <tr key={g.gemeente} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-3">
                        {provincie ? (
                          <a href={link({ gemeente: g.gemeente })}
                             className={"hover:underline " + (g.gemeente === gemeente ? "font-semibold text-blue-700" : "text-zinc-800")}>
                            {g.gemeente}
                          </a>
                        ) : (
                          <span className="text-zinc-800">{g.gemeente}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-zinc-800">{num(g.domeinen)}</td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-600">{num(g.inschrijvingen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              {provincie
                ? "Klik een gemeente om de hele pagina daarop te zetten."
                : "Kies eerst een provincie om per gemeente te kunnen doorklikken."}{" "}
              Gerangschikt op bureaus, niet op inschrijvingen: dat is wat de bouwheer tegenkomt.
              Leuven en Antwerpen zijn het zwaartepunt van H-Architects; hoe hoger die hier staan,
              hoe drukker het terrein waar wij het meest werken.{" "}
              <strong className="font-medium text-zinc-700">
                {num(gemeenten.zonderAdres)} inschrijvingen staan hier niet in
              </strong>{" "}
              omdat de Orde er geen adres van publiceert — dat is bijna altijd een architect in
              loondienst, zonder eigen bureau. Van de domeinen die wij volgen heeft 97 % wél een
              gemeente.
            </p>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="markt" className="scroll-mt-36 pt-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi
            label="Inschrijvingen"
            value={num(k.erkenningen || 0)}
            sub={heeftRegio ? `in ${gebied}` : "hele Vlaamse Raad"}
          />
          <Kpi
            label="Bureaus"
            value={num(k.bedrijven || 0)}
            sub={`${num(k.geen_concurrent || 0)} sites apart gezet — zie Nakijken`}
          />
          <Kpi label="Sites gemeten" value={num(k.gemeten || 0)} sub={`${num(k.online || 0)} online`} />
          <Kpi
            label="Publiceert nog"
            value={num(k.actief_bloggend || 0)}
            sub={k.gemeten ? `van ${num(k.gemeten)} sites — laatste 90 dagen` : undefined}
          />
          <Kpi
            label="Onze omvang"
            value={num(wij?.omvang || 0)}
            sub={`ontwerppagina's op ${ONS_DOMEIN}`}
          />
        </div>

        {nietGevolgd > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-medium">
              {num(nietGevolgd)} domeinen uit het register worden nog niet gemeten
            </div>
            <p className="mt-1">
              Dat zijn domeinen die we uit een e-mailadres afleidden bij één enkele inschrijving,
              zonder dat de architect zelf een website opgaf. We weten dus niet of daar een site
              achter zit. Ze staan wél in de markt en in het register, maar de crawler laat ze met
              rust tot iemand ze aanzet — anders vertraagt het hele meetritme voor sites die
              misschien niet bestaan.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title={`Grootst online in ontwerpwerk${heeftRegio ? ` — ${gebied}` : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-medium">Bureau</th>
                    <th className="pb-2 pr-3 font-medium">Gemeente</th>
                    <th className="pb-2 pr-3 text-right font-medium">Ontwerppag.</th>
                    <th className="pb-2 pr-3 text-right font-medium">Artikels</th>
                    <th className="pb-2 font-medium">Laatste post</th>
                  </tr>
                </thead>
                <tbody>
                  {sterkste.map((b) => (
                    <tr key={b.domein} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-3">
                        <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                           className="text-zinc-800 hover:text-blue-700 hover:underline">{b.naam || b.domein}</a>
                        <div className="text-[11px] text-zinc-400">{b.domein}</div>
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-zinc-500">{b.gemeente || "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-zinc-800">{num(b.omvang || 0)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-600">{num(b.blog_artikels || 0)}</td>
                      <td className="py-1.5 text-zinc-600">
                        <Datum d={b.laatste_blog} href={b.laatste_blog_url} verdacht={(b.spam_verdacht || 0) >= 3} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              Gerangschikt op pagina&rsquo;s over ontwerpwerk, niet op het totale aantal
              pagina&rsquo;s. Een architectensite bestaat vaak grotendeels uit projectfoto&rsquo;s;
              die tellen hier niet mee.
            </p>
          </Card>

          <Card title="Wie er nog beweegt">
            {actiefste.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Geen enkel bureau in dit gebied publiceerde het afgelopen jaar. Bij architecten is
                dat eerder regel dan uitzondering: de meesten tonen projecten, geen artikels. Dat is
                precies waar met tekst terrein te winnen valt.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                        <th className="pb-2 pr-3 font-medium">Bureau</th>
                        <th className="pb-2 pr-3 text-right font-medium">Artikels</th>
                        <th className="pb-2 font-medium">Laatste post</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actiefste.map((b) => (
                        <tr key={b.domein} className="border-b border-zinc-100 last:border-0">
                          <td className="py-1.5 pr-3">
                            <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                               className="text-zinc-800 hover:text-blue-700 hover:underline">{b.naam || b.domein}</a>
                            <div className="text-[11px] text-zinc-400">{b.domein}</div>
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-700">{num(b.blog_artikels || 0)}</td>
                          <td className="py-1.5 text-zinc-600">
                            <Datum d={b.laatste_blog} href={b.laatste_blog_url} verdacht={(b.spam_verdacht || 0) >= 3} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  &ldquo;Laatste post&rdquo; komt uit de <code>lastmod</code> van de sitemap.
                  Richtinggevend, geen bewijs: na een sitemigratie krijgen alle pagina&rsquo;s
                  dezelfde datum.
                </p>
              </>
            )}
          </Card>
        </div>

        <div className="mt-4">
          <Card title="Onze eigen site">
            {wij ? (
              <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                <div className="flex justify-between"><dt className="text-zinc-500">Pagina&rsquo;s</dt>
                  <dd className="font-medium"><Paginas n={wij.paginas} sitemap={wij.heeft_sitemap} /></dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">Waarvan over ontwerpwerk</dt>
                  <dd className="font-medium">{num(wij.omvang || 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">Blogartikels</dt>
                  <dd className="font-medium">{num(wij.blog_artikels || 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">Laatste publicatie</dt>
                  <dd className="font-medium"><Datum d={wij.laatste_blog} href={wij.laatste_blog_url} /></dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">Laadtijd</dt>
                  <dd className="font-medium">{wij.ttfb_ms ? `${num(wij.ttfb_ms)} ms` : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">CMS</dt>
                  <dd className="font-medium">{wij.cms || "—"}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">{ONS_DOMEIN} is nog niet gemeten.</p>
            )}
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              De proefomgeving h-architects.globaal.be wordt apart meegemeten. Het verschil tussen
              die twee is wat er nog te publiceren valt.
            </p>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="concurrenten" className="scroll-mt-36 pt-8">
        <Card title={`Concurrenten — ${num(concurrenten.length)} bureaus in ${gebied}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Bureau</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Gemeente</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Inschr.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Ontwerppag.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Totaal</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Artikels</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Laatste post</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Diensten</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Klopt dit?</th>
                </tr>
              </thead>
              <tbody>
                {concurrenten.map((c) => (
                  <tr key={c.domein} className="border-b border-zinc-100 last:border-0 align-top">
                    <td className="py-2 pr-4 last:pr-0">
                      <div className="font-medium text-zinc-800">{c.naam}</div>
                      <a href={`https://${c.domein}`} target="_blank" rel="noreferrer noopener"
                         className="text-xs text-blue-600 hover:underline">{c.domein}</a>
                      {c.categorie === "aannemer" && (
                        <span className="ml-2 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">bouwbedrijf</span>
                      )}
                      {c.bereikbaar === 0 && <div className="text-[11px] text-red-500">{c.fout || "site onbereikbaar"}</div>}
                      {(c.spam_verdacht || 0) >= 3 && (
                        <div className="text-[11px] text-red-600">{num(c.spam_verdacht || 0)} spam-URL&rsquo;s — vermoedelijk gehackt</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-xs text-zinc-500">{c.gemeente || "—"}</td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right tabular-nums text-zinc-600">
                      {c.architecten ? num(c.architecten) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right font-semibold text-zinc-800">{num(c.omvang || 0)}</td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500"><Paginas n={c.paginas} sitemap={c.heeft_sitemap} /></td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-600">
                      {c.bereikbaar === null ? <span className="text-zinc-300">—</span> : num(c.blog_artikels || 0)}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-zinc-600">
                      <Datum d={c.laatste_blog} href={c.laatste_blog_url} verdacht={(c.spam_verdacht || 0) >= 3} />
                    </td>
                    <td className="py-2 pr-4 last:pr-0"><Diensten json={c.diensten} /></td>
                    <td className="py-2 pr-4 last:pr-0">
                      <Beoordeling soort="domein" sleutel={c.domein} huidig={c.oordeel ?? null} />
                      {c.oordeel_door && c.oordeel && (
                        <div className="text-[11px] text-zinc-400">door {c.oordeel_door}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Hier staat de architect niet als klant maar als concurrent — dat is het spiegelbeeld van
            de Engineering-pagina, waar een architect juist een lead voor onderaanneming is.
            Bouwbedrijven staan er bewust bij: een sleutel-op-de-deurbouwer neemt een particuliere
            bouwheer net zo goed weg als een collega-architect. Overheid, portalen, jobsites,
            buitenlandse bureaus en fabrikanten staan onder{" "}
            <a href="#nakijken" className="text-blue-600 hover:underline">Nakijken</a>. Klopt een
            indeling niet, zet ze dan recht met de knopjes rechts; dat oordeel gaat vóór op de
            automatiek en blijft staan.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="nakijken" className="scroll-mt-36 pt-8">
        <Card title={`Nakijken — ${num(rest.length)} sites die de automatiek buiten de markt hield`}>
          <p className="mb-4 text-sm text-zinc-600">
            Deze sites komen in onze zoekresultaten voor, maar tellen niet mee als concurrent. De
            indeling komt uit de domeinnaam en uit wat de site over zichzelf zegt in zijn titel.
            Zit er een echt bureau tussen, zet het dan hier recht; het verschuift meteen naar de
            lijst hierboven, en dat oordeel blijft staan.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Site</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Ingedeeld als</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Ontwerppag.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Artikels</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Klopt dit?</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((c) => (
                  <tr key={c.domein} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-4 last:pr-0">
                      <div className="font-medium text-zinc-800">{c.naam}</div>
                      <a href={`https://${c.domein}`} target="_blank" rel="noreferrer noopener"
                         className="text-xs text-blue-600 hover:underline">{c.domein}</a>
                    </td>
                    <td className="py-2 pr-4 last:pr-0">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                        {c.categorie === "geen-concurrent" ? "geen concurrent (handmatig)"
                          : c.categorie === "fabrikant" ? "fabrikant — levert, ontwerpt niet"
                          : c.categorie === "buitenland" ? "buitenland"
                          : c.categorie === "vacature" ? "jobsite"
                          : c.categorie === "portaal" ? "portaal — verkoopt geen ontwerp"
                          : c.categorie}
                      </span>
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right tabular-nums text-zinc-600">
                      {c.omvang === null ? <span className="text-zinc-300">—</span> : num(c.omvang)}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right tabular-nums text-zinc-600">
                      {c.blog_artikels === null ? <span className="text-zinc-300">—</span> : num(c.blog_artikels)}
                    </td>
                    <td className="py-2 pr-4 last:pr-0">
                      <Beoordeling soort="domein" sleutel={c.domein} huidig={c.oordeel ?? null} />
                      {c.oordeel_door && c.oordeel && (
                        <div className="text-[11px] text-zinc-400">door {c.oordeel_door}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="diensten" className="scroll-mt-36 pt-8">
        <Card title="Dienstendekking — wat biedt de markt aan, en waar zit het gat">
          <div className="space-y-2.5">
            {diensten.map((d) => (
              <div key={d.dienst} className="flex items-center gap-3">
                <div className="w-52 shrink-0 text-sm text-zinc-700">{d.dienst}</div>
                <div className="h-2 flex-1 rounded bg-zinc-100">
                  <div className="h-2 rounded bg-emerald-600" style={{ width: `${d.aandeel * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-zinc-500">
                  {d.aantal} sites · {Math.round(d.aandeel * 100)}%
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Herkend op basis van de homepage en de URL-structuur van de sites in dit gebied.
            Regularisatie en aankoopbegeleiding zijn de twee diensten om hier goed naar te kijken:
            noemt bijna niemand ze, dan is dat onze opening — en niet een teken dat er geen vraag is.
          </p>
        </Card>

        {herschrijf.length > 0 && (
          <div className="mt-4">
            <Card title="Herschrijfkansen — overheid en portalen die onze zoektermen bezetten">
              <p className="mb-3 text-sm text-zinc-600">
                Geen concurrenten, maar wel de pagina&rsquo;s waarvan Google vindt dat ze bij deze
                zoektermen horen. Op vergunningstermen is dat bijna altijd een overheidspagina in
                ambtelijke taal — precies waar een architect een duidelijker antwoord tegenover kan
                zetten.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-4 whitespace-nowrap font-medium">Zoekterm</th>
                    <th className="pb-2 pr-4 whitespace-nowrap text-right font-medium">Volume</th>
                    <th className="pb-2 pr-4 whitespace-nowrap text-right font-medium">Positie</th>
                    <th className="pb-2 font-medium">Pagina</th>
                  </tr>
                </thead>
                <tbody>
                  {herschrijf.map((h, i) => (
                    <tr key={h.term + i} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-4 text-zinc-800">{h.term}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-right tabular-nums text-zinc-600">
                        {h.volume ? num(h.volume) : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-right tabular-nums font-medium text-zinc-800">
                        #{h.positie}
                      </td>
                      <td className="py-2">
                        <a href={h.url} target="_blank" rel="noreferrer noopener"
                           className="block max-w-md truncate text-xs text-blue-600 hover:underline" title={h.url}>
                          {h.domein}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="zoekwoorden" className="scroll-mt-36 pt-8">
        <Card title={`Zoekwoorden — ${num(zwStatus.termen)} termen die deze markt afbakenen`}>
          {!bron.klaar && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">Nog geen positiemeting — leaderboard blijft leeg</div>
              <p className="mt-1">
                Meten gaat via een tussenpartij; Google zelf automatisch uitlezen mag niet en wordt
                geblokkeerd. Met een gratis SerpApi-sleutel (<code>SERPAPI_KEY</code>) kan het.
              </p>
            </div>
          )}

          {bron.klaar && !zwStatus.positie_datum && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Deze markt is nog niet in Google gemeten</div>
              <p className="mt-1">
                Het gratis SerpApi-quotum is 250 zoekopdrachten per maand voor alle drie de markten
                samen. Architectuur wordt daarom in de oneven weken gemeten, op de termen met het
                meeste volume. Handmatig starten kan met{" "}
                <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?markt=architectuur&amp;posities=1&amp;limiet=15</code>.
              </p>
            </div>
          )}

          {zwStatus.met_volume === 0 && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Zoekvolumes nog niet opgehaald</div>
              <p className="mt-1">
                Die komen uit Google Ads Keyword Planner, via dezelfde koppeling als de
                advertentiesync — geen nieuwe toegang nodig. Draai{" "}
                <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?markt=architectuur&amp;volumes=1</code>{" "}
                op de server, waar de Google-sleutels staan.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Zoekterm</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Thema</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Intentie</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Volume/mnd</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Wij</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Beste concurrent</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Ads</th>
                </tr>
              </thead>
              <tbody>
                {zoekwoorden.map((z) => (
                  <tr key={z.term} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-4 last:pr-0 text-zinc-800">{z.term}</td>
                    <td className="py-2 pr-4 last:pr-0 text-zinc-500">{z.thema}</td>
                    <td className="py-2 pr-4 last:pr-0">
                      <span className={
                        "rounded px-1.5 py-0.5 text-[11px] " +
                        (z.intentie === "probleem" ? "bg-amber-100 text-amber-800"
                          : z.intentie === "dienst" ? "bg-emerald-50 text-emerald-800"
                          : z.intentie === "vacature" ? "bg-red-50 text-red-700"
                          : "bg-zinc-100 text-zinc-600")
                      }>{z.intentie}</span>
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-700">
                      {z.volume === null ? <span className="text-zinc-300">—</span> : num(z.volume)}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">
                      {z.onze_positie ? <span className="text-zinc-800">{z.onze_positie}</span>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 text-zinc-600">
                      {z.beste_concurrent
                        ? <>{z.beste_concurrent} <span className="text-xs text-zinc-400">#{z.beste_positie}</span></>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500">
                      {z.adverteerders ? num(z.adverteerders) : <span className="text-zinc-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            De lijst staat in <code>config/zoekwoorden-architectuur.json</code> — termen bijzetten
            kan zonder code. Het kale woord &ldquo;architect&rdquo; staat er bewust niet in: die
            zoekopdracht is half informatief en half vacature, en zegt niets over een dossier.
          </p>
        </Card>

        {adverteerders.length > 0 && (
          <div className="mt-4">
            <Card title="Wie adverteert er op onze termen">
              <table className="w-full text-sm">
                <tbody>
                  {adverteerders.map((a) => (
                    <tr key={a.domein} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-4 last:pr-0 text-zinc-800">{a.naam}</td>
                      <td className="py-1.5 pr-4 last:pr-0 text-xs text-blue-600">{a.domein}</td>
                      <td className="py-1.5 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-600">{num(a.termen)} termen</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                Dit toont wie er adverteert, niet wat zij uitgeven. Geschatte budgetten horen niet
                als feit in een dashboard.
              </p>
            </Card>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="signalen" className="scroll-mt-36 pb-12 pt-8">
        <Card title="Signalen — wat er veranderd is sinds de vorige controle">
          {signalen.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nog geen signalen voor deze markt. De eerste meting van een site legt alleen de
              beginstand vast; vanaf de tweede controle verschijnen hier nieuwe blogartikels en
              nieuwe pagina&rsquo;s.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {signalen.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-2.5">
                  <span className={
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium " +
                    (s.soort === "nieuwe-blog" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600")
                  }>
                    {s.soort === "nieuwe-blog" ? "blog" : "pagina"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-800">{s.naam}</div>
                    <a href={s.url} target="_blank" rel="noreferrer noopener"
                       className="block truncate text-xs text-blue-600 hover:underline">{s.url}</a>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-400"><Datum d={s.datum} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </main>
  );
}
