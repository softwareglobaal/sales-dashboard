import { DienstTabs } from "@/components/dienst/DienstKop";
import {
  concurrentieHeeftData,
  getMarktKpis,
  getConcurrenten,
  getGrootsteBureaus,
  getSterksteOnline,
  getPerProvincie,
  getDienstenDekking,
  getSignalen,
  getOnderaannemingProspects,
  getCrawlStatus,
  getZoekwoorden,
  getZoekwoordStatus,
  getAdverteerders,
  getLeaderboard,
  getProvincieVergelijking,
  getHerschrijfKansen,
  telAfgekeurdeProspects,
  getOnzeGscPosities,
  gscStatus,
  gscOntbrekendeSites,
  getEigenSites,
  getEigenPosities,
  getEigenGsc,
} from "@/lib/concurrentieQueries";
import { OMVANG, plekGoogle, plekOpOmvang, plekRanglijst, zoekSamenvatting, type PlekRegel } from "@/lib/onzePlek";
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

const MARKT = "energie" as const;

const TABS = [
  { id: "leaders", label: "Leaders" },
  { id: "markt", label: "De markt" },
  { id: "concurrenten", label: "Concurrenten" },
  { id: "diensten", label: "Diensten" },
  { id: "zoekwoorden", label: "Zoekwoorden" },
  { id: "signalen", label: "Signalen" },
  { id: "prospects", label: "Onderaanneming" },
];

/**
 * Bij een gehackte site is de nieuwste "publicatie" spam, in wisselende talen.
 * Die datum als publicatietempo tonen is misleidend, dus die onderdrukken we —
 * dat is betrouwbaarder dan elke taalvariant van gokspam willen herkennen.
 */
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

