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
} from "@/lib/concurrentieQueries";
import { serpBron } from "@/lib/zoekwoorden";
import { num } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";
import { SubNav } from "@/components/SubNav";

export const dynamic = "force-dynamic";

const ONS_DOMEIN = "energie-efficient.be";

const TABS = [
  { id: "markt", label: "De markt" },
  { id: "concurrenten", label: "Concurrenten" },
  { id: "diensten", label: "Diensten" },
  { id: "zoekwoorden", label: "Zoekwoorden" },
  { id: "signalen", label: "Signalen" },
  { id: "prospects", label: "Onderaanneming" },
];

function Datum({ d }: { d: string | null }) {
  if (!d) return <span className="text-zinc-300">—</span>;
  return <span>{d.split("-").reverse().join("/")}</span>;
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

export default async function ConcurrentiePage() {
  if (!concurrentieHeeftData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-bold text-zinc-900">Concurrentie — Energie</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Nog geen data. Draai eerst <code className="rounded bg-white px-1.5 py-0.5">/api/concurrentie</code> om
          het register in te lezen en de eerste sites te meten.
        </div>
      </main>
    );
  }

  const k = getMarktKpis();
  const status = getCrawlStatus();
  const sterkste = getSterksteOnline(15);
  const bureaus = getGrootsteBureaus(8);
  const provincies = getPerProvincie();
  const diensten = getDienstenDekking();
  const concurrenten = getConcurrenten("concurrent");
  const signalen = getSignalen(40);
  const prospects = getOnderaannemingProspects(40);
  const wij = getConcurrenten().find((c) => c.domein === ONS_DOMEIN);
  const zoekwoorden = getZoekwoorden();
  const zwStatus = getZoekwoordStatus();
  const adverteerders = getAdverteerders();
  const bron = serpBron();

  const totaalErkenningen = k.erkenningen || 1;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="sticky top-0 z-10 -mx-6 border-b border-zinc-200 bg-white/95 px-6 pb-0 pt-4 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-zinc-900">Concurrentie — Energie</h1>
          <div className="text-xs text-zinc-500">
            Register bijgewerkt 25/08/2026 · laatste sitecontrole{" "}
            {status.laatste_crawl ? status.laatste_crawl.split("-").reverse().join("/") : "nog niet"}
            {status.nooit_gecrawld > 0 && ` · ${num(status.nooit_gecrawld)} domeinen nog te meten`}
          </div>
        </div>
        <SubNav items={TABS} />
      </div>

      {/* ------------------------------------------------------------------ */}
      <section id="markt" className="scroll-mt-36 pt-8">
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

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Sterkst online in onze markt — naar aantal EPB- en energiepagina's">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 font-medium">Bedrijf</th>
                    <th className="pb-2 text-right font-medium">EPB-pagina's</th>
                    <th className="pb-2 text-right font-medium">Totaal</th>
                    <th className="pb-2 text-right font-medium">Artikels</th>
                    <th className="pb-2 font-medium">Laatste post</th>
                    <th className="pb-2 text-right font-medium">Vslg.</th>
                  </tr>
                </thead>
                <tbody>
                  {sterkste.map((b) => (
                    <tr key={b.domein} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2">
                        <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                           className="font-medium text-zinc-800 hover:text-blue-700 hover:underline">{b.domein}</a>
                        <div className="text-xs text-zinc-500">{b.naam}</div>
                        {!!b.spam_verdacht && (
                          <div className="text-[11px] text-red-600">
                            {num(b.spam_verdacht)} spam-URL's — site vermoedelijk gehackt
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold text-zinc-800">{num(b.epb_paginas || 0)}</td>
                      <td className="py-2 text-right text-zinc-500">
                        <Paginas n={b.paginas} sitemap={b.heeft_sitemap} />
                      </td>
                      <td className="py-2 text-right text-zinc-600">{num(b.blog_artikels || 0)}</td>
                      <td className="py-2 text-zinc-600"><Datum d={b.laatste_blog} /></td>
                      <td className="py-2 text-right text-zinc-500">{b.verslaggevers || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                Gerangschikt op pagina's die over EPB, energie of ventilatie gaan — niet op de
                totale omvang van de site. Arcadis en Sweco hebben duizenden pagina's maar zijn
                geen EPB-bureau; mijnEPB heeft drie verslaggevers en staat wél overal.
              </p>
            </Card>

            <div className="mt-4">
              <Card title="Meeste mensen in dienst — de andere lens">
                <table className="w-full text-sm">
                  <tbody>
                    {bureaus.map((b) => (
                      <tr key={b.domein} className="border-b border-zinc-100 last:border-0">
                        <td className="py-1.5">
                          <span className="text-zinc-800">{b.naam}</span>{" "}
                          <a href={`https://${b.domein}`} target="_blank" rel="noreferrer noopener"
                             className="text-xs text-blue-600 hover:underline">{b.domein}</a>
                        </td>
                        <td className="py-1.5 text-right text-zinc-500">{b.provincie || "—"}</td>
                        <td className="py-1.5 w-24 text-right">
                          <span className="font-semibold text-zinc-800">{b.verslaggevers}</span>
                          <span className="text-xs text-zinc-400"> verslaggevers</span>
                        </td>
                        <td className="py-1.5 w-28 text-right text-xs text-zinc-500">
                          {b.bereikbaar === null ? "nog niet gemeten" : `${num(b.epb_paginas || 0)} EPB-pag.`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-zinc-500">
                  Veel mensen in dienst is niet hetzelfde als zichtbaar zijn. Egeon heeft de
                  grootste ploeg maar publiceerde voor het laatst in september 2025.
                </p>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <Card title="Waar zitten ze">
              <div className="space-y-2">
                {provincies.map((p) => (
                  <div key={p.provincie}>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">{p.provincie}</span>
                      <span className="font-medium text-zinc-800">{num(p.erkenningen)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-zinc-100">
                      <div className="h-1.5 rounded bg-cyan-600"
                           style={{ width: `${(p.erkenningen / totaalErkenningen) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Onze eigen site">
              {wij ? (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-zinc-500">Pagina's</dt>
                    <dd className="font-medium"><Paginas n={wij.paginas} sitemap={wij.heeft_sitemap} /></dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Waarvan over EPB</dt>
                    <dd className="font-medium">{num(wij.epb_paginas || 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Blogartikels</dt>
                    <dd className="font-medium">{num(wij.blog_artikels || 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Laatste publicatie</dt>
                    <dd className="font-medium"><Datum d={wij.laatste_blog} /></dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Laadtijd</dt>
                    <dd className="font-medium">{wij.ttfb_ms ? `${num(wij.ttfb_ms)} ms` : "—"}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-zinc-500">energie-efficient.be is nog niet gemeten.</p>
              )}
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                Vergelijk dit met de tabel links: dat is het gat dat we dichten.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="concurrenten" className="scroll-mt-36 pt-8">
        <Card title={`Concurrenten — ${num(concurrenten.length)} bedrijven met twee of meer erkende verslaggevers`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 font-medium">Bedrijf</th>
                  <th className="pb-2 text-right font-medium">EPB-pag.</th>
                  <th className="pb-2 text-right font-medium">Totaal</th>
                  <th className="pb-2 text-right font-medium">Artikels</th>
                  <th className="pb-2 text-right font-medium">Vslg.</th>
                  <th className="pb-2 font-medium">Laatste post</th>
                  <th className="pb-2 font-medium">Diensten</th>
                  <th className="pb-2 font-medium">CMS</th>
                </tr>
              </thead>
              <tbody>
                {concurrenten.map((c) => (
                  <tr key={c.domein} className="border-b border-zinc-100 last:border-0 align-top">
                    <td className="py-2">
                      <div className="font-medium text-zinc-800">{c.naam}</div>
                      <a href={`https://${c.domein}`} target="_blank" rel="noreferrer noopener"
                         className="text-xs text-blue-600 hover:underline">{c.domein}</a>
                      {c.bereikbaar === 0 && <div className="text-[11px] text-red-500">{c.fout || "site onbereikbaar"}</div>}
                      {!!c.spam_verdacht && (
                        <div className="text-[11px] text-red-600">{num(c.spam_verdacht)} spam-URL's — vermoedelijk gehackt</div>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold text-zinc-800">{num(c.epb_paginas || 0)}</td>
                    <td className="py-2 text-right text-zinc-500"><Paginas n={c.paginas} sitemap={c.heeft_sitemap} /></td>
                    <td className="py-2 text-right text-zinc-600">
                      {c.bereikbaar === null ? <span className="text-zinc-300">—</span> : num(c.blog_artikels || 0)}
                    </td>
                    <td className="py-2 text-right text-zinc-500">{c.verslaggevers}</td>
                    <td className="py-2 text-zinc-600"><Datum d={c.laatste_blog} /></td>
                    <td className="py-2"><Diensten json={c.diensten} /></td>
                    <td className="py-2 text-xs text-zinc-500">{c.cms || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            "Laatste post" komt uit de <code>lastmod</code> van de sitemap. Bij een sitemigratie
            krijgen alle artikels dezelfde datum — behandel die kolom als richtinggevend, niet als bewijs.
          </p>
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
                  <div className="h-2 rounded bg-cyan-600" style={{ width: `${d.aandeel * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-zinc-500">
                  {d.aantal} sites · {Math.round(d.aandeel * 100)}%
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Herkend op basis van de homepage en de URL-structuur. Een dienst die bijna niemand
            noemt is ofwel oninteressant, ofwel onze opening.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="zoekwoorden" className="scroll-mt-36 pt-8">
        <Card title={`Zoekwoorden — ${num(zwStatus.termen)} termen die deze markt afbakenen`}>
          {!bron.klaar && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">Nog geen positiemeting</div>
              <p className="mt-1">
                Posities in Google zijn niet gratis en betrouwbaar te krijgen: Google zelf uitlezen
                is precies wat de blokkades tegenhouden die we bij concurrenten ook tegenkomen.
                Daarvoor is een betaalde SERP-bron nodig. Voor deze lijst gaat het om enkele euro's
                per maand bij een wekelijkse meting.
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 font-medium">Zoekterm</th>
                  <th className="pb-2 font-medium">Thema</th>
                  <th className="pb-2 font-medium">Intentie</th>
                  <th className="pb-2 text-right font-medium">Volume/mnd</th>
                  <th className="pb-2 text-right font-medium">Wij</th>
                  <th className="pb-2 font-medium">Beste concurrent</th>
                  <th className="pb-2 text-right font-medium">Ads</th>
                </tr>
              </thead>
              <tbody>
                {zoekwoorden.map((z) => (
                  <tr key={z.term} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 text-zinc-800">{z.term}</td>
                    <td className="py-2 text-zinc-500">{z.thema}</td>
                    <td className="py-2">
                      <span className={
                        "rounded px-1.5 py-0.5 text-[11px] " +
                        (z.intentie === "probleem" ? "bg-amber-100 text-amber-800"
                          : z.intentie === "dienst" ? "bg-cyan-50 text-cyan-800"
                          : "bg-zinc-100 text-zinc-600")
                      }>{z.intentie}</span>
                    </td>
                    <td className="py-2 text-right text-zinc-700">
                      {z.volume === null ? <span className="text-zinc-300">—</span> : num(z.volume)}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {z.onze_positie ? <span className="text-zinc-800">{z.onze_positie}</span>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2 text-zinc-600">
                      {z.beste_concurrent
                        ? <>{z.beste_concurrent} <span className="text-xs text-zinc-400">#{z.beste_positie}</span></>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-2 text-right text-zinc-500">
                      {z.adverteerders ? num(z.adverteerders) : <span className="text-zinc-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            De lijst staat in <code>config/zoekwoorden-energie.json</code>. Mukesh en Jean mogen
            daar termen bij zetten — daar is geen code voor nodig.
          </p>
        </Card>

        {adverteerders.length > 0 && (
          <div className="mt-4">
            <Card title="Wie adverteert er op onze termen">
              <table className="w-full text-sm">
                <tbody>
                  {adverteerders.map((a) => (
                    <tr key={a.domein} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 text-zinc-800">{a.naam}</td>
                      <td className="py-1.5 text-xs text-blue-600">{a.domein}</td>
                      <td className="py-1.5 text-right text-zinc-600">{num(a.termen)} termen</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                Dit toont wie er adverteert, niet wat zij uitgeven. Bedragen zoals "3.000 per maand"
                zijn schattingen en horen niet als feit in een dashboard.
              </p>
            </Card>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="signalen" className="scroll-mt-36 pt-8">
        <Card title="Signalen — wat er veranderd is sinds de vorige controle">
          {signalen.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nog geen signalen. De eerste meting van een site legt alleen de beginstand vast;
              vanaf de tweede controle verschijnen hier nieuwe blogartikels en nieuwe pagina's.
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

      {/* ------------------------------------------------------------------ */}
      <section id="prospects" className="scroll-mt-36 pt-8 pb-12">
        <Card title="Erkend maar nauwelijks online — kandidaten voor onderaanneming">
          <p className="mb-4 text-sm text-zinc-600">
            {num(k.zonder_domein)} van de {num(k.erkenningen)} erkenningen hangt aan een gratis
            mailadres, zonder eigen domein. Dat zijn geen concurrenten maar zelfstandigen die werk
            uitbesteden of aannemen.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 font-medium">Naam</th>
                  <th className="pb-2 font-medium">Bedrijf</th>
                  <th className="pb-2 font-medium">Gemeente</th>
                  <th className="pb-2 font-medium">Provincie</th>
                  <th className="pb-2 font-medium">Website</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => (
                  <tr key={`${p.naam}-${i}`} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 text-zinc-800">{p.naam}</td>
                    <td className="py-2 text-zinc-600">{p.bedrijf || "—"}</td>
                    <td className="py-2 text-zinc-600">{p.gemeente}</td>
                    <td className="py-2 text-zinc-500">{p.provincie || "—"}</td>
                    <td className="py-2 text-xs">
                      {p.domein
                        ? <a href={`https://${p.domein}`} target="_blank" rel="noreferrer noopener" className="text-blue-600 hover:underline">{p.domein}</a>
                        : <span className="text-zinc-400">geen</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Contactgegevens komen uit het openbare VEKA-register. Enkel voor intern gebruik.
          </p>
        </Card>
      </section>
    </main>
  );
}
