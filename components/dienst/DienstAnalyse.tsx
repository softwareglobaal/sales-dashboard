import Link from "next/link";
import { bereik, dataset, filterFirma, firmasVan, isDienstPeriode, kpis, perMaand, type Afdeling } from "@/lib/afdelingen";
import { bundel, geslacht, perPipeline, regio, timing, trechters, velden, type Telling } from "@/lib/analyse";
import { meetingStand } from "@/lib/agenda";
import { euro, num } from "@/lib/format";
import { DienstKop, type DienstZoek } from "./DienstKop";
import { TimingBars } from "@/components/Charts";
import { BelgiumMap, type OurOffice } from "@/components/BelgiumMap";
import { CommissieBalk, commissieMaand } from "@/components/CommissieBalk";
import { AnalysePanel } from "@/components/AnalysePanel";
import { SubNav } from "@/components/SubNav";
import { POSTCODE_COORDS } from "@/lib/postcodeCoords";
import officesConfig from "@/config/offices.json";

// Subtab Analyse (spec §17): de diepere blokken van de vroegere Engineering- en
// Energy-pagina, nu voor elke dienst, in de Glas-stijl en op dezelfde dataset als het
// Overzicht. Wat het Overzicht al toont (kerncijfers, per maand, kanalen, verloren)
// staat hier niet nog eens.

