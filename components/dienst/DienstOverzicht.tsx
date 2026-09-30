import Link from "next/link";
import {
  bereik,
  dataset,
  filterFirma,
  firma as firmaVan,
  firmasVan,
  groei,
  isDienstPeriode,
  kpis,
  maanddoel,
  openNu,
  perDienst,
  perFirma,
  perMaand,
  recentGewonnen,
  verliesredenen,
  type Afdeling,
} from "@/lib/afdelingen";
import { campagnes, websites, websitesLink, seoLink } from "@/lib/kanalen";
import { koppeling, standVoor, FACTURATIE_WEB, WACHTTIJD_DAGEN } from "@/lib/facturatie";
import { MONTH_NAMES } from "@/lib/queries";
import { euro, num } from "@/lib/format";
import { DienstKop, dienstHref, type DienstZoek } from "./DienstKop";
import { JaarGrafiek } from "./JaarGrafiek";
import { SyncFreshness } from "@/components/SyncFreshness";

// Overzicht van één dienst (spec §17). Bewust kort: wat is er binnengekomen en
// verkocht, hoe verhoudt het zich tot vorig jaar en het doel, klopt de facturatie,
// en via welke kanalen. De diepere analyse zit onder Kanalen en Analyse.

function Delta({ nu, vorig, label }: { nu: number; vorig: number | null; label?: string }) {
  if (vorig == null) return null;
  const g = groei(nu, vorig);
  if (g == null) return <div className="delta">{label ? `${label}: ` : ""}vorig jaar {num(vorig)}</div>;
  return (
    <div className={"delta " + (g > 0 ? "goed" : g < 0 ? "kritiek" : "")}>
      {g > 0 ? "▲" : g < 0 ? "▼" : "="} {Math.abs(g)}% t.o.v. {label || "vorig jaar"}
    </div>
  );
}

function Kaart({ label, waarde, children }: { label: string; waarde: string; children?: React.ReactNode }) {
  return (
    <div className="paneel kpi">
      <span className="label">{label}</span>
      <div className="groot">{waarde}</div>
      {children}
    </div>
  );
}

const dagenGeleden = (d: string) => Math.round((Date.now() - Date.parse(d)) / 86400000);
const datumNl = (d: string) => d.split("-").reverse().join("/");

