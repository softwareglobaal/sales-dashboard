import Link from "next/link";
import { headers } from "next/headers";
import { DienstKop } from "@/components/dienst/DienstKop";
import { afdeling } from "@/lib/afdelingen";
import { magBisson } from "@/lib/toegang";
import { architectenOverzicht, dealsOpBissonWerven, maandJaar, SIGNAAL, type Architect, type BissonProject } from "@/lib/architecten";
import { euro, num } from "@/lib/format";
import { BissonLijst } from "./BissonLijst";

// Engineering → Studiebureau Bisson (spec §18). Twee vragen:
// 1. Hoeveel projecten doet TKN-Buro voor Bisson, en hoe verhoudt zich dat tot het eigen werk?
// 2. Werken onze architect-klanten intussen via Bisson?
// Enkel voor de directie (magBisson); de subtab is voor anderen onzichtbaar.

export const dynamic = "force-dynamic";

const ERNST: Record<string, number> = { eigen: 0, "eerst-bij-ons": 1, beide: 2, prospect: 3, "enkel-bisson": 4 };

function schatting(p: BissonProject, prijzen: Record<string, { mediaan: number; n: number }>): number | null {
  if (!p.dienst) return null;
  const k = prijzen[`${p.dienst}_${p.soort}`] || prijzen[p.dienst];
  return k ? k.mediaan : null;
}

