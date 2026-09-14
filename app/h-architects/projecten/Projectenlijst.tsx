"use client";

import { useMemo, useState } from "react";
import { num } from "@/lib/format";
import {
  actief,
  filter,
  gemeentenVan,
  keuzes,
  LEEG,
  naarQuery,
  perGemeente,
  sorteer,
  teFotograferen,
  type Beoordeling,
  type Filters,
  type Project,
  type Sorteersleutel,
} from "@/lib/haProjectenFilter";

/**
 * De lijst zelf: filteren, sorteren en de twee weergaven.
 *
 * Alle 614 projecten komen in één keer mee uit de servercomponent. Filteren
 * gebeurt daarna in de browser, zonder herlaadbeurt; het adres wordt met
 * `history.replaceState` bijgewerkt zodat een gefilterde lijst deelbaar blijft
 * zonder dat Next.js de pagina opnieuw ophaalt.
 */

const PAD = "/h-architects/projecten";

/** ISO-datum naar de Vlaamse schrijfwijze. */
function datum(d: string | null) {
  if (!d) return null;
  const [j, m, dag] = d.split("-");
  return `${dag}/${m}/${j}`;
}

function Chip({
  soort,
  tekst,
  titel,
}: {
  soort: "goed" | "let" | "kritiek" | "";
  tekst: string;
  titel?: string;
}) {
  return (
    <span className={"chip" + (soort ? " " + soort : "")} title={titel}>
      {tekst}
    </span>
  );
}

/** De beoordeling als chip: ja groen, onzeker geel, nee rood. De tooltip noemt
 *  het bestand met het beste beeld, zodat je weet waar je moet kijken. */
function Oordeel({ p }: { p: Project }) {
  const soort: Record<Beoordeling, "goed" | "let" | "kritiek"> = {
    ja: "goed",
    onzeker: "let",
    nee: "kritiek",
  };
  const bestand = p.oplevering_bestand ? p.oplevering_bestand.split("/").pop() : null;
  const titel =
    p.oplevering_beoordeling === "ja"
      ? "Beste beeld: " + (bestand || "bestand niet genoteerd")
      : p.camerafotos === 0
        ? "Geen enkele camerafoto in de map"
        : p.oplevering_beoordeling === "onzeker"
          ? "Niet uit te maken op de drie recentste camerafoto's"
          : "Alleen werf, bestaande toestand of opmeting op de drie recentste camerafoto's";
  return <Chip soort={soort[p.oplevering_beoordeling]} tekst={p.oplevering_beoordeling} titel={titel} />;
}

/** Kolomkop die op sorteren klikt. Het pijltje staat er als woordteken bij,
 *  zodat de richting niet alleen uit de kleur blijkt. */
