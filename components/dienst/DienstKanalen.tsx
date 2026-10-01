import Link from "next/link";
import { bereik, dataset, filterFirma, firmasVan, isDienstPeriode, perKanaal, type Afdeling } from "@/lib/afdelingen";
import { campagnes, websites, websitesLink, seoLink } from "@/lib/kanalen";
import { euro, num } from "@/lib/format";
import { DienstKop, type DienstZoek } from "./DienstKop";
import { KanaalTabel } from "./KanaalTabel";

// Subtab Kanalen (spec §17): langs waar komen de aanvragen binnen. Daarnaast: hoe staan de
// eigen kanalen erbij. Elke website en campagne klikt door naar de volledige
// analyse, al gefilterd op deze dienst.

const datumNl = (d: string) => d.split("-").reverse().join("/");
const dagenGeleden = (d: string) => Math.round((Date.now() - Date.parse(d)) / 86400000);

export async function DienstKanalen({ a, sp }: { a: Afdeling; sp: DienstZoek }) {
  const periode = isDienstPeriode(sp.periode) ? sp.periode : "ytd";
  const f = sp.firma && firmasVan(a).some((x) => x.sleutel === sp.firma) ? sp.firma : undefined;
  const b = bereik(periode);
  const d = filterFirma(dataset(a), f);
  const kanalen = perKanaal(d, b.van, b.tot);
  const totaal = kanalen.reduce((s, k) => s + k.aanvragen, 0);
  const sites = await websites(a);
  const ads = campagnes(a);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <DienstKop a={a} tab="kanalen" sp={{ periode, firma: f }} />

      <section className="paneel mt-4">
        <div className="kop">
          <h2>Waar komen de aanvragen vandaan</h2>
          <small>
            {b.label} · {num(totaal)} aanvragen · kanaal = deal-label in Pipedrive
          </small>
        </div>
        {kanalen.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Geen aanvragen in deze periode.</p>
        ) : (
          <KanaalTabel kanalen={kanalen} totaal={totaal} />
        )}
        <p className="mt-3 text-[11.5px] text-zinc-500">
          Winratio hier = gewonnen van de aanvragen uit de periode. Een deal met twee labels telt bij beide kanalen.
        </p>
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-serif text-[20px]">Websites</h2>
          <Link href={websitesLink(a)} className="knop-licht knop-klein">
            Alle sites van {a.naam} in Websites
          </Link>
        </div>
        <div className="kaartrooster">
          {sites.map((s) => (
            <div key={s.sleutel + s.paden.join()} className="kaart">
              <div className="n">{s.naam}</div>
              <div className="s">
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.url.replace(/^https?:\/\//, "")}
                </a>
                {s.paden.length > 0 && <> · enkel pagina&apos;s over {s.paden.slice(0, 3).join(", ")}</>}
              </div>
              <div className="mt-3 text-[12.5px] text-zinc-700">
                {s.aangepast ? (
                  <>
                    Laatst aangepast <b className="font-medium">{datumNl(s.aangepast)}</b> ({dagenGeleden(s.aangepast)} dagen)
                    {s.aangepastBron === "sitemap" && <span className="text-zinc-500"> · volgens de sitemap</span>}
                  </>
                ) : (
                  <span className="text-zinc-500">Laatste aanpassing onbekend</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.seo ? (
                  s.seo.map((p) => (
                    <span key={p.naam} className={p.ok ? "chip goed" : "chip let"}>
                      {p.ok ? "✓" : "✗"} {p.naam}
                    </span>
                  ))
                ) : (
                  <span className="chip">SEO nog niet gemeten</span>
                )}
              </div>
              <div className="voet">
                {s.bezoekers30 == null ? (
                  <span className="text-zinc-600">{s.live ? "nog geen meting" : "meting nog niet live"}</span>
                ) : (
                  <span className="flex items-baseline gap-3 text-zinc-600">
                    <span>
                      <b className="font-medium tabular-nums text-zinc-900">{num(s.bezoekers30)}</b> bezoekers
                    </span>
                    <span>
                      <b className="font-medium tabular-nums text-zinc-900">{num(s.contact30 || 0)}</b> contact
                    </span>
                    <span className="text-[11px] text-zinc-400">30 d</span>
                  </span>
                )}
                <Link href={websitesLink(a, s.sleutel)} className="font-medium underline">
                  Analyse
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-zinc-500">
          SEO = de basis uit de laatste crawl: titel, metabeschrijving, gestructureerde data, LocalBusiness, sitemap en of er pagina&apos;s over
          deze dienst zijn. De diepere SEO-analyse staat onder SEO / SEA.
        </p>
      </section>

      <section className="paneel mt-4">
        <div className="kop">
          <h2>Google Ads</h2>
          <Link href={seoLink(a)} className="text-[12px] font-medium underline">
            Prestaties in SEO / SEA
          </Link>
        </div>
        {a.kanalen.ads.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Voor deze dienst is geen advertentiedienst ingesteld in config/afdelingen.json.</p>
        ) : ads.length === 0 ? (
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
                  <th className="num">Laatste uitgave</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((c) => (
                  <tr key={c.account + c.id}>
                    <td>
                      <Link href={seoLink(a)} className="font-medium hover:underline">
                        {c.naam}
                      </Link>
                      <div className="text-[11.5px] text-zinc-500">{c.account}</div>
                    </td>
                    <td>
                      <span className={c.status === "ENABLED" ? "chip goed" : "chip"}>{c.status === "ENABLED" ? "Actief" : "Gepauzeerd"}</span>
                    </td>
                    <td className="num">{euro(c.kost)}</td>
                    <td className="num">{num(c.klikken)}</td>
                    <td className="num">{num(c.conversies)}</td>
                    <td className="num">{c.laatsteDag ? datumNl(c.laatsteDag) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
