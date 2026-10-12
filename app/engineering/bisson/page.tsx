import { headers } from "next/headers";
import { DienstKop } from "@/components/dienst/DienstKop";
import { afdeling } from "@/lib/afdelingen";
import { magBisson } from "@/lib/toegang";
import { architectenOverzicht, dealsOpBissonWerven, maandJaar, type BissonProject } from "@/lib/architecten";
import { euro, num } from "@/lib/format";
import { BissonLijst } from "./BissonLijst";
import { BureauTabel } from "./BureauTabel";

// Engineering → Studiebureau Bisson (spec §18). Twee vragen:
// 1. Hoeveel projecten doet TKN-Buro voor Bisson, en hoe verhoudt zich dat tot het eigen werk?
// 2. Werken onze architect-klanten intussen via Bisson?
// Alles is doorklikbaar: een bureau toont elk project (dienst, firma, deal, factuur, map),
// een jaar filtert de projectlijst, een factuur opent de PDF.
// Enkel voor de directie (magBisson); de subtab is voor anderen onzichtbaar.

export const dynamic = "force-dynamic";

const ERNST: Record<string, number> = { eigen: 0, "eerst-bij-ons": 1, beide: 2, prospect: 3, "enkel-bisson": 4 };

function schatting(p: BissonProject, prijzen: Record<string, { mediaan: number; n: number }>): number | null {
  if (!p.dienst) return null;
  const k = prijzen[`${p.dienst}_${p.soort}`] || prijzen[p.dienst];
  return k ? k.mediaan : null;
}

function dag(d: string | null | undefined) {
  return d ? d.slice(0, 10).split("-").reverse().join("/") : "—";
}

