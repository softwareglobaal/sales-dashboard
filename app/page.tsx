import Link from "next/link";
import {
  AFDELINGEN,
  FIRMAS,
  bereik,
  dataset,
  filterFirma,
  firmasVan,
  groei,
  isDienstPeriode,
  kpis,
  maanddoel,
  perMaand,
  uniekeTotalen,
  maandOpties,
} from "@/lib/afdelingen";
import { koppeling, standVoor, FACTURATIE_WEB } from "@/lib/facturatie";
import { campagnes } from "@/lib/kanalen";
import { getDb } from "@/lib/db";
import { MONTH_NAMES } from "@/lib/queries";
import { euro, num, dateTime } from "@/lib/format";
import { dienstHref } from "@/components/dienst/DienstKop";
import { MaandKeuze } from "@/components/dienst/MaandKeuze";
import { JaarGrafiek } from "@/components/dienst/JaarGrafiek";
import { MaandHistoriek } from "@/components/dienst/MaandHistoriek";
import { SyncButton } from "@/components/SyncButton";
import { NotesPanel } from "@/components/NotesPanel";

// Algemeen (spec §17): de hele organisatie op één scherm. Eén rij per dienst,
// de targets met hun stand, de facturatiegaten en de groei tegenover vorig jaar.
// Met de firmakeuze wordt dit "wat heeft deze firma verkocht", over alle diensten
// heen (bv. H-Architects = Architectuur + Regularisatie).

export const dynamic = "force-dynamic";

type Zoek = { periode?: string; firma?: string };

function Pil({ actief, naar, children }: { actief: boolean; naar: string; children: React.ReactNode }) {
  return (
    <Link href={naar} className={actief ? "chip donker" : "chip"} style={{ padding: "6px 13px", fontSize: 12.5 }} scroll={false}>
      {children}
    </Link>
  );
}

function Balk({ waarde, max }: { waarde: number; max: number }) {
  return (
    <span className="staaf" style={{ display: "block", height: 6, marginTop: 4, minWidth: 90 }}>
      <i className={waarde >= max ? "" : "accent"} style={{ width: `${Math.min(100, Math.round((waarde / max) * 100))}%` }} />
    </span>
  );
}

function GroeiTekst({ nu, vorig }: { nu: number; vorig: number | null }) {
  if (vorig == null) return <span className="text-zinc-400">—</span>;
  const g = groei(nu, vorig);
  if (g == null) return <span className="text-zinc-400">nieuw</span>;
  return (
    <span style={{ color: g > 0 ? "var(--goed)" : g < 0 ? "var(--kritiek)" : "var(--inkt-vaag)" }}>
      {g > 0 ? "▲" : g < 0 ? "▼" : "="} {Math.abs(g)}%
    </span>
  );
}

