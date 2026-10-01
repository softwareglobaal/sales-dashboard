import { DienstTabs } from "@/components/dienst/DienstKop";
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
  getEigenSites,
  getEigenPosities,
  getEigenGsc,
  PROEF_SITES,
} from "@/lib/concurrentieQueries";
import { OMVANG, plekActief, plekGoogle, plekOpOmvang, plekRanglijst, zoekSamenvatting, type PlekRegel } from "@/lib/onzePlek";
import { OnzePlek } from "@/components/concurrentie/OnzePlek";
import { EigenSitesKaartjes, EigenSitesTabel } from "@/components/concurrentie/EigenSites";
import { Blok, extra } from "@/components/concurrentie/Blok";
import { Ingekort } from "@/components/concurrentie/Ingekort";
import { serpBron } from "@/lib/zoekwoorden";
import { gscBeschikbaar } from "@/lib/searchConsole";
import { num } from "@/lib/format";
import { Kpi } from "@/components/ui";
import { SubNav } from "@/components/SubNav";
import { Beoordeling } from "@/components/Beoordeling";

export const dynamic = "force-dynamic";

const MARKT = "engineering" as const;

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
      <DienstTabs pad="engineering" tab="concurrentie" />
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
  // De ranglijsten volledig ophalen: de pagina toont de top, "Onze plek" rekent
  // de plaats van elke eigen site uit over de hele lijst.
  const alleSterkste = getSterksteOnline(100000, MARKT);
  const sterkste = alleSterkste.slice(0, 15);
  const alleActief = getActiefstePubliceerders(100000, MARKT);
  const actiefste = alleActief.slice(0, 10);
  const diensten = getDienstenDekking(MARKT);
  const concurrenten = getConcurrentenInMarkt(MARKT);
  const rest = getConcurrentenInMarkt(MARKT, "rest");
  const signalen = getSignalen(40, MARKT);
  const eigen = getEigenSites(MARKT);
  const eigenPos = getEigenPosities(MARKT);
  const eigenGsc = getEigenGsc(MARKT);
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

  // "Onze plek": per eigen site de plaats in elke ranglijst van deze pagina.
  const plekOmvang = Object.fromEntries(eigen.map((e) => [e.domein, plekOpOmvang(concurrenten, e)]));
  const plekken: Record<string, PlekRegel[]> = Object.fromEntries(eigen.map((e) => [e.domein, [
    plekGoogle({
      lijst: "Wie leidt er online (Google-top 5)",
      leaderboard: leaderboard, posities: eigenPos.rijen, domein: e.domein, diepte: 5,
      proef: PROEF_SITES.includes(e.domein),
    }),
    plekRanglijst({
      lijst: "Grootst online en concurrentenlijst (stabiliteitspagina's)",
      rijen: concurrenten, eigen: e, sleutels: OMVANG, getoond: sterkste.length,
      waarde: (r) => `${num(r.omvang || 0)} stab.-pag.`,
    }),
    plekActief("Wie er nog beweegt (artikels per maand)", alleActief, e),
  ].filter((r): r is PlekRegel => !!r)]));
  const zoek = Object.fromEntries(eigen.map((e) => [e.domein, zoekSamenvatting(eigenPos.rijen, eigenPos.termen, e.domein)]));
  const termen = Object.keys(perTerm);
  // De proefomgeving is een kopie van de live site: niet optellen.
  const eigenLive = eigen.filter((e) => !PROEF_SITES.includes(e.domein));
  const somOmvang = eigenLive.reduce((t, e) => t + (e.omvang || 0), 0);

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
        ? `${num(gscCijfers.metingen)} termen op onze sites`
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
      <DienstTabs pad="engineering" tab="concurrentie" />
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
        <OnzePlek
          markt={MARKT}
          sites={eigen}
          regels={plekken}
          zoek={zoek}
          positieDatum={eigenPos.datum}
          gsc={eigenGsc}
          gscOpgehaald={gscCijfers.metingen > 0}
          proef={PROEF_SITES}
        />

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

        <details className="opklap mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <summary className="flex items-center justify-between gap-2 font-medium text-zinc-800">
            Hoe deze lijst tot stand komt
            <svg className="pijl" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
          </summary>
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
        </details>

        <Blok titel="Wie leidt er online" aantal={leaderboard.length > 0 ? `${termen.length} zoektermen` : undefined}>
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
              <Ingekort totaal={termen.length} start={4} wat="zoektermen">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(perTerm).map(([term, rijen], i) => (
                  <div key={term} {...extra(i, 4)} className="rounded-lg border border-zinc-200 p-3">
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
              </Ingekort>
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
              <Ingekort totaal={onzePosities.length} start={5} wat="termen">
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {onzePosities.map((r, i) => (
                    <tr key={r.site + r.term} {...extra(i, 5)} className="border-b border-zinc-100 last:border-0">
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
              </Ingekort>
              <p className="mt-2 text-[11px] text-zinc-500">
                Alleen de stabiliteitstermen van onze sites. De EPB-termen van unabo.be staan op de
                Energie-pagina.
              </p>
            </div>
          )}

          <EigenSitesKaartjes
            markt={MARKT}
            sites={eigen}
            plek={plekOmvang}
            maat={(n) => (n === 1 ? "stabiliteitspagina" : "stabiliteitspagina's")}
          />
        </Blok>
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
            label="Onze omvang, samen"
            value={num(somOmvang)}
            sub={eigenLive.map((e) => `${e.domein} ${num(e.omvang || 0)}`).join(" · ")}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Blok titel="Grootst online in stabiliteit" aantal={`top ${sterkste.length}`}>
            <Ingekort totaal={sterkste.length} start={10} wat="bureaus">
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
                  {sterkste.map((b, i) => (
                    <tr key={b.domein} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0">
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
            </Ingekort>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              Gerangschikt op pagina&rsquo;s over stabiliteit, niet op het totale aantal pagina&rsquo;s.
              Anders staan Sweco en Arcadis bovenaan: reuzen die deze markt nauwelijks bedienen.
            </p>
          </Blok>

          <Blok titel="Wie er nog beweegt" aantal={actiefste.length ? `top ${actiefste.length}` : undefined}>
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
          </Blok>
        </div>

        <div className="mt-4">
          <Blok titel="Onze sites tegenover de markt" aantal={`${eigen.length} sites`}>
            <EigenSitesTabel
              markt={MARKT}
              sites={eigen}
              maatKort="Stab.-pag."
              plek={plekOmvang}
              top={sterkste[0]}
              gemiddelde={k.gem_omvang}
              proef={PROEF_SITES}
            />
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              unabo.be draagt zowel EPB als de stabiliteitsstudies; TKN-Buro doet daarnaast de
              meetstaten. Hier tellen alleen de pagina&rsquo;s die over stabiliteit gaan. De nummer één
              van de markt en het gemiddelde staan eronder als maatstok.
            </p>
          </Blok>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="concurrenten" className="scroll-mt-36 pt-8">
        <Blok titel="Concurrenten in de stabiliteitsmarkt" aantal={`${num(concurrenten.length)} bedrijven`}>
          <Ingekort totaal={concurrenten.length} start={10} wat="bedrijven">
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
                {concurrenten.map((c, i) => (
                  <tr key={c.domein} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0 align-top">
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
          </Ingekort>
          <p className="mt-3 text-xs text-zinc-500">
            Een bedrijf staat in deze lijst als het op onze zoektermen in de top 10 verschijnt, of
            als er genoeg over stabiliteit op zijn site staat. Overheid, portalen, jobsites en
            buitenlandse bureaus zijn er automatisch uit gehouden; die staan onder{" "}
            <a href="#nakijken" className="text-blue-600 hover:underline">Nakijken</a>. Klopt een
            indeling niet, zet ze dan recht met de knopjes rechts — dat oordeel gaat vóór op de
            automatiek en blijft staan. &ldquo;Laatste post&rdquo; komt uit de <code>lastmod</code>{" "}
            van de sitemap: richtinggevend, geen bewijs.
          </p>
        </Blok>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="nakijken" className="scroll-mt-36 pt-8">
        <Blok titel="Nakijken — sites die de automatiek buiten de markt hield" aantal={`${num(rest.length)} sites`} open={false}>
          <p className="mb-4 text-sm text-zinc-600">
            Deze sites staan wél in onze zoekresultaten, maar tellen niet mee als concurrent. De
            indeling komt uit de domeinnaam en uit wat de site over zichzelf zegt in zijn titel.
            <strong className="font-medium text-zinc-800"> Let op de architecten en aannemers</strong>:
            die zijn geen bedreiging maar het omgekeerde — zij besteden stabiliteitswerk uit. Dat is
            dezelfde doelgroep als de onderaannemingspagina. Zit er een echte concurrent tussen, zet
            hem dan hier recht; hij verschuift meteen naar de lijst hierboven, en dat oordeel blijft
            staan.
          </p>
          <Ingekort totaal={rest.length} start={15} wat="sites">
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
                {rest.map((c, i) => (
                  <tr key={c.domein} {...extra(i, 15)} className="border-b border-zinc-100 last:border-0">
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
          </Ingekort>
        </Blok>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="diensten" className="scroll-mt-36 pt-8">
        <Blok titel="Dienstendekking — wat biedt de markt aan en waar zit het gat" aantal={`${diensten.length} diensten`}>
          <Ingekort totaal={diensten.length} start={10} wat="diensten">
          <div className="space-y-2.5">
            {diensten.map((d, i) => (
              <div key={d.dienst} {...extra(i, 10)} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-zinc-700 sm:w-52">{d.dienst}</div>
                <div className="h-2 flex-1 rounded bg-zinc-100">
                  <div className="h-2 rounded bg-emerald-600" style={{ width: `${d.aandeel * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-zinc-500">
                  {d.aantal} sites · {Math.round(d.aandeel * 100)}%
                </div>
              </div>
            ))}
          </div>
          </Ingekort>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Herkend op basis van de homepage en de URL-structuur van de sites in deze markt. Een
            dienst die bijna niemand noemt is ofwel oninteressant, ofwel onze opening — dat verschil
            maakt de markt, niet de meting.
          </p>
        </Blok>

        {herschrijf.length > 0 && (
          <div className="mt-4">
            <Blok titel="Herschrijfkansen — overheid en portalen die onze zoektermen bezetten" aantal={`${herschrijf.length} pagina's`}>
              <p className="mb-3 text-sm text-zinc-600">
                Geen concurrenten, maar wel de pagina&rsquo;s waarvan Google vindt dat ze bij deze
                zoektermen horen. Vaak algemeen geschreven en zelden door een ingenieur. Dat is
                precies waar wij een duidelijker antwoord tegenover kunnen zetten.
              </p>
              <Ingekort totaal={herschrijf.length} start={5} wat="pagina's">
              <div className="overflow-x-auto">
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
                    <tr key={h.term + i} {...extra(i, 5)} className="border-b border-zinc-100 last:border-0">
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
              </div>
              </Ingekort>
            </Blok>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="zoekwoorden" className="scroll-mt-36 pt-8">
        <Blok titel="Zoekwoorden — de termen die deze markt afbakenen" aantal={`${num(zwStatus.termen)} termen`}>
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

          <Ingekort totaal={zoekwoorden.length} start={10} wat="termen">
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
                {zoekwoorden.map((z, i) => (
                  <tr key={z.term} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0">
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
          </Ingekort>

          <p className="mt-3 text-xs text-zinc-500">
            De lijst staat in <code>config/zoekwoorden-engineering.json</code> — termen bijzetten
            kan zonder code. Een term met de intentie{" "}
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">vacature</span>{" "}
            trekt zoekverkeer dat nooit klant wordt: op &ldquo;stabiliteitsingenieur&rdquo; — de
            grootste term van deze markt — staat de hele top 10 vol jobsites.
          </p>
        </Blok>

        {adverteerders.length > 0 && (
          <div className="mt-4">
            <Blok titel="Wie adverteert er op onze termen" aantal={`${adverteerders.length} adverteerders`}>
              <Ingekort totaal={adverteerders.length} start={5} wat="adverteerders">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {adverteerders.map((a, i) => (
                    <tr key={a.domein} {...extra(i, 5)} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-4 last:pr-0 text-zinc-800">{a.naam}</td>
                      <td className="py-1.5 pr-4 last:pr-0 text-xs text-blue-600">{a.domein}</td>
                      <td className="py-1.5 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-600">{num(a.termen)} termen</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </Ingekort>
              <p className="mt-3 text-xs text-zinc-500">
                Dit toont wie er adverteert, niet wat zij uitgeven. Geschatte budgetten horen niet
                als feit in een dashboard.
              </p>
            </Blok>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="signalen" className="scroll-mt-36 pb-12 pt-8">
        <Blok titel="Signalen — wat er veranderd is sinds de vorige controle" aantal={`${signalen.length} signalen`}>
          {signalen.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nog geen signalen voor deze markt. De eerste meting van een site legt alleen de
              beginstand vast; vanaf de tweede controle verschijnen hier nieuwe blogartikels en
              nieuwe pagina&rsquo;s.
            </p>
          ) : (
            <Ingekort totaal={signalen.length} start={10} wat="signalen">
            <ul className="divide-y divide-zinc-100">
              {signalen.map((s, i) => (
                <li key={s.id} {...extra(i, 10)} className="flex items-start gap-3 py-2.5">
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
            </Ingekort>
          )}
        </Blok>
      </section>
    </main>
  );
}