function Tabelletje({ titel, rijen, totaal, leeg }: { titel: string; rijen: Telling[]; totaal: number; leeg: string }) {
  const ingevuld = rijen.reduce((s, r) => s + r.aantal, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">{titel}</span>
        <span className="text-[11.5px] text-zinc-500">
          {num(ingevuld)} van {num(totaal)} ingevuld
        </span>
      </div>
      {ingevuld === 0 ? (
        <p className="text-[12.5px] text-zinc-500">{leeg}</p>
      ) : (
        <div className="lijst">
          {rijen.slice(0, 8).map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="staaf" style={{ width: 90 }}>
                <i style={{ width: `${Math.round((r.aantal / rijen[0].aantal) * 100)}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums">{r.aantal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DienstAnalyse({ a, sp }: { a: Afdeling; sp: DienstZoek & { rs?: string } }) {
  const periode = isDienstPeriode(sp.periode) ? sp.periode : "ytd";
  const f = sp.firma && firmasVan(a).some((x) => x.sleutel === sp.firma) ? sp.firma : undefined;
  const b = bereik(periode);
  const d = filterFirma(dataset(a), f);
  const pipes = perPipeline(d, b.van, b.tot);
  const trecht = trechters(d, b.van, b.tot);
  const tijd = timing(d, b.van, b.tot);
  const reg = regio(d, b.van, b.tot);
  const bun = bundel(a, d, b.van, b.tot);
  const vel = velden(d, b.van, b.tot);
  const gesl = geslacht(d, b.van, b.tot);
  const meet = meetingStand(d, b.van, b.tot);
  const commissie = a.doel.bron?.startsWith("commissie.") ? (a.doel.bron.slice(10) as "engineering" | "energy") : null;
  const cm = commissieMaand(/^\d{4}-\d{2}$/.test(periode) ? periode : "ytd");
  const cmOmzet = commissie ? perMaand(d, +cm.maand.slice(0, 4))[+cm.maand.slice(5, 7) - 1]?.omzet || 0 : 0;
  const status = (["won", "open", "lost"].includes(sp.rs || "") ? sp.rs : "all") as "won" | "open" | "lost" | "all";
  const punten = status === "all" ? reg.punten : reg.punten.filter((p) => p.status === status);
  const kantoren: OurOffice[] = officesConfig.offices
    .map((o) => {
      const c = (POSTCODE_COORDS as Record<string, [number, number]>)[o.postal];
      return c ? { label: o.label, address: o.address, city: o.city, lat: c[0], lng: c[1], confirmed: o.confirmed } : null;
    })
    .filter((o): o is OurOffice => o !== null);
  const k = kpis(d, b.van, b.tot);

  const secties = [
    ...(commissie ? [{ id: "teamdoel", label: "Teamdoel" }] : []),
    ...(commissie ? [{ id: "advies", label: "Analyse & advies" }] : []),
    { id: "meetings", label: "Meetings" },
    { id: "pipelines", label: "Per pipeline" },
    { id: "trechter", label: "Trechter" },
    { id: "regio", label: "Regio" },
    { id: "timing", label: "Dag & uur" },
    ...(bun ? [{ id: "bundel", label: "Bundel" }] : []),
    { id: "velden", label: "Project & motivatie" },
    { id: "geslacht", label: "Geslacht" },
  ];
  const rsHref = (rs: string) => {
    const p = new URLSearchParams();
    if (periode !== "ytd") p.set("periode", periode);
    if (f) p.set("firma", f);
    if (rs !== "all") p.set("rs", rs);
    const s = p.toString();
    return `/${a.pad}/analyse${s ? "?" + s : ""}#regio`;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <DienstKop a={a} tab="analyse" sp={{ periode, firma: f }} />
      <SubNav items={secties} />

      {commissie && (
        <section id="teamdoel" className="mt-4 scroll-mt-40">
          <CommissieBalk afdeling={commissie} omzet={cmOmzet} maandLabel={cm.maand} dagenOver={cm.dagenOver} />
        </section>
      )}
      {commissie && (
        <section id="advies" className="mt-4 scroll-mt-40">
          <AnalysePanel period={periode} afdeling={commissie} scope={f === "tkn" ? "tkn" : f === "unabo" ? "unabo" : "all"} />
        </section>
      )}

      <section id="meetings" className="paneel mt-4 scroll-mt-40">
        <div className="kop">
          <h2>Meetings</h2>
          <small>uit de agenda (afspraak bij de klant of via Zoom) en het Pipedrive-veld &quot;Meeting gehad&quot;</small>
        </div>
        {meet.aanvragen === 0 ? (
          <p className="text-[13px] text-zinc-500">Geen aanvragen in deze periode.</p>
        ) : (
          <>
            <div className="grid gap-4 text-[13px] sm:grid-cols-4">
              <div>
                <span className="label">Met meeting</span>
                <div className="text-[22px] tabular-nums">{num(meet.met)}</div>
                <div className="text-zinc-500">{Math.round((meet.met / meet.aanvragen) * 100)}% van {num(meet.aanvragen)} aanvragen</div>
              </div>
              <div>
                <span className="label">Winratio met meeting</span>
                <div className="text-[22px] tabular-nums" style={{ color: "var(--goed)" }}>
                  {meet.winMet == null ? "—" : `${Math.round(meet.winMet * 100)}%`}
                </div>
              </div>
              <div>
                <span className="label">Winratio zonder</span>
                <div className="text-[22px] tabular-nums">{meet.winZonder == null ? "—" : `${Math.round(meet.winZonder * 100)}%`}</div>
              </div>
              <div>
                <span className="label">Bron</span>
                <div className="text-zinc-600">
                  {num(meet.perBron.agenda)} uit de agenda · {num(meet.perBron.pipedrive)} uit Pipedrive
                </div>
                <div className="text-[11.5px] text-zinc-500">agenda laatst gelezen: {meet.agendaGelezen || "nog niet"}</div>
              </div>
            </div>
            {meet.lijst.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-[12.5px] font-medium">Toon de {meet.lijst.length} gekoppelde meetings met de redenering</summary>
                <div className="tabelwrap mt-2">
                  <table className="tabel">
                    <thead>
                      <tr>
                        <th>Deal</th>
                        <th>Afspraak</th>
                        <th>Waarom gekoppeld</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meet.lijst.map((m) => (
                        <tr key={m.uid + (m.eventId || "")}>
                          <td style={{ minWidth: 200 }}>
                            <a href={m.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                              {m.titel}
                            </a>
                          </td>
                          <td style={{ minWidth: 200 }}>
                            {m.afspraak || "—"}
                            <div className="text-[11.5px] text-zinc-500">
                              {m.datum ? m.datum.split("-").reverse().join("/") : ""}
                              {m.agenda ? ` · ${m.agenda}` : ""}
                            </div>
                          </td>
                          <td className="text-[12.5px]">{m.reden}</td>
                          <td>
                            <span className={m.status === "won" ? "chip goed" : m.status === "lost" ? "chip let" : "chip"}>
                              {m.status === "won" ? "gewonnen" : m.status === "lost" ? "verloren" : "open"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section id="pipelines" className="paneel mt-4 scroll-mt-40">
        <div className="kop">
          <h2>Per pipeline</h2>
          <small>{b.label}</small>
        </div>
        <div className="tabelwrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Pipeline / bron</th>
                <th className="num">Aanvragen</th>
                <th className="num">Open</th>
                <th className="num">Gewonnen</th>
                <th className="num">Verloren</th>
                <th className="num">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {pipes.map((p) => (
                <tr key={p.pipeline}>
                  <td>{p.pipeline}</td>
                  <td className="num">{num(p.aanvragen)}</td>
                  <td className="num">{num(p.open)}</td>
                  <td className="num">{num(p.gewonnen)}</td>
                  <td className="num">{num(p.verloren)}</td>
                  <td className="num">{euro(p.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="trechter" className="mt-4 scroll-mt-40">
        <div className="paneel">
          <div className="kop">
            <h2>Trechter per fase</h2>
            <small>aanvragen uit {b.label.toLowerCase()} · &quot;bereikt&quot; afgeleid uit de huidige fase · dagen = gemiddeld in de huidige fase (open deals)</small>
          </div>
          {trecht.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Geen fasegegevens (Monday-projecten hebben geen fases).</p>
          ) : (
            trecht.map((t) => (
              <details key={t.pipeline} className="mb-3" open={trecht.length <= 2}>
                <summary className="cursor-pointer font-medium">
                  {t.pipeline} <span className="text-[12px] font-normal text-zinc-500">· {num(t.aanvragen)} aanvragen</span>
                </summary>
                <div className="tabelwrap mt-2">
                  <table className="tabel">
                    <thead>
                      <tr>
                        <th>Fase</th>
                        <th>Bereikt</th>
                        <th className="num">Staat er nu</th>
                        <th className="num">Hier verloren</th>
                        <th className="num">Dagen in fase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.fases.map((x) => (
                        <tr key={x.fase}>
                          <td>{x.fase}</td>
                          <td style={{ minWidth: 160 }}>
                            <div className="flex items-center gap-2">
                              <span className="staaf" style={{ width: 90 }}>
                                <i className="accent" style={{ width: `${x.pctVanAanvragen}%` }} />
                              </span>
                              <span className="tabular-nums text-[12.5px]">
                                {num(x.bereikt)} · {x.pctVanAanvragen}%
                              </span>
                            </div>
                          </td>
                          <td className="num">{num(x.open)}</td>
                          <td className="num">{num(x.verloren)}</td>
                          <td className="num">{x.gemDagenInFase ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      <section id="regio" className="paneel mt-4 scroll-mt-40">
        <div className="kop">
          <h2>Regio</h2>
          <small>
            {num(reg.geplaatst)} aanvragen met een herkenbare postcode · {num(reg.onbekend)} zonder
          </small>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "won", "open", "lost"] as const).map((s) => (
            <Link key={s} href={rsHref(s)} className={status === s ? "chip donker" : "chip"} scroll={false}>
              {s === "all" ? "Alles" : s === "won" ? "Gewonnen" : s === "open" ? "Open" : "Verloren"}
            </Link>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BelgiumMap points={punten} b2bOffices={[]} ourOffices={kantoren} />
          </div>
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Provincie</th>
                  <th className="num">Aanvr.</th>
                  <th className="num">Gew.</th>
                </tr>
              </thead>
              <tbody>
                {reg.provincies.map((p) => (
                  <tr key={p.provincie}>
                    <td>{p.provincie}</td>
                    <td className="num">{num(p.aanvragen)}</td>
                    <td className="num">{num(p.gewonnen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="timing" className="mt-4 grid scroll-mt-40 gap-4 lg:grid-cols-2">
        <div className="paneel">
          <div className="kop">
            <h2>Per weekdag</h2>
            <small>{num(tijd.totaal)} aanvragen · Belgische tijd</small>
          </div>
          <TimingBars data={tijd.perDag} name="Aanvragen" color="#2a78d6" />
        </div>
        <div className="paneel">
          <div className="kop">
            <h2>Per uur</h2>
            <small>wanneer komen aanvragen binnen</small>
          </div>
          <TimingBars data={tijd.perUur} name="Aanvragen" color="#2a78d6" />
        </div>
      </section>

      {bun && (
        <section id="bundel" className="paneel mt-4 scroll-mt-40">
          <div className="kop">
            <h2>Bundel tegenover los</h2>
            <small>gewonnen in {b.label.toLowerCase()}</small>
          </div>
          <div className="grid gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <span className="label">Los verkocht</span>
              <div className="text-[22px] tabular-nums">{num(bun.losAantal)}</div>
              <div className="text-zinc-500">{euro(bun.losOmzet)}</div>
            </div>
            <div>
              <span className="label">In een bundel</span>
              <div className="text-[22px] tabular-nums">{num(bun.bundelAantal)}</div>
              <div className="text-zinc-500">
                {euro(bun.bundelDienstOmzet)} voor {a.naam} · hele bundel {euro(bun.bundelDealwaarde)}
              </div>
            </div>
            <div>
              <span className="label">Aandeel bundel</span>
              <div className="text-[22px] tabular-nums">
                {bun.losAantal + bun.bundelAantal ? Math.round((bun.bundelAantal / (bun.losAantal + bun.bundelAantal)) * 100) : 0}%
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="velden" className="paneel mt-4 scroll-mt-40">
        <div className="kop">
          <h2>Project en motivatie</h2>
          <small>uit de Pipedrive-velden; toont meer naarmate ze ingevuld worden</small>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Tabelletje titel="Gebouwtype" rijen={vel.gebouwtype} totaal={vel.aanvragen} leeg="Nog niet ingevuld." />
          <Tabelletje titel="Type aanvraag" rijen={vel.typeAanvraag} totaal={vel.aanvragen} leeg="Nog niet ingevuld." />
          <Tabelletje titel="Reden gewonnen" rijen={vel.redenGewonnen} totaal={vel.gewonnen} leeg="Nog niet ingevuld." />
          <Tabelletje titel="Verlies: invloedbaar?" rijen={vel.invloedbaar} totaal={vel.verloren} leeg="Enkel UNABO vult dit in." />
          <Tabelletje titel="Verlies: onderliggende oorzaak" rijen={vel.oorzaak} totaal={vel.verloren} leeg="Enkel UNABO vult dit in." />
        </div>
      </section>

      <section id="geslacht" className="paneel mt-4 scroll-mt-40">
        <div className="kop">
          <h2>Geslacht contactpersoon</h2>
          <small>
            {num(gesl.ingevuld)} van {num(gesl.totaal)} ingevuld · {k.aanvragen ? "" : ""}
          </small>
        </div>
        {gesl.ingevuld < 20 ? (
          <p className="text-[13px] text-zinc-500">Te weinig ingevuld om iets te zeggen (minder dan 20 aanvragen).</p>
        ) : (
          <div className="grid gap-4 text-[13px] sm:grid-cols-2">
            {(["Man", "Vrouw"] as const).map((g) => (
              <div key={g}>
                <span className="label">{g}</span>
                <div className="text-[22px] tabular-nums">{num(gesl.rijen[g].aanvragen)}</div>
                <div className="text-zinc-500">
                  {gesl.rijen[g].aanvragen ? Math.round((gesl.rijen[g].gewonnen / gesl.rijen[g].aanvragen) * 100) : 0}% gewonnen
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