export async function DienstOverzicht({ a, sp }: { a: Afdeling; sp: DienstZoek }) {
  const periode = isDienstPeriode(sp.periode) ? sp.periode : "ytd";
  const f = sp.firma && firmasVan(a).some((x) => x.sleutel === sp.firma) ? sp.firma : undefined;
  const zoek = { periode, firma: f };
  const b = bereik(periode);
  const alles = dataset(a);
  const d = filterFirma(alles, f);
  const k = kpis(d, b.van, b.tot);
  const v = b.vergelijk ? kpis(d, b.vergelijk.van, b.vergelijk.tot) : null;
  const vl = b.vergelijk?.label;

  const jaar = periode === "prev_year" ? new Date().getFullYear() - 1 : +(/^\d{4}/.exec(b.van)?.[0] || new Date().getFullYear());
  const nuJaar = new Date().getFullYear();
  const reeksNu = perMaand(d, nuJaar);
  const reeksVorig = perMaand(d, nuJaar - 1);
  const huidigeMaand = new Date().getMonth();
  const grafiek = reeksNu.map((r, i) => ({
    maand: MONTH_NAMES[i].slice(0, 3),
    nu: i <= huidigeMaand ? { omzet: r.omzet, aanvragen: r.aanvragen, gewonnen: r.gewonnen } : null,
    vorig: { omzet: reeksVorig[i].omzet, aanvragen: reeksVorig[i].aanvragen, gewonnen: reeksVorig[i].gewonnen },
  }));

  // Doel: altijd per maand. Dit jaar = lopende maand + optelsom sinds januari.
  const doel = maanddoel(a);
  const doelMaand = /^\d{4}-\d{2}$/.test(periode) ? +periode.slice(5, 7) - 1 : huidigeMaand;
  const doelJaar = /^\d{4}-\d{2}$/.test(periode) ? +periode.slice(0, 4) : nuJaar;
  const omzetDoelMaand = (doelJaar === nuJaar ? reeksNu : reeksVorig)[doelMaand]?.omzet || 0;
  const omzetSindsJan = reeksNu.slice(0, huidigeMaand + 1).reduce((s, r) => s + r.omzet, 0);

  const firmaRijen = firmasVan(a).length > 1 && !f ? perFirma(a, alles, b.van, b.tot) : [];
  const diensten = perDienst(d, b.van, b.tot).slice(0, 8);
  const open = openNu(d);
  const verlies = verliesredenen(d, b.van, b.tot).slice(0, 5);
  const verliesTotaal = verliesredenen(d, b.van, b.tot).reduce((s, r) => s + r.aantal, 0);
  const recent = recentGewonnen(d, b.van, b.tot, 6);

  const [sites, kop] = await Promise.all([websites(a), koppeling()]);
  const ads = campagnes(a);
  const actieveAds = ads.filter((c) => c.status === "ENABLED");
  const fnaam = f ? firmaVan(f)?.naam : null;
  const fact = kop.status === "ok" && a.facturatie.length ? standVoor(kop.data, a, String(jaar)) : null;
  const gaten = fact ? fact.gaten.filter((g) => !fnaam || g.firma === fnaam) : [];

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <DienstKop a={a} tab="overzicht" sp={zoek} />
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-zinc-500">
        <span>
          {b.label}
          {b.vergelijk ? ` · vergeleken met ${b.vergelijk.label}` : ""}
          {fnaam ? ` · enkel ${fnaam}` : ""}
        </span>
        <SyncFreshness />
      </div>

      {gaten.length > 0 && (
        <div className="notitie let mb-4" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            <b className="font-medium">{gaten.length} facturatiegat{gaten.length === 1 ? "" : "en"} in {jaar}</b> tussen verkoop en
            facturatie. Het grootste: {gaten[0].werf || gaten[0].klant} ({gaten[0].soort.toLowerCase()}, {euro(Math.abs(gaten[0].verschil))}).
          </span>
          <a href="#facturatie" className="font-medium underline">
            Bekijk
          </a>
        </div>
      )}

      <section className={"grid grid-cols-2 gap-4 " + (k.offertesMeetbaar ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        <Kaart label="Aanvragen" waarde={num(k.aanvragen)}>
          <Delta nu={k.aanvragen} vorig={v?.aanvragen ?? null} label={vl} />
        </Kaart>
        {k.offertesMeetbaar && (
          <Kaart label="Offertes" waarde={num(k.offertes)}>
            <div className="delta">
              {k.aanvragen ? Math.round((k.offertes / k.aanvragen) * 100) : 0}% van de aanvragen · indicatief
            </div>
          </Kaart>
        )}
        <Kaart label="Gewonnen" waarde={num(k.gewonnen)}>
          <Delta nu={k.gewonnen} vorig={v?.gewonnen ?? null} label={vl} />
        </Kaart>
        <Kaart label="Omzet" waarde={euro(k.omzet)}>
          <Delta nu={k.omzet} vorig={v?.omzet ?? null} label={vl} />
        </Kaart>
        <Kaart label="Winratio" waarde={k.winratio == null ? "—" : `${Math.round(k.winratio * 100)}%`}>
          <div className="delta">
            {num(k.gewonnen)} gewonnen · {num(k.verloren)} verloren
            {k.gemDagen != null ? ` · gem. ${k.gemDagen} d tot gewonnen` : ""}
          </div>
        </Kaart>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="paneel">
          <div className="kop">
            <h2>Doel</h2>
            <small>gewonnen omzet per maand</small>
          </div>
          {doel > 0 ? (
            <DoelBlok
              doel={doel}
              maandLabel={`${MONTH_NAMES[doelMaand]} ${doelJaar}`}
              maandOmzet={omzetDoelMaand}
              sindsJan={periode === "ytd" ? { omzet: omzetSindsJan, doel: doel * (huidigeMaand + 1) } : null}
              gefilterd={!!f}
            />
          ) : (
            <p className="text-[13px] text-zinc-500">
              Nog geen maanddoel ingesteld. Zet het bedrag bij <code className="rounded bg-black/5 px-1">doel.maand</code> in{" "}
              <code className="rounded bg-black/5 px-1">config/afdelingen.json</code>.
            </p>
          )}
        </div>

        <div className="paneel" id="facturatie">
          <div className="kop">
            <h2>Facturatie</h2>
            <small>verkocht tegenover gefactureerd · {jaar}</small>
          </div>
          <FacturatieBlok a={a} status={kop.status} fact={fact} gaten={gaten} melding={kop.status === "fout" ? kop.melding : null} />
        </div>

        <div className="paneel">
          <div className="kop">
            <h2>Kanalen</h2>
            <Link href={dienstHref(`/${a.pad}/kanalen`, zoek)} className="text-[12px] font-medium underline">
              Alle kanalen
            </Link>
          </div>
          <div className="lijst">
            {sites.map((s) => {
              const ok = s.seo ? s.seo.filter((p) => p.ok).length : 0;
              return (
                <Link key={s.sleutel + s.paden.join()} href={websitesLink(a, s.sleutel)} className="item" style={{ textDecoration: "none" }}>
                  <div className="t">
                    <b>{s.naam}</b>
                    <small>
                      {s.aangepast ? `aangepast ${datumNl(s.aangepast)} (${dagenGeleden(s.aangepast)} d)` : "aanpassing onbekend"}
                      {" · "}
                      {s.seo ? `SEO ${ok}/${s.seo.length}` : "SEO nog niet gemeten"}
                    </small>
                  </div>
                  <span className="chip">{s.bezoekers30 == null ? "geen meting" : `${num(s.bezoekers30)} bez. 30 d`}</span>
                </Link>
              );
            })}
            {a.kanalen.ads.length > 0 && (
              <Link href={seoLink(a)} className="item" style={{ textDecoration: "none" }}>
                <div className="t">
                  <b>Google Ads</b>
                  <small>
                    {actieveAds.length
                      ? actieveAds.map((c) => c.naam).join(" · ")
                      : ads.length
                        ? "alle campagnes gepauzeerd"
                        : "nog geen campagne"}
                  </small>
                </div>
                <span className={actieveAds.length ? "chip goed" : "chip"}>
                  {actieveAds.length ? `${actieveAds.length} actief` : "niet actief"}
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="paneel mt-4">
        <div className="kop">
          <h2>Per maand</h2>
          <small>
            {nuJaar} tegenover {nuJaar - 1} · aanvragen op aanmaakdatum, gewonnen en omzet op datum gewonnen
          </small>
        </div>
        <JaarGrafiek rijen={grafiek} jaar={nuJaar} />
      </section>

      <section className={"mt-4 grid gap-4 " + (firmaRijen.length ? "lg:grid-cols-2" : "")}>
        {firmaRijen.length > 0 && (
          <div className="paneel">
            <div className="kop">
              <h2>Per firma</h2>
              <small>{b.label}</small>
            </div>
            <div className="tabelwrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Firma</th>
                    <th className="num">Aanvragen</th>
                    <th className="num">Gewonnen</th>
                    <th className="num">Omzet</th>
                  </tr>
                </thead>
                <tbody>
                  {firmaRijen.map((r) => (
                    <tr key={r.firma}>
                      <td>
                        <Link href={dienstHref("/" + a.pad, zoek, { firma: r.firma })} className="font-medium hover:underline">
                          {r.naam}
                        </Link>
                        <div className="text-[11.5px] text-zinc-500">{r.bronnen.join(" · ")}</div>
                      </td>
                      <td className="num">{num(r.aanvragen)}</td>
                      <td className="num">{num(r.gewonnen)}</td>
                      <td className="num">{euro(r.omzet)}</td>
                    </tr>
                  ))}
                  <tr className="totaal">
                    <td>Totaal</td>
                    <td className="num">{num(k.aanvragen)}</td>
                    <td className="num">{num(k.gewonnen)}</td>
                    <td className="num">{euro(k.omzet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="paneel">
          <div className="kop">
            <h2>Wat is er verkocht</h2>
            <small>omzet per product of bron · {b.label}</small>
          </div>
          {diensten.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Niets gewonnen in deze periode.</p>
          ) : (
            <div className="tabelwrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Deals</th>
                    <th className="num">Omzet</th>
                  </tr>
                </thead>
                <tbody>
                  {diensten.map((r) => (
                    <tr key={r.dienst}>
                      <td>{r.dienst}</td>
                      <td className="num">{num(r.aantal)}</td>
                      <td className="num">{euro(r.omzet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="paneel">
          <div className="kop">
            <h2>Staat nu open</h2>
            <small>los van de periode</small>
          </div>
          <div className="groot" style={{ fontSize: 36 }}>{num(open.open)}</div>
          <p className="mt-2 text-[13px] text-zinc-600">
            {num(open.metOfferte)} met offerte · {num(open.zonderOfferte)} nog zonder offerte
            {open.oudsteDagen != null ? ` · oudste ${num(open.oudsteDagen)} dagen` : ""}
          </p>
        </div>
        <div className="paneel">
          <div className="kop">
            <h2>Waarom verloren</h2>
            <small>{num(verliesTotaal)} verloren · {b.label}</small>
          </div>
          {verlies.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Geen verloren deals in deze periode.</p>
          ) : (
            <div className="lijst">
              {verlies.map((r) => (
                <div key={r.reden} className="flex items-center gap-3 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{r.reden}</span>
                  <span className="staaf" style={{ width: 80 }}>
                    <i style={{ width: `${Math.round((r.aantal / verlies[0].aantal) * 100)}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{r.aantal}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="paneel">
          <div className="kop">
            <h2>Laatst gewonnen</h2>
            <small>{b.label}</small>
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Niets gewonnen in deze periode.</p>
          ) : (
            <div className="lijst">
              {recent.map((r) => (
                <a key={r.bron + r.id} href={r.url} target="_blank" rel="noreferrer" className="item" style={{ textDecoration: "none", padding: "8px 10px" }}>
                  <div className="t">
                    <b>{r.titel}</b>
                    <small>
                      {datumNl((r.won || "").slice(0, 10))} · {r.bronLabel}
                    </small>
                  </div>
                  <span className="text-[12.5px] tabular-nums">{euro(r.omzet)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function DoelBlok({
  doel,
  maandLabel,
  maandOmzet,
  sindsJan,
  gefilterd,
}: {
  doel: number;
  maandLabel: string;
  maandOmzet: number;
  sindsJan: { omzet: number; doel: number } | null;
  gefilterd: boolean;
}) {
  const balk = (waarde: number, max: number) => (
    <span className="staaf" style={{ display: "block", height: 8, marginTop: 6 }}>
      <i className={waarde >= max ? "" : "accent"} style={{ width: `${Math.min(100, Math.round((waarde / max) * 100))}%` }} />
    </span>
  );
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div>
        <div className="flex justify-between">
          <span className="text-zinc-600">{maandLabel}</span>
          <span className="tabular-nums">
            <b className="font-medium">{euro(maandOmzet)}</b> / {euro(doel)}
          </span>
        </div>
        {balk(maandOmzet, doel)}
      </div>
      {sindsJan && (
        <div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Sinds januari</span>
            <span className="tabular-nums">
              <b className="font-medium">{euro(sindsJan.omzet)}</b> / {euro(sindsJan.doel)}
            </span>
          </div>
          {balk(sindsJan.omzet, sindsJan.doel)}
        </div>
      )}
      {gefilterd && <p className="text-[11.5px] text-zinc-500">Het doel geldt voor de hele dienst; met een firmafilter telt enkel die firma.</p>}
    </div>
  );
}

function FacturatieBlok({
  a,
  status,
  fact,
  gaten,
  melding,
}: {
  a: Afdeling;
  status: string;
  fact: ReturnType<typeof standVoor> | null;
  gaten: ReturnType<typeof standVoor>["gaten"];
  melding: string | null;
}) {
  if (!a.facturatie.length) return <p className="text-[13px] text-zinc-500">{a.facturatieNoot || "Geen facturatie in onze boekhouding."}</p>;
  if (status === "niet-ingesteld")
    return <p className="text-[13px] text-zinc-500">De koppeling met het facturatieplatform is nog niet ingesteld (FACTURATIE_URL en KOPPELING_TOKEN).</p>;
  if (status === "fout" || !fact)
    return <p className="text-[13px] text-zinc-500">Het facturatieplatform antwoordt niet{melding ? ` (${melding})` : ""}.</p>;
  const verschil = fact.gefactureerd - fact.verkocht;
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Verkocht</span>
          <div className="text-[20px] tabular-nums">{euro(fact.verkocht)}</div>
        </div>
        <div>
          <span className="label">Gefactureerd</span>
          <div className="text-[20px] tabular-nums">{euro(fact.gefactureerd)}</div>
        </div>
      </div>
      <p className="text-zinc-600">
        {Math.abs(verschil) < 1
          ? "Verkoop en facturatie lopen gelijk."
          : verschil > 0
            ? `${euro(verschil)} meer gefactureerd dan verkocht: verkoop die niet in Pipedrive staat.`
            : `${euro(-verschil)} verkocht maar (nog) niet gefactureerd.`}
      </p>
      {gaten.length > 0 ? (
        <div className="lijst">
          {gaten.slice(0, 3).map((g, i) => (
            <div key={i} className="item" style={{ padding: "8px 10px" }}>
              <div className="t">
                <b>{g.werf || g.klant || "(onbekend dossier)"}</b>
                <small>
                  {g.soort}
                  {g.firma ? ` · ${g.firma}` : ""}
                </small>
              </div>
              <span className="chip let">{euro(Math.abs(g.verschil))}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="chip goed" style={{ alignSelf: "flex-start" }}>
          Geen gaten ouder dan {WACHTTIJD_DAGEN} dagen
        </span>
      )}
      <a href={FACTURATIE_WEB} target="_blank" rel="noreferrer" className="text-[12px] font-medium underline">
        Naar facturatiecontrole{gaten.length > 3 ? ` (${gaten.length - 3} meer)` : ""}
      </a>
      {a.facturatieNoot && <p className="text-[11.5px] text-zinc-500">{a.facturatieNoot}</p>}
    </div>
  );
}
