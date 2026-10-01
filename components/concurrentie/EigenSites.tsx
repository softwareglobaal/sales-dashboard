import type { BureauRij, ConcurrentRij, Markt } from "@/lib/concurrentieQueries";
import { rolVan, type Plek } from "@/lib/onzePlek";

// Zoals .kaartrooster, maar de kaartjes rekken uit tot de volle breedte (auto-fit):
// twee eigen sites staan dan niet verloren in een rooster van vijf kolommen. min()
// houdt het op een gsm van 375 px binnen het paneel.
const ROOSTER = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" };

const n = (x: number) => new Intl.NumberFormat("nl-BE").format(x || 0);
const datumNl = (d: string) => d.split("-").reverse().join("/");

/** Pagina-aantal: 0 uit een sitemap is iets anders dan geen sitemap gevonden. */
function Paginas({ n: aantal, sitemap }: { n: number | null; sitemap: number | null }) {
  if (sitemap === 0) return <span className="text-zinc-400" title="Geen sitemap gevonden — aantal onbekend">geen sitemap</span>;
  if (aantal === null || aantal === undefined) return <span className="text-zinc-300">—</span>;
  return <>{n(aantal)}</>;
}

function Datum({ d, href }: { d: string | null; href?: string | null }) {
  if (!d) return <span className="text-zinc-300">—</span>;
  if (!href) return <span>{datumNl(d)}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-blue-600 hover:underline">
      {datumNl(d)}
    </a>
  );
}

/**
 * De "Wij"-regel onder het leaderboard, maar dan per eigen site: één kaartje per
 * site met dezelfde cijfers als de top 5 erboven, naast elkaar.
 */
export function EigenSitesKaartjes({
  markt,
  sites,
  maat,
  plek,
}: {
  markt: Markt;
  sites: ConcurrentRij[];
  maat: (aantal: number | null) => string;
  plek: Record<string, Plek | null>;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-medium text-zinc-700">Wij, per site</div>
      <div className="kaartrooster" style={ROOSTER}>
        {sites.map((s) => {
          const p = plek[s.domein];
          return (
            <div key={s.domein} className="kaart min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <a href={`https://${s.domein}`} target="_blank" rel="noreferrer noopener"
                   className="n min-w-0 truncate hover:underline" title={s.domein}>{s.domein}</a>
                <span className="chip accent">wij</span>
              </div>
              <div className="s">{rolVan(markt, s.domein)}</div>
              {s.bereikbaar === null || s.bereikbaar === undefined ? (
                <p className="mt-2 text-xs text-zinc-500">nog niet gemeten</p>
              ) : (
                <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                  <div>
                    <span className="font-semibold text-zinc-700">{n(s.omvang || 0)}</span> {maat(s.omvang)}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-700">{n(s.blog_artikels || 0)}</span>{" "}
                    {s.blog_artikels === 1 ? "artikel" : "artikels"}
                  </div>
                  <div>
                    {s.laatste_blog ? <>laatste post <Datum d={s.laatste_blog} href={s.laatste_blog_url} /></>
                      : <span className="text-zinc-400">geen recente post</span>}
                  </div>
                </div>
              )}
              {p && (
                <div className="voet">
                  <span className="text-zinc-500">op omvang</span>
                  <span className="chip">zou #{n(p.plek)} zijn van {n(p.totaal)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Onze eigen site" werd "onze sites tegenover de markt": één rij per eigen site,
 * met de nummer één van de markt en het gemiddelde eronder als maatstok.
 */
export function EigenSitesTabel({
  markt,
  sites,
  maatKort,
  plek,
  top,
  gemiddelde,
  proef = [],
}: {
  markt: Markt;
  sites: ConcurrentRij[];
  maatKort: string;
  plek: Record<string, Plek | null>;
  top?: BureauRij;
  gemiddelde?: number | null;
  proef?: string[];
}) {
  return (
    <div className="tabelwrap">
      <table className="tabel">
        <thead>
          <tr>
            <th>Site</th>
            <th className="num">Pagina&rsquo;s</th>
            <th className="num">{maatKort}</th>
            <th className="num">Artikels</th>
            <th>Laatste post</th>
            <th className="num">Laadtijd</th>
            <th className="num">Plek op omvang</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => {
            const p = plek[s.domein];
            const gemeten = s.bereikbaar !== null && s.bereikbaar !== undefined;
            return (
              <tr key={s.domein}>
                <td>
                  <a href={`https://${s.domein}`} target="_blank" rel="noreferrer noopener"
                     className="whitespace-nowrap font-medium hover:underline">{s.domein}</a>
                  <div className="text-[11.5px] text-zinc-500">
                    {rolVan(markt, s.domein)}
                    {proef.includes(s.domein) ? " · telt niet mee in de som" : ""}
                  </div>
                  {s.bereikbaar === 0 && <div className="text-[11px] text-red-500">{s.fout || "site onbereikbaar"}</div>}
                </td>
                <td className="num">{gemeten ? <Paginas n={s.paginas} sitemap={s.heeft_sitemap} /> : <span className="text-zinc-400">nog niet gemeten</span>}</td>
                <td className="num font-semibold">{gemeten ? n(s.omvang || 0) : "—"}</td>
                <td className="num">{gemeten ? n(s.blog_artikels || 0) : "—"}</td>
                <td className="whitespace-nowrap"><Datum d={s.laatste_blog} href={s.laatste_blog_url} /></td>
                <td className="num whitespace-nowrap">{s.ttfb_ms ? `${n(s.ttfb_ms)} ms` : "—"}</td>
                <td className="num whitespace-nowrap">{p ? `#${n(p.plek)} van ${n(p.totaal)}` : "—"}</td>
              </tr>
            );
          })}
          {top && (
            <tr className="text-zinc-500">
              <td>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Nr. 1 van de markt</span>
                <div>
                  <a href={`https://${top.domein}`} target="_blank" rel="noreferrer noopener" className="hover:underline">{top.domein}</a>
                </div>
              </td>
              <td className="num"><Paginas n={top.paginas} sitemap={top.heeft_sitemap} /></td>
              <td className="num">{n(top.omvang || 0)}</td>
              <td className="num">{n(top.blog_artikels || 0)}</td>
              <td className="whitespace-nowrap"><Datum d={top.laatste_blog} href={top.laatste_blog_url} /></td>
              <td className="num">—</td>
              <td className="num">#1</td>
            </tr>
          )}
          {gemiddelde ? (
            <tr className="text-zinc-500">
              <td>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Gemiddelde</span>
                <div className="text-[11.5px]">sites met minstens één pagina in deze markt</div>
              </td>
              <td className="num">—</td>
              <td className="num">{n(Math.round(gemiddelde))}</td>
              <td className="num">—</td>
              <td>—</td>
              <td className="num">—</td>
              <td className="num">—</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