export default async function Algemeen({ searchParams }: { searchParams: Promise<Zoek> }) {
  const sp = await searchParams;
  const periode = isDienstPeriode(sp.periode) ? sp.periode : "ytd";
  const f = FIRMAS.some((x) => x.sleutel === sp.firma) ? sp.firma : undefined;
  const firmaNaam = f ? FIRMAS.find((x) => x.sleutel === f)!.naam : null;
  const zoek = { periode, firma: f };
  const b = bereik(periode);
  const nuJaar = new Date().getFullYear();
  const maand = new Date().getMonth();
  const factJaar = periode === "prev_year" ? String(nuJaar - 1) : b.van.slice(0, 4);

  const diensten = (f ? AFDELINGEN.filter((a) => firmasVan(a).some((x) => x.sleutel === f)) : AFDELINGEN).map((a) => {
    const d = filterFirma(dataset(a), f);
    const k = kpis(d, b.van, b.tot);
    const v = b.vergelijk ? kpis(d, b.vergelijk.van, b.vergelijk.tot) : null;
    const reeks = perMaand(d, nuJaar);
    return { a, d, k, v, reeks, doel: maanddoel(a), adsActief: campagnes(a).filter((c) => c.status === "ENABLED").length };
  });

  const tot = uniekeTotalen(diensten.map((x) => x.d), b.van, b.tot);
  const totVorig = b.vergelijk ? uniekeTotalen(diensten.map((x) => x.d), b.vergelijk.van, b.vergelijk.tot) : null;
  const omzet = diensten.reduce((s, x) => s + x.k.omzet, 0);
  const omzetVorig = diensten.reduce((s, x) => s + (x.v?.omzet || 0), 0);

  const kop = await koppeling();
  const fact = kop.status === "ok" ? kop.data : null;
  const gatenPer = new Map<string, number>();
  let gatenTotaal = 0;
  let nogTeFactureren = 0;
  let onbetaald = 0;
  if (fact) {
    for (const x of diensten) {
      const g = x.a.facturatie.length ? standVoor(fact, x.a, factJaar).gaten.filter((g) => !firmaNaam || (g.verkocht_via ? g.verkocht_via === firmaNaam : g.firma === firmaNaam)).length : 0;
      gatenPer.set(x.a.pad, g);
      gatenTotaal += g;
      if (x.a.facturatie.length) {
        const st = standVoor(fact, x.a, factJaar);
        nogTeFactureren += st.nogTeFactureren;
        onbetaald += st.openstaand;
      }
    }
  }

  // Totaalgrafiek: omzet, aanvragen en gewonnen van alle diensten samen per maand.
  const som = (jaar: number) => {
    const r = Array.from({ length: 12 }, () => ({ omzet: 0, aanvragen: 0, gewonnen: 0 }));
    for (const x of diensten) {
      perMaand(x.d, jaar).forEach((m, i) => {
        r[i].omzet += m.omzet;
      });
    }
    // aanvragen en gewonnen uniek tellen (bundels niet dubbel)
    for (let i = 0; i < 12; i++) {
      const van = `${jaar}-${String(i + 1).padStart(2, "0")}-01`;
      const totM = i === 11 ? `${jaar + 1}-01-01` : `${jaar}-${String(i + 2).padStart(2, "0")}-01`;
      const u = uniekeTotalen(diensten.map((x) => x.d), van, totM);
      r[i].aanvragen = u.aanvragen;
      r[i].gewonnen = u.gewonnen;
    }
    return r;
  };
  const nuReeks = som(nuJaar);
  const vorigReeks = som(nuJaar - 1);
  const grafiek = nuReeks.map((r, i) => ({ maand: MONTH_NAMES[i].slice(0, 3), nu: i <= maand ? { totaal: r } : null, vorig: vorigReeks[i] }));

  const metDoel = diensten.filter((x) => x.doel > 0);
  const zonderDoel = diensten.filter((x) => x.doel === 0);

  const syncRijen = getDb().prepare("SELECT account_key, last_sync, deal_count, status, message FROM sync_meta WHERE account_key NOT LIKE 'producten-volledig:%' AND account_key NOT LIKE 'personen:%' ORDER BY account_key").all() as any[];
  const syncFouten = syncRijen.filter((r) => r.status === "error");

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="kopbalk">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="h1-glas">{firmaNaam ? `Wat heeft ${firmaNaam} verkocht` : "Algemeen"}</h1>
            <p className="text-[12.5px] text-zinc-500">
              {b.label}
              {b.vergelijk ? ` · vergeleken met ${b.vergelijk.label}` : ""} · {diensten.length} diensten
            </p>
          </div>
          <SyncButton />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pil actief={periode === "ytd"} naar={dienstHref("/", zoek, { periode: "ytd" })}>
            Dit jaar
          </Pil>
          <Pil actief={periode === "prev_year"} naar={dienstHref("/", zoek, { periode: "prev_year" })}>
            Vorig jaar
          </Pil>
          <MaandKeuze opties={maandOpties()} huidig={periode} basis={dienstHref("/", zoek, { periode: "" })} />
          <span className="mx-1 h-5 w-px bg-black/10" aria-hidden="true" />
          <Pil actief={!f} naar={dienstHref("/", zoek, { firma: "" })}>
            Alle firma&apos;s
          </Pil>
          {FIRMAS.map((x) => (
            <Pil key={x.sleutel} actief={f === x.sleutel} naar={dienstHref("/", zoek, { firma: x.sleutel })}>
              {x.naam}
            </Pil>
          ))}
        </div>
      </div>

      {(gatenTotaal > 0 || syncFouten.length > 0) && (
        <div className="mt-4 flex flex-col gap-2">
          {gatenTotaal > 0 && (
            <div className="notitie let">
              <b className="font-medium">{gatenTotaal} facturatiegaten in {factJaar}</b> tussen verkoop en facturatie
              (ouder dan 30 dagen). Per dienst staan ze in de tabel hieronder;{" "}
              <a href={FACTURATIE_WEB} target="_blank" rel="noreferrer" className="underline">
                details in facturatiecontrole
              </a>
              .
            </div>
          )}
          {syncFouten.length > 0 && (
            <div className="notitie kritiek">
              <b className="font-medium">Synchronisatie faalt</b> voor {syncFouten.map((r) => r.account_key).join(", ")}: {syncFouten[0].message}
            </div>
          )}
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="paneel kpi">
          <span className="label">Aanvragen</span>
          <div className="groot">{num(tot.aanvragen)}</div>
          <div className="delta">
            <GroeiTekst nu={tot.aanvragen} vorig={totVorig?.aanvragen ?? null} /> {totVorig ? `t.o.v. ${b.vergelijk!.label}` : ""}
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Gewonnen</span>
          <div className="groot">{num(tot.gewonnen)}</div>
          <div className="delta">
            <GroeiTekst nu={tot.gewonnen} vorig={totVorig?.gewonnen ?? null} /> {totVorig ? `t.o.v. ${b.vergelijk!.label}` : ""}
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Omzet</span>
          <div className="groot">{euro(omzet)}</div>
          <div className="delta">
            <GroeiTekst nu={omzet} vorig={b.vergelijk ? omzetVorig : null} /> {b.vergelijk ? `t.o.v. ${b.vergelijk.label}` : ""}
          </div>
        </div>
        <div className="paneel kpi">
          <span className="label">Winratio</span>
          <div className="groot">{tot.gewonnen + tot.verloren ? `${Math.round((tot.gewonnen / (tot.gewonnen + tot.verloren)) * 100)}%` : "—"}</div>
          <div className="delta">
            {num(tot.gewonnen)} gewonnen · {num(tot.verloren)} verloren
          </div>
        </div>
      </section>

      {fact && (
        <a
          href={FACTURATIE_WEB}
          target="_blank"
          rel="noreferrer"
          className="paneel mt-4 flex flex-wrap items-baseline justify-between gap-3"
          style={{ textDecoration: "none", color: "inherit", padding: "14px 20px" }}
        >
          <span className="label">Cash {factJaar} (uit facturatiecontrole)</span>
          <span className="text-[13px]">
            Nog te factureren <b className="text-[17px] font-medium tabular-nums">{euro(nogTeFactureren)}</b>
          </span>
          <span className="text-[13px]">
            Gefactureerd, nog niet betaald <b className="text-[17px] font-medium tabular-nums">{euro(onbetaald)}</b>
          </span>
          <span className="text-[12px] font-medium underline">Details in facturatiecontrole</span>
        </a>
      )}

      <section className="paneel mt-4">
        <div className="kop">
          <h2>Per dienst</h2>
          <small>
            {b.label} · een bundeldeal telt bij elke dienst, in het totaal één keer
          </small>
        </div>
        <div className="tabelwrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Dienst</th>
                <th className="num">Aanvragen</th>
                <th className="num">Gewonnen</th>
                <th className="num">Omzet</th>
                <th className="num">Groei omzet</th>
                <th>Doel {MONTH_NAMES[maand]}</th>
                <th className="num">Factuurgaten</th>
                <th className="num">Ads</th>
              </tr>
            </thead>
            <tbody>
              {diensten.map((x) => (
                <tr key={x.a.pad}>
                  <td>
                    <Link href={dienstHref("/" + x.a.pad, zoek)} className="font-medium hover:underline">
                      {x.a.naam}
                    </Link>
                    <div className="text-[11.5px] text-zinc-500">{x.a.wie.verkoop}</div>
                  </td>
                  <td className="num">
                    {num(x.k.aanvragen)} <small className="text-[11px]"><GroeiTekst nu={x.k.aanvragen} vorig={x.v?.aanvragen ?? null} /></small>
                  </td>
                  <td className="num">{num(x.k.gewonnen)}</td>
                  <td className="num">{euro(x.k.omzet)}</td>
                  <td className="num">
                    <GroeiTekst nu={x.k.omzet} vorig={x.v ? x.v.omzet : null} />
                  </td>
                  <td>
                    {x.doel > 0 ? (
                      <div className="text-[12px] tabular-nums">
                        {euro(x.reeks[maand].omzet)} / {euro(x.doel)}
                        <Balk waarde={x.reeks[maand].omzet} max={x.doel} />
                      </div>
                    ) : (
                      <span className="text-[12px] text-zinc-400">geen doel</span>
                    )}
                  </td>
                  <td className="num">
                    {!fact || !x.a.facturatie.length ? (
                      <span className="text-zinc-400">—</span>
                    ) : gatenPer.get(x.a.pad) ? (
                      <Link href={dienstHref("/" + x.a.pad, zoek) + "#facturatie"} className="chip let">
                        {gatenPer.get(x.a.pad)}
                      </Link>
                    ) : (
                      <span className="chip goed">0</span>
                    )}
                  </td>
                  <td className="num">
                    {x.a.kanalen.ads.length === 0 ? (
                      <span className="text-zinc-400">—</span>
                    ) : x.adsActief ? (
                      <Link href={`/seo-sea?dienst=${x.a.pad}`} className="chip goed">
                        {x.adsActief} actief
                      </Link>
                    ) : (
                      <span className="chip">uit</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="totaal">
                <td>Totaal</td>
                <td className="num">{num(tot.aanvragen)}</td>
                <td className="num">{num(tot.gewonnen)}</td>
                <td className="num">{euro(omzet)}</td>
                <td className="num">
                  <GroeiTekst nu={omzet} vorig={b.vergelijk ? omzetVorig : null} />
                </td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
        {kop.status !== "ok" && (
          <p className="mt-2 text-[11.5px] text-zinc-500">
            Factuurgaten: {kop.status === "niet-ingesteld" ? "koppeling met het facturatieplatform nog niet ingesteld" : "facturatieplatform antwoordt niet"}.
          </p>
        )}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="paneel lg:col-span-2">
          <div className="kop">
            <h2>Per maand</h2>
            <small>
              alle diensten samen · {nuJaar} tegenover {nuJaar - 1}
            </small>
          </div>
          <JaarGrafiek rijen={grafiek} jaar={nuJaar} bronnen={[{ key: "totaal", label: `Alle diensten ${nuJaar}` }]} />
        </div>
        <div className="paneel">
          <div className="kop">
            <h2>Salestargets</h2>
            <small>gewonnen omzet tegenover het maanddoel</small>
          </div>
          <div className="flex flex-col gap-4 text-[13px]">
            {metDoel.map((x) => {
              const sindsJan = x.reeks.slice(0, maand + 1).reduce((s, r) => s + r.omzet, 0);
              return (
                <div key={x.a.pad}>
                  <div className="flex justify-between">
                    <Link href={dienstHref("/" + x.a.pad, zoek)} className="font-medium hover:underline">
                      {x.a.naam}
                    </Link>
                    <span className="tabular-nums text-zinc-600">{euro(x.doel)} / maand</span>
                  </div>
                  <div className="mt-1 flex justify-between text-[12px] text-zinc-600">
                    <span>{MONTH_NAMES[maand]}</span>
                    <span className="tabular-nums">{euro(x.reeks[maand].omzet)}</span>
                  </div>
                  <Balk waarde={x.reeks[maand].omzet} max={x.doel} />
                  <div className="mt-2 flex justify-between text-[12px] text-zinc-600">
                    <span>Sinds januari</span>
                    <span className="tabular-nums">
                      {euro(sindsJan)} / {euro(x.doel * (maand + 1))}
                    </span>
                  </div>
                  <Balk waarde={sindsJan} max={x.doel * (maand + 1)} />
                  <div className="mt-3">
                    <MaandHistoriek doel={x.doel} maanden={x.reeks.slice(0, maand).map((r, i) => ({ maand: MONTH_NAMES[i].slice(0, 3), omzet: r.omzet }))} />
                  </div>
                </div>
              );
            })}
            {zonderDoel.length > 0 && (
              <p className="text-[12px] text-zinc-500">
                Nog geen doel voor {zonderDoel.map((x) => x.a.naam).join(", ")}. Een maanddoel zet je in{" "}
                <code className="rounded bg-black/5 px-1">config/afdelingen.json</code>.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <details className="paneel">
          <summary className="cursor-pointer font-serif text-[18px]">Synchronisatie</summary>
          <div className="tabelwrap mt-3">
            <table className="tabel">
              <tbody>
                {syncRijen.map((r) => (
                  <tr key={r.account_key}>
                    <td>{r.account_key}</td>
                    <td>{r.status === "ok" ? <span className="chip goed">ok</span> : <span className="chip kritiek">fout</span>}</td>
                    <td className="num">{num(r.deal_count || 0)}</td>
                    <td className="num text-[12px] text-zinc-500">{dateTime(r.last_sync)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details className="paneel">
          <summary className="cursor-pointer font-serif text-[18px]">Notities</summary>
          <div className="mt-3">
            <NotesPanel />
          </div>
        </details>
      </section>
    </main>
  );
}