function KpiLink({ naar, label, waarde, sub, toon }: { naar: string; label: string; waarde: string; sub: React.ReactNode; toon?: string }) {
  return (
    <a href={naar} className={"paneel kpi block " + (toon || "")} style={{ textDecoration: "none", color: "inherit" }}>
      <span className="label">{label} ↓</span>
      <div className="groot">{waarde}</div>
      <div className="delta">{sub}</div>
    </a>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ jaar?: string }> }) {
  const h = await headers();
  const sp = await searchParams;
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

  const perBureau: Record<string, BissonProject[]> = {};
  for (const p of projecten) if (p.bureau) (perBureau[p.bureau] ||= []).push(p);

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

  // Facturen aan Bisson: wat, wanneer, en hoeveel Bisson-projecten er sindsdien bijkwamen.
  const fb = bisson.facturen_aan_bisson;
  const factuurPerJaar = new Map<string, number>();
  for (const f of fb) {
    const j = (f.datum || "").slice(0, 4);
    factuurPerJaar.set(j, (factuurPerJaar.get(j) || 0) + (f.bedrag || 0));
  }
  const laatsteFactuur = fb.length ? fb[fb.length - 1].datum : null;
  // Na de laatste factuur gestart: startdatum op Monday erna, of (zonder startdatum) een
  // projectnummer van een later jaar.
  const naLaatste = laatsteFactuur
    ? projecten.filter((p) =>
        p.datum.endsWith("-01-01") ? p.jaar > Number(laatsteFactuur.slice(0, 4)) : p.datum.slice(0, 10) > laatsteFactuur,
      ).length
    : 0;
  const staFactuur = projecten.filter((p) => p.dienst === "STA").length;
  const metFactuur = projecten.filter((p) => p.facturen.length);

  const bissonArchitecten = architecten
    .filter((x) => x.aantal_bisson > 0)
    .sort((x, y) => (ERNST[x.signaal || ""] ?? 9) - (ERNST[y.signaal || ""] ?? 9) || y.aantal_bisson - x.aantal_bisson);
  const overlap = bissonArchitecten.filter((x) => x.signaal === "eerst-bij-ons" || x.signaal === "beide" || x.signaal === "eigen");
  const prospects = bissonArchitecten.filter((x) => x.signaal === "prospect");
  const zonderOpdrachtgever = projecten.filter((p) => !p.opdrachtgever);
  const ingenieurs = projecten.filter((p) => p.ingenieur);

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
        Alles hieronder is aanklikbaar. Bron: facturatiecontrole, ververst{" "}
        {stand.data.ververst?.slice(0, 10).split("-").reverse().join("/") || "—"}.
      </div>

      {/* ---------------------------------------------------------------- kerncijfers */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiLink
          naar="#projecten"
          label="Bisson-projecten"
          waarde={num(projecten.length)}
          sub={`sinds ${perJaar[0]?.jaar} · ${Math.round((projecten.length / Math.max(1, totaalTkn)) * 100)}% van alle TKN-projecten`}
        />
        <KpiLink
          naar={`?jaar=${nu}#projecten`}
          label={`Dit jaar (${nu})`}
          waarde={num(dit?.bisson || 0)}
          sub={
            (dit ? `${Math.round(dit.aandeel * 100)}% van ${dit.tkn_totaal} TKN-projecten` : "nog geen") +
            (vorig ? ` · vorig jaar ${vorig.bisson} (${Math.round(vorig.aandeel * 100)}%)` : "")
          }
        />
        <KpiLink
          naar="#per-jaar"
          label="Geschatte waarde"
          waarde={euro(totaalWaarde)}
          sub={`stabiliteit tegen onze eigen prijs${prijsSta ? ` (mediaan ${euro(prijsSta.mediaan)} over ${prijsSta.n} TKN-projecten)` : ""}`}
        />
        <KpiLink
          naar="#facturen"
          label="Gefactureerd aan Bisson BV"
          waarde={euro(bisson.facturen_aan_bisson_totaal)}
          sub={
            <>
              vooral tekenwerk per maand · laatste factuur <b>{dag(laatsteFactuur)}</b>
            </>
          }
        />
        <KpiLink
          naar="#overlap"
          label="Onze klanten via Bisson"
          waarde={String(overlap.filter((x) => !x.eigen).length)}
          sub={
            `${overlap.filter((x) => x.signaal === "eerst-bij-ons").length} eerst bij ons · ${prospects.length} uit onze B2B-lijst` +
            (overlap.some((x) => x.eigen) ? " · plus H-Architects zelf" : "")
          }
        />
      </section>

      {/* ---------------------------------------------------------------- wat er gefactureerd wordt */}
      <section className="notitie kritiek mt-4" style={{ fontSize: 13 }}>
        <b>Wat TKN aan Bisson aanrekent:</b> vooral tekenwerk, als één bedrag per maand ({fb.length} boekingen,{" "}
        {euro(bisson.facturen_aan_bisson_totaal)} excl. btw sinds {dag(fb[0]?.datum)}). Geen van de {staFactuur}{" "}
        stabiliteitsprojecten staat met zijn nummer op een factuur. De laatste factuur aan Bisson is van{" "}
        <b>{dag(laatsteFactuur)}</b>: sindsdien is er niets meer aangerekend, ook geen tekenwerk, terwijl er in die periode{" "}
        <b>{naLaatste} Bisson-projecten</b> startten.{" "}
        <a href="#facturen" className="underline">
          Bekijk de facturen
        </a>
      </section>

      {/* ---------------------------------------------------------------- per jaar */}
      <section className="paneel mt-4 scroll-mt-32" id="per-jaar">
        <div className="kop">
          <h2>Per jaar: Bisson tegenover het eigen TKN-werk</h2>
          <small>klik een jaar voor de projecten · noemer = alle TKN-projectnummers van dat jaar</small>
        </div>
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Jaar</th>
                <th style={{ width: "30%" }}>Verdeling</th>
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
                  <td className="font-medium">
                    <a href={`?jaar=${j.jaar}#projecten`} className="underline decoration-dotted underline-offset-4">
                      {j.jaar}
                      {j.jaar === nu ? " (lopend)" : ""}
                    </a>
                  </td>
                  <td>
                    <div className="flex h-3 overflow-hidden rounded-full" style={{ width: `${(j.tkn_totaal / hoogsteJaar) * 100}%`, background: "var(--vlak)" }}>
                      <span style={{ width: `${j.aandeel * 100}%`, background: "var(--kritiek)" }} title={`Bisson: ${j.bisson}`} />
                      <span style={{ flex: 1, background: "var(--inkt-vaag)", opacity: 0.35 }} title={`Eigen: ${j.eigen}`} />
                    </div>
                  </td>
                  <td className="num">{j.tkn_totaal}</td>
                  <td className="num font-medium">
                    <a href={`?jaar=${j.jaar}#projecten`} className="underline decoration-dotted underline-offset-4">
                      {j.bisson}
                    </a>
                  </td>
                  <td className="num">{j.eigen}</td>
                  <td className="num">
                    <span className={"chip " + (j.aandeel >= 0.66 ? "kritiek" : j.aandeel >= 0.4 ? "let" : "")}>{Math.round(j.aandeel * 100)}%</span>
                  </td>
                  <td className="num">{j.sta}</td>
                  <td className="num">{j.dra}</td>
                  <td className="num">{j.waarde ? euro(j.waarde) : "—"}</td>
                  <td className="num">
                    {factuurPerJaar.get(String(j.jaar)) ? (
                      <a href="#facturen" className="underline decoration-dotted underline-offset-4">
                        {euro(factuurPerJaar.get(String(j.jaar))!)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">
          Rood = via Bisson, grijs = eigen TKN-werk. De geschatte waarde rekent elk stabiliteitsproject aan de mediaanprijs die TKN
          zelf vraagt (nieuwbouw en renovatie apart waar er genoeg eigen projecten zijn); voor tekenwerk is er geen eigen prijsbasis.
        </p>
      </section>

      {/* ---------------------------------------------------------------- overlap */}
      <section className="paneel mt-4 scroll-mt-32" id="overlap">
        <div className="kop">
          <h2>Onze klanten die via Bisson werken</h2>
          <small>klik een bureau: elk project bij ons (dienst, firma, deal, factuur) naast elk Bisson-project</small>
        </div>
        {overlap.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Geen overlap gevonden.</p>
        ) : (
          <BureauTabel bureaus={overlap} bisson={perBureau} metOns anker="klant" />
        )}
        <p className="mt-3 text-[12px] text-zinc-500">
          Klant = minstens één gewonnen deal, factuur of eigen TKN-project bij een van onze firma&apos;s. &ldquo;Eerst bij ons, nu via
          Bisson&rdquo; = het eerste project bij ons ligt vóór het eerste Bisson-project.
        </p>
      </section>

      {/* ---------------------------------------------------------------- architecten achter Bisson */}
      <section className="paneel mt-4 scroll-mt-32" id="bureaus">
        <div className="kop">
          <h2>Voor wie doet Bisson het werk?</h2>
          <small>
            {bissonArchitecten.length} bureaus · klik voor de projecten
            {ingenieurs.length ? ` · ${ingenieurs.length} projecten in onderaanneming van een ingenieur` : ""}
          </small>
        </div>
        <BureauTabel bureaus={bissonArchitecten} bisson={perBureau} metOns={false} />
        {zonderOpdrachtgever.length > 0 && (
          <div className="notitie let mt-3">
            <b>{zonderOpdrachtgever.length} projecten zonder architect of ingenieur.</b> De naam staat niet in de Dropbox-map en niet in
            de kolom &ldquo;architect&rdquo; op het Monday-bord TKN-Buro projects. Vul die kolom in en het platform neemt het de volgende
            nacht over:{" "}
            {zonderOpdrachtgever.map((p, i) => (
              <span key={p.nr}>
                {i > 0 && ", "}
                {p.monday?.link ? (
                  <a href={p.monday.link} target="_blank" rel="noopener" className="underline">
                    {p.nr}
                  </a>
                ) : (
                  p.nr
                )}{" "}
                ({p.adres})
              </span>
            ))}
            .
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- werven en facturen */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="paneel">
          <div className="kop">
            <h2>Bisson-werven die ook bij ons staan</h2>
            <small>zelfde adres in Pipedrive (elke status) of in de boekhouding</small>
          </div>
          {werven.length === 0 ? (
            <p className="text-[13px] text-zinc-500">
              Geen enkel Bisson-adres komt terug in onze deals of facturen: er is geen offerte van ons die daarna via Bisson ging.
            </p>
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
        <div className="paneel scroll-mt-32" id="facturen">
          <div className="kop">
            <h2>Facturen</h2>
            <small>excl. btw · klik voor de PDF · creditnota&apos;s en correcties tellen negatief</small>
          </div>
          <span className="label">Op een Bisson-projectnummer, aan een ander dan Bisson</span>
          {metFactuur.length === 0 ? (
            <p className="mt-1 text-[13px] text-zinc-500">Geen.</p>
          ) : (
            <ul className="mt-1 mb-4 space-y-1 text-[12.5px]">
              {metFactuur.map((p) => (
                <li key={p.nr}>
                  <b>{p.nr}</b> {p.adres ? `· ${p.adres}` : ""} →{" "}
                  {p.facturen.map((f, i) => (
                    <span key={f.nr}>
                      {i > 0 && ", "}
                      {f.klant || "?"} {euro(f.bedrag || 0)}{" "}
                      {f.pdf ? (
                        <a href={f.pdf} target="_blank" rel="noopener" className="underline">
                          ({f.nr}) ↗
                        </a>
                      ) : (
                        `(${f.nr})`
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          <span className="label">Aan Studieburo Bisson BV</span>
          <div className="mt-1 max-h-80 overflow-y-auto">
            <table className="tabel">
              <tbody>
                {fb.map((f) => (
                  <tr key={f.dossier + f.nr}>
                    <td className="whitespace-nowrap">{dag(f.datum)}</td>
                    <td className="text-[12px]">
                      {f.pdf ? (
                        <a href={f.pdf} target="_blank" rel="noopener" className="chip accent" style={{ textDecoration: "none" }}>
                          {f.dossier} {f.nr} ↗
                        </a>
                      ) : (
                        <span className="text-zinc-500" title="Geen PDF gevonden in de boekhoudmap">
                          {f.dossier} {f.nr}
                        </span>
                      )}
                    </td>
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
      <section className="paneel mt-4 scroll-mt-32" id="projecten">
        <div className="kop">
          <h2>Alle Bisson-projecten</h2>
          <small>
            klik een architect voor al zijn projecten · klik map of Monday om te openen ·{" "}
            <a href="/architecten" className="underline">
              architecten-klanten
            </a>
          </small>
        </div>
        <BissonLijst projecten={lijst} beginJaar={sp.jaar || ""} />
      </section>
    </main>
  );
}
