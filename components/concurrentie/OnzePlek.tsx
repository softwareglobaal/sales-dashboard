import type { ConcurrentRij, EigenGsc, Markt } from "@/lib/concurrentieQueries";
import { rolVan, type PlekRegel, type ZoekSamenvatting } from "@/lib/onzePlek";

// Zoals .kaartrooster, maar de kaartjes rekken uit tot de volle breedte (auto-fit):
// twee eigen sites staan dan niet verloren in een rooster van vijf kolommen. min()
// houdt het op een gsm van 375 px binnen het paneel.
const ROOSTER = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" };

const n = (x: number) => new Intl.NumberFormat("nl-BE").format(x || 0);
const datumNl = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

/**
 * "Onze plek": een klein paneel bovenaan elke concurrentiepagina. Per eigen site
 * één kaartje met de plek in elke ranglijst van de pagina en de zoekposities.
 * De regels zelf rekent de pagina uit (lib/onzePlek.ts), want alleen de pagina
 * weet welke ranglijsten ze toont en met welke sortering.
 */
export function OnzePlek({
  markt,
  sites,
  regels,
  zoek,
  positieDatum,
  gsc,
  gscOpgehaald,
  proef = [],
}: {
  markt: Markt;
  sites: ConcurrentRij[];
  regels: Record<string, PlekRegel[]>;
  zoek: Record<string, ZoekSamenvatting>;
  positieDatum: string | null;
  gsc: EigenGsc[];
  gscOpgehaald: boolean;
  proef?: string[];
}) {
  return (
    <section className="paneel mb-4" aria-label="Onze plek">
      <div className="kop">
        <h2 style={{ fontSize: 18 }}>Onze plek</h2>
        <small>
          {sites.length} eigen {sites.length === 1 ? "site" : "sites"} · plaats in elke ranglijst op deze pagina
        </small>
      </div>
      <div className="kaartrooster" style={ROOSTER}>
        {sites.map((s) => {
          const z = zoek[s.domein];
          const g = gsc.find((x) => x.domein === s.domein);
          const isProef = proef.includes(s.domein);
          return (
            <div key={s.domein} className="kaart min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <a href={`https://${s.domein}`} target="_blank" rel="noreferrer noopener"
                   className="n min-w-0 truncate hover:underline">{s.domein}</a>
                <span className="chip">{rolVan(markt, s.domein)}</span>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-snug">
                {(regels[s.domein] || []).map((r) => (
                  <Regel key={r.lijst} kleur={r.status === "in" ? "g" : r.status === "uit" && r.google ? "l" : ""}
                         label={r.lijst}>
                    <span className={r.status === "onbekend" ? "text-zinc-500" : ""}>{r.tekst}</span>
                  </Regel>
                ))}
                <Regel kleur={z && z.top3 > 0 ? "g" : ""}
                       label={`Google-meting${positieDatum ? ` ${datumNl(positieDatum)}` : ""}${z && z.gemeten ? ` (${n(z.gemeten)} ${z.gemeten === 1 ? "term" : "termen"})` : ""}`}>
                  {isProef ? (
                    <span className="text-zinc-500">proefomgeving: hoort niet in Google</span>
                  ) : !z || !z.gemeten ? (
                    <span className="text-zinc-500">nog geen meting voor deze markt</span>
                  ) : z.top10 === 0 ? (
                    <>geen enkele term in de top 10</>
                  ) : (
                    <>
                      <b className="font-medium">{n(z.top3)}</b>× top 3 · <b className="font-medium">{n(z.top10)}</b>× top 10
                      {z.beste && <> · beste #{z.beste.positie} op &lsquo;{z.beste.term}&rsquo;</>}
                    </>
                  )}
                </Regel>
                {!isProef && (
                  <Regel kleur={g && g.top3 > 0 ? "g" : ""} label="Search Console (28 dagen)">
                    {g ? (
                      <>
                        <b className="font-medium">{n(g.top3)}</b>× top 3 · <b className="font-medium">{n(g.top10)}</b>× top 10
                        {" "}van {n(g.termen)} termen
                        {g.beste && <> · beste #{g.beste.positie.toFixed(1).replace(".", ",")} op &lsquo;{g.beste.term}&rsquo;</>}
                      </>
                    ) : (
                      <span className="text-zinc-500">
                        {gscOpgehaald ? "geen property in Search Console" : "nog niet opgehaald"}
                      </span>
                    )}
                  </Regel>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] text-zinc-500">
        De ranglijsten tonen alleen concurrenten. &ldquo;Zou #14 zijn&rdquo; is de plek met dezelfde
        sortering als die lijst, met de site erbij geteld (gelijke stand deelt de plek). In het
        Google-leaderboard staat een eigen site wél zodra hij hoog genoeg rankt. Beste term in Search
        Console: laagste gemiddelde positie bij minstens tien vertoningen.
      </p>
    </section>
  );
}

/** Eén regel: een stip (groen = staat erin, oranje = werkpunt in Google), de lijst en de plek. */
function Regel({ kleur, label, children }: { kleur: "g" | "l" | ""; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className={"rot mt-[5px] shrink-0 " + kleur} style={{ width: 7, height: 7 }} />
      <div className="min-w-0 text-zinc-800">
        <span className="text-zinc-500">{label}: </span>
        {children}
      </div>
    </li>
  );
}
