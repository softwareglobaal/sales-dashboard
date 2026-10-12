"use client";

import { useMemo, useState } from "react";

// Volledige lijst Bisson-projecten met filters. Klein genoeg (enkele honderden regels)
// om alles mee te sturen en in de browser te filteren.

type Rij = {
  nr: string;
  jaar: number;
  datum: string;
  dienst: string | null;
  dienst_naam: string | null;
  soort: string | null;
  soort_naam: string | null;
  architect_code: string | null;
  bureau: string | null;
  ingenieur: string | null;
  opdrachtgever: { soort: "architect" | "ingenieur"; naam: string; bron: string | null } | null;
  bureau_naam: string | null;
  bureau_zeker: boolean;
  signaal: string | null;
  adres: string | null;
  link: string | null;
  bestanden: number | null;
  monday: { link: string | null; stand: string | null; uitvoerder: string | null; factuur_1: string | null } | null;
  facturen: { nr: string; bedrag: number | null; klant?: string | null; pdf?: string | null }[];
  schatting: number | null;
  werf_treffers: number;
};

const ONZE = new Set(["eerst-bij-ons", "beide", "eigen"]);

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function BissonLijst({ projecten, beginJaar = "" }: { projecten: Rij[]; beginJaar?: string }) {
  const [jaar, setJaar] = useState(beginJaar);
  const [dienst, setDienst] = useState("");
  const [klant, setKlant] = useState("");
  const [zoek, setZoek] = useState("");

  const jaren = useMemo(() => [...new Set(projecten.map((p) => p.jaar))].sort((a, b) => b - a), [projecten]);
  const rijen = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return projecten
      .filter((p) => !jaar || String(p.jaar) === jaar)
      .filter((p) => !dienst || p.dienst === dienst)
      .filter((p) => {
        if (!klant) return true;
        const onze = ONZE.has(p.signaal || "");
        if (klant === "onze") return onze;
        if (klant === "prospect") return p.signaal === "prospect";
        return !onze && p.signaal !== "prospect";
      })
      .filter(
        (p) =>
          !z ||
          [p.nr, p.adres, p.bureau_naam, p.architect_code, p.ingenieur].some((v) => (v || "").toLowerCase().includes(z)),
      )
      .sort((a, b) => b.nr.localeCompare(a.nr));
  }, [projecten, jaar, dienst, klant, zoek]);

  const keuze = "rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12.5px]";
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={keuze} value={jaar} onChange={(e) => setJaar(e.target.value)} aria-label="Jaar">
          <option value="">Alle jaren</option>
          {jaren.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <select className={keuze} value={dienst} onChange={(e) => setDienst(e.target.value)} aria-label="Dienst">
          <option value="">Alle diensten</option>
          <option value="STA">Stabiliteit (STA)</option>
          <option value="DRA">Tekenwerk (DRA)</option>
        </select>
        <select className={keuze} value={klant} onChange={(e) => setKlant(e.target.value)} aria-label="Architect">
          <option value="">Alle architecten</option>
          <option value="onze">Onze klanten</option>
          <option value="prospect">In onze B2B-lijst</option>
          <option value="ander">Andere</option>
        </select>
        <input
          className={keuze + " min-w-[220px]"}
          placeholder="Zoek op nummer, adres of architect"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <span className="text-[12px] text-zinc-500">{rijen.length} projecten</span>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="tabel">
          <thead className="sticky top-0" style={{ background: "var(--glas-vol, var(--vlak))" }}>
            <tr>
              <th>Nr</th>
              <th>Dienst</th>
              <th>Soort</th>
              <th>Architect / ingenieur</th>
              <th>Werfadres</th>
              <th>Monday</th>
              <th className="num">Bestanden</th>
              <th className="num">Waarde (schatting)</th>
              <th>Let op</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((p) => (
              <tr key={p.nr}>
                <td className="whitespace-nowrap font-medium">{p.nr}</td>
                <td>{p.dienst || "—"}</td>
                <td className="text-[12.5px]">{p.soort_naam || "—"}</td>
                <td className="text-[12.5px]">
                  {p.bureau_naam ? (
                    <>
                      <a href={`#bureau-${p.bureau}`} className="underline decoration-dotted underline-offset-4" title="Alle projecten van dit bureau">
                        {p.bureau_naam}
                      </a>
                      {!p.bureau_zeker && <span className="text-zinc-400"> (?)</span>}
                      {ONZE.has(p.signaal || "") && <span className="chip kritiek ml-1">onze klant</span>}
                      {p.signaal === "prospect" && <span className="chip accent ml-1">B2B-lijst</span>}
                    </>
                  ) : !p.ingenieur ? (
                    <span className="text-zinc-400">niet vermeld</span>
                  ) : null}
                  {p.ingenieur && (
                    <div>
                      <span className="chip let" title={p.opdrachtgever?.bron === "factuur" ? "uit de factuur op dit projectnummer" : "uit de kolom op Monday"}>
                        ingenieur (OA)
                      </span>{" "}
                      {p.ingenieur}
                    </div>
                  )}
                </td>
                <td className="text-[12.5px]">
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">
                      {p.adres || "map"}
                    </a>
                  ) : (
                    p.adres || "—"
                  )}
                </td>
                <td className="text-[12px]">
                  {p.monday ? (
                    <a href={p.monday.link || "#"} target="_blank" rel="noopener" className="hover:underline">
                      {p.monday.stand || "regel"}
                      {p.monday.uitvoerder ? <span className="text-zinc-500"> · {p.monday.uitvoerder}</span> : null}
                    </a>
                  ) : (
                    <span className="text-zinc-400">geen</span>
                  )}
                </td>
                <td className="num">{p.bestanden ?? "—"}</td>
                <td className="num">{p.schatting ? euro(p.schatting) : "—"}</td>
                <td className="text-[12px]">
                  {p.facturen.map((f) =>
                    f.pdf ? (
                      <a key={f.nr} href={f.pdf} target="_blank" rel="noopener" className="chip let" style={{ textDecoration: "none" }} title={`${f.klant || ""} ${euro(f.bedrag || 0)}`}>
                        factuur ↗
                      </a>
                    ) : (
                      <span key={f.nr} className="chip let" title={`${f.klant || ""} ${euro(f.bedrag || 0)}`}>
                        factuur
                      </span>
                    ),
                  )}
                  {p.monday?.factuur_1 && /gefactureerd/i.test(p.monday.factuur_1) && !p.facturen.length && (
                    <span className="chip" title="Monday zegt gefactureerd, maar er is geen factuur in onze boekhouding">
                      Monday: {p.monday.factuur_1}
                    </span>
                  )}
                  {p.werf_treffers > 0 && <span className="chip kritiek">werf bij ons</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