function Kop({
  sleutel,
  label,
  nu,
  oplopend,
  zetSortering,
  num: rechts,
}: {
  sleutel: Sorteersleutel;
  label: string;
  nu: Sorteersleutel;
  oplopend: boolean;
  zetSortering: (s: Sorteersleutel) => void;
  num?: boolean;
}) {
  const aan = nu === sleutel;
  return (
    <th className={rechts ? "num" : undefined} aria-sort={aan ? (oplopend ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => zetSortering(sleutel)}
        style={{
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          color: aan ? "var(--inkt)" : "inherit",
          padding: 0,
        }}
        title={"Sorteren op " + label.toLowerCase()}
      >
        {label}
        {aan ? (oplopend ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

export function Projectenlijst({
  projecten,
  begin,
  tabblad,
}: {
  projecten: Project[];
  begin: Filters;
  tabblad: string;
}) {
  const [f, zetF] = useState<Filters>(begin);
  const [tab, zetTab] = useState(tabblad === "gemeenten" ? "gemeenten" : "lijst");
  const [sleutel, zetSleutel] = useState<Sorteersleutel>("gemeente");
  const [oplopend, zetOplopend] = useState(true);

  const lijsten = useMemo(() => keuzes(projecten), [projecten]);
  const gemeenten = useMemo(
    () => gemeentenVan(projecten, f.provincie),
    [projecten, f.provincie],
  );
  const gevonden = useMemo(() => filter(projecten, f), [projecten, f]);
  const rijen = useMemo(() => sorteer(gevonden, sleutel, oplopend), [gevonden, sleutel, oplopend]);
  const gemeentelijst = useMemo(() => perGemeente(gevonden), [gevonden]);
  const kandidaten = useMemo(() => projecten.filter(teFotograferen).length, [projecten]);

  /** Eén plek die de stand vastlegt: de staat en het adres blijven gelijk. */
  function pas(volgende: Partial<Filters>, nieuwTab = tab) {
    const n = { ...f, ...volgende };
    // Een gemeente uit een andere provincie kan niet blijven staan.
    if (volgende.provincie !== undefined && n.gemeente) {
      const binnen = gemeentenVan(projecten, n.provincie);
      if (!binnen.includes(n.gemeente)) n.gemeente = "";
    }
    zetF(n);
    if (nieuwTab !== tab) zetTab(nieuwTab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", PAD + naarQuery(n, nieuwTab));
    }
  }

  function zetSortering(s: Sorteersleutel) {
    if (s === sleutel) zetOplopend(!oplopend);
    else {
      zetSleutel(s);
      zetOplopend(s === "gemeente" || s === "nummer" || s === "status");
    }
  }

  function wis() {
    zetSleutel("gemeente");
    zetOplopend(true);
    pas(LEEG);
  }

  const veld = (label: string, kind: React.ReactNode) => (
    <label className="veld">
      <span className="label">{label}</span>
      {kind}
    </label>
  );

  return (
    <>
      <div className="paneel" style={{ marginTop: 16 }}>
        <div className="kop">
          <h2>Filteren</h2>
          <small>
            {num(gevonden.length)} van {num(projecten.length)} projecten
            {actief(f) ? "" : " (geen filter actief)"}
          </small>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
            gap: 12,
          }}
        >
          {veld(
            "Zoeken",
            <input
              type="search"
              value={f.zoek}
              onChange={(e) => pas({ zoek: e.target.value })}
              placeholder="adres, gemeente, nummer, map"
            />,
          )}
          {veld(
            "Provincie",
            <select value={f.provincie} onChange={(e) => pas({ provincie: e.target.value })}>
              <option value="">Alle provincies</option>
              {lijsten.provincies.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Gemeente",
            <select value={f.gemeente} onChange={(e) => pas({ gemeente: e.target.value })}>
              <option value="">Alle gemeenten</option>
              {gemeenten.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Jaar van",
            <select value={f.van} onChange={(e) => pas({ van: e.target.value })}>
              <option value="">Vanaf het begin</option>
              {lijsten.jaren.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Jaar tot",
            <select value={f.tot} onChange={(e) => pas({ tot: e.target.value })}>
              <option value="">Tot nu</option>
              {lijsten.jaren.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Type",
            <select value={f.type} onChange={(e) => pas({ type: e.target.value })}>
              <option value="">Alle typen</option>
              {lijsten.typen.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Status",
            <select value={f.status} onChange={(e) => pas({ status: e.target.value })}>
              <option value="">Alle statussen</option>
              {lijsten.statussen.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>,
          )}
          {veld(
            "Camerafoto's",
            <select value={f.fotos} onChange={(e) => pas({ fotos: e.target.value })}>
              <option value="">Maakt niet uit</option>
              <option value="ja">ja</option>
              <option value="nee">nee</option>
              <option value="onbekend">onbekend</option>
            </select>,
          )}
          {veld(
            "Opgeleverd in beeld",
            <select value={f.oplevering} onChange={(e) => pas({ oplevering: e.target.value })}>
              <option value="">Maakt niet uit</option>
              <option value="ja">ja</option>
              <option value="nee">nee</option>
              <option value="onzeker">onzeker</option>
            </select>,
          )}
          {veld(
            "Recentste camerafoto vanaf",
            <select value={f.beeldVanaf} onChange={(e) => pas({ beeldVanaf: e.target.value })}>
              <option value="">Maakt niet uit</option>
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>,
          )}
        </div>

        <div className="werkbalk" style={{ marginTop: 16, marginBottom: 0 }}>
          <button
            type="button"
            className={f.focus ? "knop-donker" : "knop-licht"}
            onClick={() => pas({ focus: !f.focus }, "lijst")}
            aria-pressed={f.focus}
          >
            Te fotograferen ({num(kandidaten)})
          </button>
          {actief(f) && (
            <button type="button" className="knop-stil" onClick={wis}>
              Filters wissen
            </button>
          )}
          <span className="notitie" style={{ flex: "1 1 320px", minWidth: 0 }}>
            Te fotograferen = het afgewerkte gebouw staat niet zeker in beeld (beoordeling nee of
            onzeker) en het dossier is niet opgezegd.
          </span>
        </div>
      </div>

      <div className="paneel" style={{ marginTop: 16 }}>
        <div className="subtabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lijst"}
            className={tab === "lijst" ? "actief" : undefined}
            onClick={() => pas({}, "lijst")}
          >
            Projecten <b>{num(rijen.length)}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gemeenten"}
            className={tab === "gemeenten" ? "actief" : undefined}
            onClick={() => pas({}, "gemeenten")}
          >
            Per gemeente <b>{num(gemeentelijst.length)}</b>
          </button>
        </div>

        {rijen.length === 0 ? (
          <div className="leeg">
            <h3>Geen project gevonden</h3>
            <p>Geen enkel project past bij deze combinatie van filters. Zet er een terug open.</p>
            <button type="button" className="knop-licht" style={{ marginTop: 14 }} onClick={wis}>
              Filters wissen
            </button>
          </div>
        ) : tab === "lijst" ? (
          <div className="tabelwrap">
            <table className="tabel ha-tabel">
              <thead>
                <tr>
                  <Kop sleutel="nummer" label="Nr." nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} />
                  <th>Adres</th>
                  <Kop sleutel="gemeente" label="Gemeente" nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} />
                  <Kop sleutel="jaar" label="Jaar" nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} num />
                  <th>Type</th>
                  <Kop sleutel="status" label="Status" nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} />
                  <Kop sleutel="aantal" label="Foto's" nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} />
                  <Kop sleutel="recentste" label="Recentste" nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} num />
                  <Kop sleutel="oplevering" label="Oplev." nu={sleutel} oplopend={oplopend} zetSortering={zetSortering} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((p) => {
                  const gestopt = p.status === "opgezegd";
                  const d = datum(p.recentste_camerafoto);
                  return (
                    <tr
                      key={p.nummer + "|" + p.mapnaam}
                      style={gestopt ? { opacity: 0.55 } : undefined}
                      title={gestopt ? "Opgezegd dossier" : undefined}
                    >
                      <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {p.nummer}
                      </td>
                      <td className="ha-adres" title={p.mapnaam}>{p.adres}</td>
                      <td>
                        <span style={{ whiteSpace: "nowrap" }}>{p.gemeente}</span>
                        <span className="ha-sub">{p.provincie}</span>
                      </td>
                      <td className="num">{p.jaar ?? ""}</td>
                      <td className="ha-type">
                        {p.typen.length ? p.typen.join(", ") : <span style={{ color: "var(--inkt-vaag)" }}>niet ingevuld</span>}
                      </td>
                      <td>
                        <Chip soort="" tekst={p.status} />
                      </td>
                      <td className="ha-fotos">
                        {p.camerafotos > 0 ? (
                          <Chip
                            soort="goed"
                            tekst={num(p.camerafotos)}
                            titel={`${num(p.camerafotos)} camerafoto's · ${num(p.aantal)} beeldbestanden in totaal (plannen en schermafdrukken meegeteld)`}
                          />
                        ) : p.fotos === "onbekend" ? (
                          <Chip soort="let" tekst="onbekend" titel="De map is niet leesbaar in Dropbox" />
                        ) : (
                          <Chip
                            soort="kritiek"
                            tekst="0"
                            titel={`Geen camerafoto's · ${num(p.aantal)} beeldbestanden in totaal (plannen en schermafdrukken)`}
                          />
                        )}
                      </td>
                      <td className="num">
                        {d ? d.slice(-4) : <span style={{ color: "var(--inkt-vaag)" }}>geen</span>}
                      </td>
                      <td>
                        <Oordeel p={p} />
                      </td>
                      <td>
                        <a
                          className="knop-stil knop-klein"
                          href={p.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="Opent de projectmap in Dropbox, in een nieuw tabblad"
                        >
                          Dropbox
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Gemeente</th>
                  <th>Provincie</th>
                  <th className="num">Projecten</th>
                  <th className="num">Opgeleverd in beeld</th>
                  <th className="num">Onzeker</th>
                  <th className="num">Te fotograferen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gemeentelijst.map((g) => (
                  <tr key={g.gemeente + "|" + g.provincie}>
                    <td style={{ fontWeight: 500 }}>{g.gemeente}</td>
                    <td style={{ color: "var(--inkt-zacht)" }}>{g.provincie}</td>
                    <td className="num">{num(g.projecten)}</td>
                    <td className="num">
                      {g.inBeeld > 0 ? (
                        <Chip soort="goed" tekst={num(g.inBeeld)} />
                      ) : (
                        <span style={{ color: "var(--inkt-vaag)" }}>0</span>
                      )}
                    </td>
                    <td className="num">
                      {g.onzeker > 0 ? (
                        num(g.onzeker)
                      ) : (
                        <span style={{ color: "var(--inkt-vaag)" }}>0</span>
                      )}
                    </td>
                    <td className="num">
                      {g.teFotograferen > 0 ? (
                        <Chip soort="let" tekst={num(g.teFotograferen)} />
                      ) : (
                        <span style={{ color: "var(--inkt-vaag)" }}>0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="knop-stil knop-klein"
                        onClick={() => pas({ provincie: g.provincie, gemeente: g.gemeente }, "lijst")}
                      >
                        Toon projecten
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="notitie" style={{ marginTop: 14 }}>
              De aantallen volgen de filters hierboven. Klik op een gemeente om alleen die projecten
              in de lijst te zien.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