export default async function ConcurrentiePage({
  searchParams,
}: {
  searchParams: Promise<{ toon?: string }>;
}) {
  const sp = await searchParams;
  const toonAlles = sp.toon === "alles";
  if (!concurrentieHeeftData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
      <DienstTabs pad="energy" tab="concurrentie" />
        <h1 className="h1-glas klein">Concurrentie — Energie</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Nog geen data. Draai eerst <code className="rounded bg-white px-1.5 py-0.5">/api/concurrentie</code> om
          het register in te lezen en de eerste sites te meten.
        </div>
      </main>
    );
  }

  const k = getMarktKpis();
  const status = getCrawlStatus();
  // De ranglijsten volledig ophalen: de pagina toont de top, "Onze plek" rekent
  // de plaats van elke eigen site uit over de hele lijst.
  const alleSterkste = getSterksteOnline(100000);
  const sterkste = alleSterkste.slice(0, 15);
  const alleBureaus = getGrootsteBureaus(100000).filter((b) => (b.verslaggevers || 0) > 0);
  const bureaus = alleBureaus.slice(0, 8);
  const provincies = getPerProvincie();
  const diensten = getDienstenDekking();
  const concurrenten = getConcurrenten("concurrent");
  const signalen = getSignalen(40);
  const prospects = getOnderaannemingProspects(60, sp.toon === "afgekeurd");
  const afgekeurd = telAfgekeurdeProspects();
  const eigen = getEigenSites(MARKT);
  const eigenPos = getEigenPosities(MARKT);
  const eigenGsc = getEigenGsc(MARKT);
  const zoekwoorden = getZoekwoorden();
  const zwStatus = getZoekwoordStatus();
  const adverteerders = getAdverteerders();
  const leaderboard = getLeaderboard(8, 5, toonAlles);
  const provincies2 = getProvincieVergelijking();
  const herschrijf = getHerschrijfKansen(12);
  const perTerm = leaderboard.reduce<Record<string, typeof leaderboard>>((acc, r) => {
    (acc[r.term] ||= []).push(r);
    return acc;
  }, {});
  const bron = serpBron();
  const gsc = gscBeschikbaar();
  const gscCijfers = gscStatus();
  const onzePosities = getOnzeGscPosities(12);
  const gscOntbreekt = gscOntbrekendeSites();
  const bronnen = [
    { naam: "Sitecrawl concurrenten", klaar: true, uitleg: `${num(status.gisteren_gemeten || 0)} sites vandaag gemeten` },
    { naam: "Zoekvolume (Google Ads)", klaar: zwStatus.met_volume > 0,
      uitleg: zwStatus.met_volume > 0 ? `${num(zwStatus.met_volume)} termen` : "draai /api/zoekwoorden?volumes=1 op de server" },
    { naam: "Onze posities (Search Console)", klaar: gsc.klaar && gscCijfers.metingen > 0,
      uitleg: gscCijfers.metingen > 0 ? `${num(gscCijfers.metingen)} termen, ${num(gscCijfers.vertoningen || 0)} vertoningen`
        : gsc.reden || "nog niet opgehaald" },
    { naam: "Posities concurrenten (SerpApi)", klaar: bron.klaar,
      uitleg: bron.klaar ? `via ${bron.naam}` : "gratis SERPAPI_KEY instellen" },
  ];

  // "Onze plek": per eigen site de plaats in elke ranglijst van deze pagina.
  const plekOmvang = Object.fromEntries(eigen.map((e) => [e.domein, plekOpOmvang(alleSterkste, e)]));
  const plekken: Record<string, PlekRegel[]> = Object.fromEntries(eigen.map((e) => [e.domein, [
    plekGoogle({
      lijst: "Wie leidt er online (Google-top 5)",
      leaderboard, posities: eigenPos.rijen, domein: e.domein, diepte: 5,
    }),
    plekRanglijst({
      lijst: "Sterkst online (EPB-pagina's)",
      rijen: alleSterkste, eigen: e, sleutels: OMVANG, getoond: sterkste.length,
      waarde: (r) => `${num(r.omvang || 0)} EPB-pag.`,
    }),
    plekRanglijst({
      lijst: "Concurrenten (EPB-pagina's)",
      rijen: concurrenten, eigen: e,
      sleutels: [(r) => r.omvang || 0, (r) => r.verslaggevers || 0],
    }),
    plekRanglijst({
      lijst: "Meeste mensen in dienst",
      rijen: alleBureaus, eigen: e, getoond: bureaus.length,
      sleutels: [(r) => r.verslaggevers || 0, (r) => r.epb_paginas || 0],
      waarde: (r) => `${num(r.verslaggevers || 0)} verslaggevers`,
    }),
  ].filter((r): r is PlekRegel => !!r)]));
  const zoek = Object.fromEntries(eigen.map((e) => [e.domein, zoekSamenvatting(eigenPos.rijen, eigenPos.termen, e.domein)]));
  const termen = Object.keys(perTerm);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <DienstTabs pad="energy" tab="concurrentie" />
      <div className="kopbalk">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="h1-glas klein">Concurrentie — Energie</h1>
          <div className="text-xs text-zinc-500">
            Register bijgewerkt 25/08/2026 · laatste sitecontrole{" "}
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
        />

        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {bronnen.map((b) => (
            <div key={b.naam} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3">
              <span className={
                "mt-1 h-2 w-2 shrink-0 rounded-full " + (b.klaar ? "bg-emerald-500" : "bg-zinc-300")
              } />
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-700">{b.naam}</div>
                <div className="truncate text-[11px] text-zinc-500" title={b.uitleg}>{b.uitleg}</div>
              </div>
            </div>
          ))}
        </div>

        {gscOntbreekt.length > 0 && gscCijfers.metingen > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-medium">
              Geen Search Console-property voor {gscOntbreekt.join(" en ")}
            </div>
            <p className="mt-1">
              Google meet die site dus niet voor ons. Maak er een Domain-property van
              (DNS-verificatie bij one.com) — dan overleeft ze ook de migratie naar de nieuwe
              site. Zolang dat niet gebeurt, hebben we geen nulmeting om de migratie tegen af
              te zetten.
            </p>
          </div>
        )}

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
                  href={toonAlles ? "/energy/concurrentie" : "/energy/concurrentie?toon=alles"}
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
                            "truncate " + (r.van_ons ? "font-semibold text-cyan-700" : "text-zinc-600")
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
                Google-posities zijn nog niet gekoppeld. Dit is de rangorde op wat we zelf meten:
                omvang in onze markt, hoeveel er gepubliceerd wordt en hoe recent.
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {sterkste.slice(0, 5).map((b, i) => (
                  <div key={b.domein} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-baseline gap-2">
                      <span className={
                        "text-lg font-bold tabular-nums " + (i === 0 ? "text-cyan-700" : "text-zinc-300")
                      }>{i + 1}</span>
                      <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                         className="truncate text-sm font-medium text-zinc-800 hover:text-blue-700 hover:underline"
                         title={b.domein}>{b.domein}</a>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                      <div>
                        <span className="font-semibold text-zinc-700">{num(b.epb_paginas || 0)}</span>{" "}
                        {b.epb_paginas === 1 ? "EPB-pagina" : "EPB-pagina's"}
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
              {onzePosities.length > 0 && (
                <div className="mt-4 rounded-lg border border-zinc-200 p-3">
                  <div className="mb-2 text-xs font-medium text-zinc-700">
                    Onze eigen posities volgens Google — Search Console,{" "}
                    {gscCijfers.datum?.split("-").reverse().join("/")}
                  </div>
                  <Ingekort totaal={onzePosities.length} start={5} wat="termen">
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
                  </Ingekort>
                </div>
              )}
            </>
          )}

          <EigenSitesKaartjes
            markt={MARKT}
            sites={eigen}
            plek={plekOmvang}
            maat={(n) => (n === 1 ? "EPB-pagina" : "EPB-pagina's")}
          />
        </Blok>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="markt" className="scroll-mt-36 pt-0">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi label="Erkenningen" value={num(k.erkenningen)} sub={`${num(k.personen)} personen`} />
          <Kpi label="Bedrijven" value={num(k.bedrijven)} sub="met eigen domein" />
          <Kpi label="Echte concurrenten" value={num(k.concurrenten)} sub="2+ verslaggevers" />
          <Kpi label="Sites gemeten" value={num(k.gemeten || 0)} sub={`${num(k.online || 0)} online`} />
          <Kpi
            label="Publiceert nog"
            value={num(k.actief_bloggend || 0)}
            sub={k.gemeten ? `van ${num(k.gemeten)} sites — laatste 90 dagen` : undefined}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Blok titel="Sterkst online in onze markt — naar aantal EPB- en energiepagina's" aantal={`top ${sterkste.length}`}>
              <Ingekort totaal={sterkste.length} start={10} wat="bedrijven">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Bedrijf</th>
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">EPB-pagina's</th>
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Totaal</th>
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Artikels</th>
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Laatste post</th>
                    <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Vslg.</th>
                  </tr>
                </thead>
                <tbody>
                  {sterkste.map((b, i) => (
                    <tr key={b.domein} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-4 last:pr-0">
                        <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                           className="font-medium text-zinc-800 hover:text-blue-700 hover:underline">{b.domein}</a>
                        <div className="text-xs text-zinc-500">{b.naam}</div>
                        {(b.spam_verdacht || 0) >= 3 && (
                          <div className="text-[11px] text-red-600">
                            {num(b.spam_verdacht || 0)} spam-URL's — site vermoedelijk gehackt
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right font-semibold text-zinc-800">{num(b.epb_paginas || 0)}</td>
                      <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500">
                        <Paginas n={b.paginas} sitemap={b.heeft_sitemap} />
                      </td>
                      <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-600">{num(b.blog_artikels || 0)}</td>
                      <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-zinc-600">
                        <Datum d={b.laatste_blog} href={b.laatste_blog_url} verdacht={(b.spam_verdacht || 0) >= 3} />
                      </td>
                      <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500">{b.verslaggevers || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </Ingekort>
              <p className="mt-3 text-xs text-zinc-500">
                Gerangschikt op pagina's die over EPB, energie of ventilatie gaan — niet op de
                totale omvang van de site. Arcadis en Sweco hebben duizenden pagina's maar zijn
                geen EPB-bureau; mijnEPB heeft drie verslaggevers en staat wél overal.
              </p>
            </Blok>

            <div className="mt-4">
              <Blok titel="Meeste mensen in dienst — de andere lens" aantal={`top ${bureaus.length}`}>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {bureaus.map((b) => (
                      <tr key={b.domein} className="border-b border-zinc-100 last:border-0">
                        <td className="py-1.5 pr-4 last:pr-0">
                          <span className="text-zinc-800">{b.naam}</span>{" "}
                          <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                             className="text-xs text-blue-600 hover:underline">{b.domein}</a>
                        </td>
                        <td className="py-1.5 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500">{b.provincie || "—"}</td>
                        <td className="py-1.5 pr-4 last:pr-0 whitespace-nowrap w-24 text-right">
                          <span className="font-semibold text-zinc-800">{b.verslaggevers}</span>
                          <span className="text-xs text-zinc-400"> verslaggevers</span>
                        </td>
                        <td className="py-1.5 pr-4 last:pr-0 whitespace-nowrap w-28 text-right text-xs text-zinc-500">
                          {b.bereikbaar === null ? "nog niet gemeten" : `${num(b.epb_paginas || 0)} EPB-pag.`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Veel mensen in dienst is niet hetzelfde als zichtbaar zijn. Egeon heeft de
                  grootste ploeg maar publiceerde voor het laatst in september 2025.
                </p>
              </Blok>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <Blok titel="Waar staan wij tegenover de markt">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-medium">Provincie</th>
                    <th className="pb-2 pr-3 text-right font-medium">Markt</th>
                    <th className="pb-2 pr-3 text-right font-medium">Wij</th>
                    <th className="pb-2 text-right font-medium">Dekking</th>
                  </tr>
                </thead>
                <tbody>
                  {provincies2.map((p) => (
                    <tr key={p.provincie} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pr-3 text-zinc-700">{p.provincie}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-500">{num(p.erkenningen)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-800">{num(p.onzeDeals)}</td>
                      <td className="py-1.5 text-right">
                        {p.erkenningen === 0 ? (
                          <span className="text-zinc-300">—</span>
                        ) : (
                          <span className={
                            "tabular-nums font-medium " +
                            (p.dekking >= 0.5 ? "text-emerald-700" : p.dekking >= 0.3 ? "text-zinc-600" : "text-amber-700")
                          }>
                            {p.dekking.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                Markt = erkende verslaggevers, Wij = onze Energy-projecten. Dekking is het
                aantal projecten per erkende verslaggever: <span className="text-amber-700">laag</span> betekent
                veel markt waar wij weinig doen.
              </p>
            </Blok>

          </div>
        </div>

        <div className="mt-4">
          <Blok titel="Onze sites tegenover de markt" aantal={`${eigen.length} sites`}>
            <EigenSitesTabel
              markt={MARKT}
              sites={eigen}
              maatKort="EPB-pag."
              plek={plekOmvang}
              top={sterkste[0]}
              gemiddelde={k.gem_omvang}
            />
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              Eén rij per eigen site, met de nummer één van de markt en het gemiddelde eronder als
              maatstok. Het verschil met die twee rijen is het gat dat we dichten. Van unabo.be tellen
              hier alleen de pagina&rsquo;s over EPB, energie of ventilatie.
            </p>
          </Blok>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="concurrenten" className="scroll-mt-36 pt-8">
        <Blok titel="Concurrenten — bedrijven met twee of meer erkende verslaggevers" aantal={`${num(concurrenten.length)} bedrijven`}>
          <Ingekort totaal={concurrenten.length} start={10} wat="bedrijven">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Bedrijf</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">EPB-pag.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Totaal</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Artikels</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap text-right font-medium">Vslg.</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Laatste post</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">Diensten</th>
                  <th className="pb-2 pr-4 last:pr-0 whitespace-nowrap font-medium">CMS</th>
                </tr>
              </thead>
              <tbody>
                {concurrenten.map((c, i) => (
                  <tr key={c.domein} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0 align-top">
                    <td className="py-2 pr-4 last:pr-0">
                      <div className="font-medium text-zinc-800">{c.naam}</div>
                      <a href={`https://${c.domein}`} target="_blank" rel="noreferrer noopener"
                         className="text-xs text-blue-600 hover:underline">{c.domein}</a>
                      {c.bereikbaar === 0 && <div className="text-[11px] text-red-500">{c.fout || "site onbereikbaar"}</div>}
                      {(c.spam_verdacht || 0) >= 3 && (
                        <div className="text-[11px] text-red-600">{num(c.spam_verdacht || 0)} spam-URL's — vermoedelijk gehackt</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right font-semibold text-zinc-800">{num(c.epb_paginas || 0)}</td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500"><Paginas n={c.paginas} sitemap={c.heeft_sitemap} /></td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-600">
                      {c.bereikbaar === null ? <span className="text-zinc-300">—</span> : num(c.blog_artikels || 0)}
                    </td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-right text-zinc-500">{c.verslaggevers}</td>
                    <td className="py-2 pr-4 last:pr-0 whitespace-nowrap text-zinc-600">
                      <Datum d={c.laatste_blog} href={c.laatste_blog_url} verdacht={(c.spam_verdacht || 0) >= 3} />
                    </td>
                    <td className="py-2 pr-4 last:pr-0"><Diensten json={c.diensten} /></td>
                    <td className="py-2 pr-4 last:pr-0 text-xs text-zinc-500">{c.cms || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Ingekort>
          <p className="mt-3 text-xs text-zinc-500">
            "Laatste post" komt uit de <code>lastmod</code> van de sitemap. Bij een sitemigratie
            krijgen alle artikels dezelfde datum — behandel die kolom als richtinggevend, niet als bewijs.
          </p>
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
                  <div className="h-2 rounded bg-cyan-600" style={{ width: `${d.aandeel * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-zinc-500">
                  {d.aantal} sites · {Math.round(d.aandeel * 100)}%
                </div>
              </div>
            ))}
          </div>
          </Ingekort>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Herkend op basis van de homepage en de URL-structuur. Een dienst die bijna niemand
            noemt is ofwel oninteressant, ofwel onze opening.
          </p>
        </Blok>

        {herschrijf.length > 0 && (
          <div className="mt-4">
            <Blok titel="Herschrijfkansen — overheidspagina's die onze zoektermen bezetten" aantal={`${herschrijf.length} pagina's`}>
              <p className="mb-3 text-sm text-zinc-600">
                Geen concurrenten, maar wel de pagina's waarvan Google vindt dat ze bij deze
                zoektermen horen. Ambtelijk geschreven, en vaak onvolledig. Dat is precies
                waar wij een duidelijker antwoord tegenover kunnen zetten.
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
                Google zelf automatisch uitlezen mag niet en wordt geblokkeerd — dezelfde muur waar
                we bij Macobo en Impact-SB tegenaan lopen. Meten gaat dus via een tussenpartij.
                Met een gratis SerpApi-sleutel (<code>SERPAPI_KEY</code>) volstaat het maandquotum
                voor deze {num(zwStatus.termen)} termen bij een wekelijkse meting.
              </p>
              <p className="mt-2 text-xs">
                Zolang die bron er niet is blijven de positiekolommen leeg. Liever leeg dan een
                geraden getal waarop iemand beslissingen neemt.
              </p>
            </div>
          )}

          {zwStatus.met_volume === 0 && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-medium">Zoekvolumes nog niet opgehaald</div>
              <p className="mt-1">
                Die komen uit Google Ads Keyword Planner, via dezelfde koppeling als de
                advertentiesync — geen nieuwe toegang nodig. Draai{" "}
                <code className="rounded bg-white px-1.5 py-0.5">/api/zoekwoorden?volumes=1</code>{" "}
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
                          : z.intentie === "dienst" ? "bg-cyan-50 text-cyan-800"
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
            De lijst staat in <code>config/zoekwoorden-energie.json</code>. Mukesh en Jean mogen
            daar termen bij zetten — daar is geen code voor nodig. &ldquo;Wij&rdquo; is de beste
            positie van onze drie sites samen; per site staat het in &ldquo;Onze plek&rdquo; bovenaan.
          </p>
        </Blok>

        {adverteerders.length > 0 && (
          <div className="mt-4">
            <Blok titel="Wie adverteert er op onze termen" aantal={`${adverteerders.length} adverteerders`}>
              <Ingekort totaal={adverteerders.length} start={5} wat="adverteerders">
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
              </Ingekort>
              <p className="mt-3 text-xs text-zinc-500">
                Dit toont wie er adverteert, niet wat zij uitgeven. Bedragen zoals "3.000 per maand"
                zijn schattingen en horen niet als feit in een dashboard.
              </p>
            </Blok>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="signalen" className="scroll-mt-36 pt-8">
        <Blok titel="Signalen — wat er veranderd is sinds de vorige controle" aantal={`${signalen.length} signalen`}>
          {signalen.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nog geen signalen. De eerste meting van een site legt alleen de beginstand vast;
              vanaf de tweede controle verschijnen hier nieuwe blogartikels en nieuwe pagina's.
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

      {/* ------------------------------------------------------------------ */}
      <section id="prospects" className="scroll-mt-36 pt-8 pb-12">
        <Blok titel="Erkend maar nauwelijks online — kandidaten voor onderaanneming" aantal={`${num(prospects.length)} kandidaten`}>
          <p className="mb-4 text-sm text-zinc-600">
            {num(k.zonder_domein)} van de {num(k.erkenningen)} erkenningen hangt aan een gratis
            mailadres, zonder eigen domein. Dat zijn geen concurrenten maar zelfstandigen die werk
            uitbesteden of aannemen.
          </p>
          <Ingekort totaal={prospects.length} start={10} wat="kandidaten">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Naam</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Bedrijf</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Gemeente</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Website</th>
                  <th className="pb-2 whitespace-nowrap font-medium">Oordeel</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => (
                  <tr key={p.ep_code} {...extra(i, 10)} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-4 text-zinc-800">
                      {p.naam}
                      <div className="text-[11px] text-zinc-400">{p.provincie || "—"}</div>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{p.bedrijf || <span className="text-zinc-300">—</span>}</td>
                    <td className="py-2 pr-4 text-zinc-600">{p.gemeente}</td>
                    <td className="py-2 pr-4 text-xs">
                      {p.domein
                        ? <a href={`https://${p.domein}`} target="_blank" rel="noreferrer noopener" className="text-blue-600 hover:underline">{p.domein}</a>
                        : <span className="text-zinc-400">geen</span>}
                    </td>
                    <td className="py-2">
                      <Beoordeling soort="verslaggever" sleutel={p.ep_code} huidig={p.oordeel} />
                      {p.door && p.oordeel && (
                        <div className="text-[11px] text-zinc-400">door {p.door}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Ingekort>
          <p className="mt-3 text-xs text-zinc-500">
            Contactgegevens komen uit het openbare VEKA-register. Enkel voor intern gebruik.
          </p>
        </Blok>
      </section>
    </main>
  );
}
