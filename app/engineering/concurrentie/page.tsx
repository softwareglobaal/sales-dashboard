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
} from "@/lib/concurrentieQueries";
import { serpBron } from "@/lib/zoekwoorden";
import { gscBeschikbaar } from "@/lib/searchConsole";
import { num } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";
import { SubNav } from "@/components/SubNav";
import { Beoordeling } from "@/components/Beoordeling";

export const dynamic = "force-dynamic";

const MARKT = "engineering" as const;
const ONS_DOMEIN = "unabo.be";

const TABS = [
  { id: "leaders", label: "Leaders" },
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

export default async function EngineeringConcurrentiePage({
  searchParams,
}: {
  searchParams: Promise<{ toon?: string }>;
}) {
  const sp = await searchParams;
  const toonAlles = sp.toon === "alles";

  if (!concurrentieHeeftData(MARKT)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="h1-glas klein">Concurrentie — Engineering</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="font-medium">Nog geen bedrijven in deze markt</div>
          <p className="mt-1">
            Anders dan bij Energie bestaat er voor stabiliteitsstudies geen register. Deze lijst
            wordt opgebouwd uit twee dingen: wat onze crawler op de al gevolgde sites vindt, en wie
            er op onze zoektermen in Google staat. Draai{" "}
            <code className="rounded bg-white px-1.5 py-0.5">/api/concurrentie?herbereken=1</code>{" "}
            om de eerste indeling te maken, en{" "}
            <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?markt=engineering&amp;posities=1</code>{" "}
            om de markt in Google te meten.
          </p>
        </div>
      </main>
    );
  }

  const k = getMarktKpis(MARKT);
  const status = getCrawlStatus(MARKT);
  const bronnen0 = getMarktBronnen(MARKT);
  const sterkste = getSterksteOnline(15, MARKT);
  const actiefste = getActiefstePubliceerders(10, MARKT);
  const diensten = getDienstenDekking(MARKT);
  const concurrenten = getConcurrentenInMarkt(MARKT);
  const rest = getConcurrentenInMarkt(MARKT, "rest");
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
      naam: "Sitecrawl",
      klaar: (status.gisteren_gemeten || 0) > 0,
      uitleg: `${num(k.gemeten || 0)} sites in deze markt gemeten`,
    },
    {
      naam: "Zoekvolume (Google Ads)",
      klaar: zwStatus.met_volume > 0,
      uitleg: zwStatus.met_volume > 0
        ? `${num(zwStatus.met_volume)} van ${num(zwStatus.termen)} termen`
        : "draai /api/zoekwoorden?markt=engineering&volumes=1",
    },
    {
      naam: "Onze posities (Search Console)",
      klaar: gsc.klaar && gscCijfers.metingen > 0,
      uitleg: gscCijfers.metingen > 0
        ? `${num(gscCijfers.metingen)} termen op unabo.be`
        : gsc.reden || "nog niet opgehaald",
    },
    {
      naam: "Posities concurrenten (SerpApi)",
      klaar: bron.klaar && !!zwStatus.positie_datum,
      uitleg: zwStatus.positie_datum
        ? `gemeten op ${zwStatus.positie_datum.split("-").reverse().join("/")}`
        : bron.klaar ? "nog geen meting voor deze markt" : "gratis SERPAPI_KEY instellen",
    },
  ];

  const uitSerp = bronnen0.find((b) => b.bron === "serp")?.n || 0;
  const uitCrawl = bronnen0.find((b) => b.bron === "crawl")?.n || 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="kopbalk">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="h1-glas klein">Concurrentie — Engineering</h1>
          <div className="text-xs text-zinc-500">
            Stabiliteitsstudies · laatste sitecontrole{" "}
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

        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="font-medium text-zinc-800">Hoe deze lijst tot stand komt</div>
          <p className="mt-1">
            Voor EPB bestaat een register van erkende verslaggevers; voor stabiliteitsstudies
            bestaat dat niet. Deze markt wordt daarom van onderaf opgebouwd:{" "}
            <span className="font-medium text-zinc-800">{num(uitSerp)}</span> bedrijven komen uit de
            zoekresultaten op onze zoektermen,{" "}
            <span className="font-medium text-zinc-800">{num(uitCrawl)}</span> uit sites waar de
            crawler zelf genoeg stabiliteitswerk vond. Dat is geen volledige telling van de markt —
            wie niet online staat en niet rankt, staat hier niet. Het is wel de markt zoals een
            zoekende klant hem ziet.
          </p>
        </div>

        <Card title="Wie leidt er online">
          {leaderboard.length > 0 ? (
            <>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="text-zinc-500">
                  Top 5 in Google per zoekterm — stand van{" "}
                  {zwStatus.positie_datum?.split("-").reverse().join("/")}
                  {!toonAlles && " · overheid en portalen verborgen"}
                </span>
                <a
                  href={toonAlles ? "/engineering/concurrentie" : "/engineering/concurrentie?toon=alles"}
                  className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-zinc-600 hover:bg-zinc-50"
                >
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
                Google-posities voor deze markt zijn nog niet gemeten. Dit is de rangorde op wat we
                zelf meten: hoeveel pagina&rsquo;s een bureau over stabiliteit heeft, hoeveel het
                publiceert en hoe recent.
              </div>
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
                        {b.omvang === 1 ? "stabiliteitspagina" : "stabiliteitspagina's"}
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-700">{num(b.blog_artikels || 0)}</span>{" "}
                        {b.blog_artikels === 1 ? "artikel" : "artikels"}
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
              <p className="mt-2 text-[11px] text-zinc-500">
                Alleen de stabiliteitstermen van unabo.be. De EPB-termen van datzelfde domein staan
                op de Energie-pagina.
              </p>
            </div>
          )}

          <div className="mt-3 flex items-baseline gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <span className="font-medium text-zinc-700">Wij:</span>
            <span>
              {wij
                ? `${num(wij.omvang || 0)} ${wij.omvang === 1 ? "stabiliteitspagina" : "stabiliteitspagina's"}, ` +
                  `${num(wij.blog_artikels || 0)} ${wij.blog_artikels === 1 ? "artikel" : "artikels"}`
                : "nog niet gemeten"}{" "}
              op {ONS_DOMEIN}
            </span>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="markt" className="scroll-mt-36 pt-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi
            label="Bedrijven"
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
            label="Gem. stabiliteitspagina's"
            value={k.gem_omvang ? Math.round(k.gem_omvang).toString() : "—"}
            sub="per site die er over schrijft"
          />
          <Kpi
            label="Onze omvang"
            value={num(wij?.omvang || 0)}
            sub={`stabiliteitspagina's op ${ONS_DOMEIN}`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Grootst online in stabiliteit">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-medium">Bureau</th>
                    <th className="pb-2 pr-3 text-right font-medium">Stab.-pag.</th>
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
              Gerangschikt op pagina&rsquo;s over stabiliteit, niet op het totale aantal pagina&rsquo;s.
              Anders staan Sweco en Arcadis bovenaan: reuzen die deze markt nauwelijks bedienen.
            </p>
          </Card>

          <Card title="Wie er nog beweegt">
            {actiefste.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Geen enkel bureau in deze lijst publiceerde het afgelopen jaar. Dat is op zich het
                antwoord: er is hier geen contentstrijd om te winnen, alleen terrein om te bezetten.
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
                  Alleen bureaus die het afgelopen jaar nog gepubliceerd hebben. Omvang zegt hoe
                  groot iemand is; dit zegt of hij nog beweegt.
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
                <div className="flex justify-between"><dt className="text-zinc-500">Waarvan over stabiliteit</dt>
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
              unabo.be draagt zowel EPB als de stabiliteitsstudies. Hier tellen alleen de
              pagina&rsquo;s die over stabiliteit gaan.
            </p>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="concurrenten" className="scroll-mt-36 pt-8">
        <Card title={`Concurrenten — ${num(concurrenten.length)} bedrijven in de stabiliteitsmarkt`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Bedrijf</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Stab.-pag.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Totaal</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Artikels</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Laatste post</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Diensten</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">CMS</th>
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
                      {c.categorie === "portaal" && (
                        <span className="ml-2 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">portaal</span>
                      )}
                      {c.categorie === "overheid" && (
                        <span className="ml-2 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">overheid</span>
                      )}
                      {c.categorie === "vacature" && (
                        <span className="ml-2 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">jobsite</span>
                      )}
                      {c.bereikbaar === 0 && <div className="text-[11px] text-red-500">{c.fout || "site onbereikbaar"}</div>}
                      {(c.spam_verdacht || 0) >= 3 && (
                        <div className="text-[11px] text-red-600">{num(c.spam_verdacht || 0)} spam-URL&rsquo;s — vermoedelijk gehackt</div>
                      )}
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
                    <td className="py-2 pr-4 last:pr-0 text-xs text-zinc-500">{c.cms || "—"}</td>
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
            Een bedrijf staat in deze lijst als het op onze zoektermen in de top 10 verschijnt, of
            als er genoeg over stabiliteit op zijn site staat. Overheid, portalen, jobsites en
            buitenlandse bureaus zijn er automatisch uit gehouden; die staan onder{" "}
            <a href="#nakijken" className="text-blue-600 hover:underline">Nakijken</a>. Klopt een
            indeling niet, zet ze dan recht met de knopjes rechts — dat oordeel gaat vóór op de
            automatiek en blijft staan. &ldquo;Laatste post&rdquo; komt uit de <code>lastmod</code>{" "}
            van de sitemap: richtinggevend, geen bewijs.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="nakijken" className="scroll-mt-36 pt-8">
        <Card title={`Nakijken — ${num(rest.length)} sites die de automatiek buiten de markt hield`}>
          <p className="mb-4 text-sm text-zinc-600">
            Deze sites staan wél in onze zoekresultaten, maar tellen niet mee als concurrent. De
            indeling komt uit de domeinnaam en uit wat de site over zichzelf zegt in zijn titel.
            <strong className="font-medium text-zinc-800"> Let op de architecten en aannemers</strong>:
            die zijn geen bedreiging maar het omgekeerde — zij besteden stabiliteitswerk uit. Dat is
            dezelfde doelgroep als de onderaannemingspagina. Zit er een echte concurrent tussen, zet
            hem dan hier recht; hij verschuift meteen naar de lijst hierboven, en dat oordeel blijft
            staan.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Site</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Ingedeeld als</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Stab.-pag.</th>
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
                          : c.categorie === "architect" ? "architect — kan klant zijn"
                          : c.categorie === "aannemer" ? "aannemer — koopt studies"
                          : c.categorie === "fabrikant" ? "fabrikant"
                          : c.categorie === "buitenland" ? "buitenland"
                          : c.categorie === "vacature" ? "jobsite"
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
            Herkend op basis van de homepage en de URL-structuur van de sites in deze markt. Een
            dienst die bijna niemand noemt is ofwel oninteressant, ofwel onze opening — dat verschil
            maakt de markt, niet de meting.
          </p>
        </Card>

        {herschrijf.length > 0 && (
          <div className="mt-4">
            <Card title="Herschrijfkansen — overheid en portalen die onze zoektermen bezetten">
              <p className="mb-3 text-sm text-zinc-600">
                Geen concurrenten, maar wel de pagina&rsquo;s waarvan Google vindt dat ze bij deze
                zoektermen horen. Vaak algemeen geschreven en zelden door een ingenieur. Dat is
                precies waar wij een duidelijker antwoord tegenover kunnen zetten.
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
                Het gratis SerpApi-quotum is 250 zoekopdrachten per maand voor alle markten samen.
                Engineering wordt daarom om de twee weken gemeten, op de termen met het meeste
                volume. Handmatig starten kan met{" "}
                <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?markt=engineering&amp;posities=1&amp;limiet=15</code>.
              </p>
            </div>
          )}

          {zwStatus.met_volume === 0 && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Zoekvolumes nog niet opgehaald</div>
              <p className="mt-1">
                Die komen uit Google Ads Keyword Planner, via dezelfde koppeling als de
                advertentiesync — geen nieuwe toegang nodig. Draai{" "}
                <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?markt=engineering&amp;volumes=1</code>{" "}
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
            De lijst staat in <code>config/zoekwoorden-engineering.json</code> — termen bijzetten
            kan zonder code. Een term met de intentie{" "}
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">vacature</span>{" "}
            trekt zoekverkeer dat nooit klant wordt: op &ldquo;stabiliteitsingenieur&rdquo; — de
            grootste term van deze markt — staat de hele top 10 vol jobsites.
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