export default async function Page() {
  const h = await headers();
  const a = afdeling("engineering")!;
  if (!magBisson(h.get("x-authentik-groups"), h.get("x-authentik-username"))) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-10">
        <DienstKop a={a} tab="overzicht" sp={{}} filters={false} />
        <div className="paneel mt-4">
          <h2>Geen toegang</h2>
          <p className="mt-2 text-[13px] text-zinc-500">Dit overzicht is enkel zichtbaar voor de directie.</p>
        </div>
      </main>
    );
  }

  const stand = await architectenOverzicht();
  const kop = (
    <DienstKop
      a={a}
      tab="/engineering/bisson"
      sp={{}}
      filters={false}
      ondertitel="Projecten die TKN-Buro uitvoert voor Studiebureau Bisson · enkel zichtbaar voor de directie"
    />
  );
  if (stand.status !== "ok") {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-10">
        {kop}
        <div className="notitie let mt-4">
          {stand.status === "niet-ingesteld"
            ? "De koppeling met het facturatieplatform is niet ingesteld (FACTURATIE_URL en KOPPELING_TOKEN)."
            : `Het overzicht kon niet geladen worden: ${stand.melding}`}
        </div>
      </main>
    );
  }

  const { bisson, architecten } = stand.data;
  const projecten = bisson.projecten;
  const opBureau = new Map(architecten.map((x) => [x.id, x]));
  const werfDeals = dealsOpBissonWerven(projecten);
  const nu = new Date().getFullYear();

  const perJaar = bisson.per_jaar.map((j) => {
    const pj = projecten.filter((p) => p.jaar === j.jaar);
    const waarden = pj.map((p) => schatting(p, bisson.prijzen)).filter((x): x is number => x != null);
    return { ...j, aandeel: j.tkn_totaal ? j.bisson / j.tkn_totaal : 0, waarde: waarden.reduce((s, x) => s + x, 0) };
  });
  const totaalWaarde = perJaar.reduce((s, j) => s + j.waarde, 0);
  const totaalTkn = perJaar.reduce((s, j) => s + j.tkn_totaal, 0);
  const dit = perJaar.find((j) => j.jaar === nu);
  const vorig = perJaar.find((j) => j.jaar === nu - 1);
  const hoogsteJaar = Math.max(1, ...perJaar.map((j) => j.tkn_totaal));

  const factuurPerJaar = new Map<string, number>();
  for (const f of bisson.facturen_aan_bisson) {
    const j = (f.datum || "").slice(0, 4);
    factuurPerJaar.set(j, (factuurPerJaar.get(j) || 0) + (f.bedrag || 0));
  }
  const metFactuur = projecten.filter((p) => p.facturen.length);

  const bissonArchitecten = architecten
    .filter((x) => x.aantal_bisson > 0)
    .sort((x, y) => (ERNST[x.signaal || ""] ?? 9) - (ERNST[y.signaal || ""] ?? 9) || y.aantal_bisson - x.aantal_bisson);
  const overlap = bissonArchitecten.filter((x) => x.signaal === "eerst-bij-ons" || x.signaal === "beide" || x.signaal === "eigen");
  const prospects = bissonArchitecten.filter((x) => x.signaal === "prospect");
  const zonderArchitect = projecten.filter((p) => !p.bureau).length;

  const werven = projecten
    .map((p) => ({ p, treffers: [...(p.werf_bij_ons || []), ...(werfDeals[p.nr] || [])] }))
    .filter((x) => x.treffers.length);

  const prijsSta = bisson.prijzen["STA"];
  const lijst = projecten.map((p) => {
    const b = p.bureau ? opBureau.get(p.bureau) : undefined;
    return {
      ...p,
      bureau_naam: b?.naam || null,
      bureau_zeker: b?.zeker ?? true,
      signaal: b?.signaal || null,
      schatting: schatting(p, bisson.prijzen),
      werf_treffers: (p.werf_bij_ons?.length || 0) + (werfDeals[p.nr]?.length || 0),
    };
  });

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      {kop}

      <div className="notitie mt-4">
        Een Bisson-project is een TKN-projectmap of Monday-regel met <b>SB BISSON</b>{" "}in de naam (of kanaal &ldquo;SB Bisson&rdquo; op
        het Monday-bord). De naam zegt ook de dienst (STA = stabiliteit, DRA = tekenwerk) en voor welke architect Bisson het doet.
        Bron: facturatiecontrole, ververst {stand.data.ververst?.slice(0, 10).split("-").reverse().join("/") || "—"}.
      </div>

      {/* ---------------------------------------------------------------- kerncijfers */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="paneel kpi">
          <span className="label">Bisson-projecten</span>
          <div className="groot">{num(projecten.length)}</div>
          <div className="delta">
            sinds {perJaar[0]?.jaar} · {Math.round((projecten.length / Math.max(1, totaalTkn)) * 100)}% van alle TKN-projecten
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Dit jaar ({nu})</span>
          <div className="groot">{num(dit?.bisson || 0)}</div>
          <div className="delta">
            {dit ? `${Math.round(dit.aandeel * 100)}% van ${dit.tkn_totaal} TKN-projecten` : "nog geen"}
            {vorig ? ` · vorig jaar ${vorig.bisson} (${Math.round(vorig.aandeel * 100)}%)` : ""}
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Geschatte waarde</span>
          <div className="groot">{euro(totaalWaarde)}</div>
          <div className="delta">
            stabiliteit tegen onze eigen prijs{prijsSta ? ` (mediaan ${euro(prijsSta.mediaan)} over ${prijsSta.n} TKN-projecten)` : ""}
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Gefactureerd aan Bisson BV</span>
          <div className="groot">{euro(bisson.facturen_aan_bisson_totaal)}</div>
          <div className="delta">{bisson.facturen_aan_bisson.length} boekingen, excl. btw, vooral tekenwerk per maand</div>
        </div>
        <div className="paneel kpi">
          <span className="label">Onze klanten via Bisson</span>
          <div className="groot">{overlap.filter((x) => !x.eigen).length}</div>
          <div className="delta">
            {overlap.filter((x) => x.signaal === "eerst-bij-ons").length} eerst bij ons · {prospects.length} uit onze B2B-lijst
            {overlap.some((x) => x.eigen) ? " · plus H-Architects zelf" : ""}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- per jaar */}
      <section className="paneel mt-4">
        <div className="kop">
          <h2>Per jaar: Bisson tegenover het eigen TKN-werk</h2>
          <small>noemer = alle TKN-projectnummers van dat jaar (Dropbox, Monday, facturen)</small>
        </div>
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Jaar</th>
                <th style={{ width: "34%" }}>Verdeling</th>
                <th className="num">TKN-projecten</th>
                <th className="num">Via Bisson</th>
                <th className="num">Eigen</th>
                <th className="num">Aandeel</th>
                <th className="num">STA</th>
                <th className="num">DRA</th>
                <th className="num">Geschatte waarde</th>
                <th className="num">Gefactureerd aan Bisson</th>
              </tr>
            </thead>
            <tbody>
              {perJaar.map((j) => (
                <tr key={j.jaar}>
                  <td className="font-medium">{j.jaar}{j.jaar === nu ? " (lopend)" : ""}</td>
                  <td>
                    <div className="flex h-3 overflow-hidden rounded-full" style={{ width: `${(j.tkn_totaal / hoogsteJaar) * 100}%`, background: "var(--vlak)" }}>
                      <span style={{ width: `${j.aandeel * 100}%`, background: "var(--kritiek)" }} title={`Bisson: ${j.bisson}`} />
                      <span style={{ flex: 1, background: "var(--inkt-vaag)", opacity: 0.35 }} title={`Eigen: ${j.eigen}`} />
                    </div>
                  </td>
                  <td className="num">{j.tkn_totaal}</td>
                  <td className="num font-medium">{j.bisson}</td>
                  <td className="num">{j.eigen}</td>
                  <td className="num">
                    <span className={"chip " + (j.aandeel >= 0.66 ? "kritiek" : j.aandeel >= 0.4 ? "let" : "")}>{Math.round(j.aandeel * 100)}%</span>
                  </td>
                  <td className="num">{j.sta}</td>
                  <td className="num">{j.dra}</td>
                  <td className="num">{j.waarde ? euro(j.waarde) : "—"}</td>
                  <td className="num">{factuurPerJaar.get(String(j.jaar)) ? euro(factuurPerJaar.get(String(j.jaar))!) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">
          Rood = via Bisson, grijs = eigen TKN-werk. De geschatte waarde rekent elk stabiliteitsproject aan de mediaanprijs die TKN
          zelf vraagt (nieuwbouw en renovatie apart waar er genoeg eigen projecten zijn); voor tekenwerk is er geen eigen prijsbasis.
          Tekenwerk voor Bisson staat sinds 2025 bijna niet meer als eigen projectmap; het wordt per maand aan Bisson BV gefactureerd.
        </p>
      </section>

      {/* ---------------------------------------------------------------- overlap */}
      <section className="paneel mt-4" id="overlap">
        <div className="kop">
          <h2>Onze klanten die via Bisson werken</h2>
          <small>klant = minstens één gewonnen deal, factuur of eigen TKN-project bij een van onze firma&apos;s</small>
        </div>
        {overlap.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Geen overlap gevonden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Bureau</th>
                  <th>Signaal</th>
                  <th>Bij ons</th>
                  <th className="num">Projecten</th>
                  <th>Periode bij ons</th>
                  <th className="num">Via Bisson</th>
                  <th>Periode Bisson</th>
                  <th className="num">Bij ons na 1e Bisson</th>
                </tr>
              </thead>
              <tbody>
                {overlap.map((x) => (
                  <OverlapRij key={x.id} x={x} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-zinc-500">
          &ldquo;Eerst bij ons, nu via Bisson&rdquo; = het eerste project bij een van onze firma&apos;s ligt vóór het eerste
          Bisson-project. &ldquo;Bij ons na 1e Bisson&rdquo; = hoeveel projecten we daarna nog zelf voor dit bureau deden.
        </p>
      </section>

      {/* ---------------------------------------------------------------- architecten achter Bisson */}
      <section className="paneel mt-4">
        <div className="kop">
          <h2>Voor wie doet Bisson het werk?</h2>
          <small>
            {bissonArchitecten.length} bureaus · {zonderArchitect} projecten zonder architect in de naam
          </small>
        </div>
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Bureau</th>
                <th>Code in de map</th>
                <th>Status bij ons</th>
                <th className="num">Bisson-projecten</th>
                <th>Eerste – laatste</th>
              </tr>
            </thead>
            <tbody>
              {bissonArchitecten.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="font-medium">{x.naam}</span>
                    {x.plaats && <span className="text-zinc-500"> · {x.plaats}</span>}
                    {!x.zeker && <span className="chip ml-2" title="De code is niet eenduidig aan één bureau te hangen">te bevestigen</span>}
                  </td>
                  <td className="text-[12px] text-zinc-500">{x.codes.join(", ")}</td>
                  <td>
                    {x.signaal && <span className={"chip " + SIGNAAL[x.signaal].klasse} title={SIGNAAL[x.signaal].uitleg}>{SIGNAAL[x.signaal].label}</span>}
                  </td>
                  <td className="num font-medium">{x.aantal_bisson}</td>
                  <td>{maandJaar(x.eerste_bisson)} – {maandJaar(x.laatste_bisson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- werven en facturen */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="paneel">
          <div className="kop">
            <h2>Bisson-werven die ook bij ons staan</h2>
            <small>zelfde adres in Pipedrive (elke status) of in de boekhouding</small>
          </div>
          {werven.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Geen enkel Bisson-adres komt terug in onze deals of facturen.</p>
          ) : (
            <ul className="space-y-3 text-[13px]">
              {werven.map(({ p, treffers }) => (
                <li key={p.nr}>
                  <div className="font-medium">
                    {p.nr} · {p.adres}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[12.5px] text-zinc-600">
                    {treffers.map((t, i) => (
                      <li key={i}>
                        {t.bron} {t.firma}
                        {t.status && <span className={"chip ml-1 " + (t.status === "verloren" ? "kritiek" : t.status === "gewonnen" ? "goed" : "")}>{t.status}</span>}
                        {" · "}
                        {t.link ? (
                          <a href={t.link} target="_blank" rel="noopener" className="underline">
                            {t.tekst}
                          </a>
                        ) : (
                          t.tekst
                        )}
                        {t.klant ? ` · ${t.klant}` : ""} {t.datum ? `· ${maandJaar(t.datum)}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="paneel">
          <div className="kop">
            <h2>Facturen</h2>
            <small>excl. btw · creditnota&apos;s en correcties tellen negatief</small>
          </div>
          <span className="label">Op een Bisson-projectnummer, aan een ander dan Bisson</span>
          {metFactuur.length === 0 ? (
            <p className="mt-1 text-[13px] text-zinc-500">Geen.</p>
          ) : (
            <ul className="mt-1 mb-4 space-y-1 text-[12.5px]">
              {metFactuur.map((p) => (
                <li key={p.nr}>
                  <b>{p.nr}</b> {p.adres ? `· ${p.adres}` : ""} →{" "}
                  {p.facturen.map((f) => `${f.klant || "?"} ${euro(f.bedrag || 0)} (${f.nr})`).join(", ")}
                </li>
              ))}
            </ul>
          )}
          <span className="label">Aan Studieburo Bisson BV</span>
          <div className="mt-1 max-h-72 overflow-y-auto">
            <table className="tabel">
              <tbody>
                {bisson.facturen_aan_bisson.map((f) => (
                  <tr key={f.dossier + f.nr}>
                    <td className="whitespace-nowrap">{f.datum?.split("-").reverse().join("/")}</td>
                    <td className="text-[12px] text-zinc-500">{f.dossier} {f.nr}</td>
                    <td className="text-[12.5px]">{f.omschrijving || "—"}</td>
                    <td className="num">{euro(f.bedrag || 0)}</td>
                  </tr>
                ))}
                <tr className="totaal">
                  <td colSpan={3}>Totaal</td>
                  <td className="num">{euro(bisson.facturen_aan_bisson_totaal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- alle projecten */}
      <section className="paneel mt-4" id="projecten">
        <div className="kop">
          <h2>Alle Bisson-projecten</h2>
          <small>
            klik een adres voor de Dropbox-map · <Link href="/architecten" className="underline">architecten-klanten</Link>
          </small>
        </div>
        <BissonLijst projecten={lijst} />
      </section>
    </main>
  );
}

function OverlapRij({ x }: { x: Architect }) {
  const s = x.signaal ? SIGNAAL[x.signaal] : null;
  return (
    <tr>
      <td>
        <Link href={`/architecten#${x.id}`} className="font-medium underline-offset-2 hover:underline">
          {x.naam}
        </Link>
        {!x.zeker && <span className="chip ml-2">te bevestigen</span>}
      </td>
      <td>{s && <span className={"chip " + s.klasse} title={s.uitleg}>{s.label}</span>}</td>
      <td className="text-[12.5px]">
        {x.firmas.join(", ")}
        <div className="text-zinc-500">{x.diensten.join(", ")}</div>
      </td>
      <td className="num">{x.aantal_projecten}</td>
      <td>{maandJaar(x.eerste_bij_ons)} – {maandJaar(x.laatste_bij_ons)}</td>
      <td className="num font-medium">{x.aantal_bisson}</td>
      <td>{maandJaar(x.eerste_bisson)} – {maandJaar(x.laatste_bisson)}</td>
      <td className="num">{x.bij_ons_na_eerste_bisson ?? "—"}</td>
    </tr>
  );
}
