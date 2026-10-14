"use client";

import { useMemo, useState } from "react";
import type { BissonProject } from "@/lib/architecten";
import { OmvangChip } from "@/components/architecten/BureauDetail";
import { Vaststelling, type VaststellingWaarde } from "@/components/architecten/Vaststelling";

// Volledige lijst Bisson-projecten met filters. Klein genoeg (enkele honderden regels)
// om alles mee te sturen en in de browser te filteren. Per project: alle opdrachtgevers
// (architect, ingenieur, factuurklant) met hun reden, de omvang, en de vaststelling.

export type Rij = BissonProject & { signaal: string | null; werf_treffers: number };

const ONZE = new Set(["eerst-bij-ons", "beide", "eigen"]);

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function BissonLijst({
  projecten,
  beginJaar = "",
  vast = {},
}: {
  projecten: Rij[];
  beginJaar?: string;
  vast?: Record<string, VaststellingWaarde>;
}) {
  const [jaar, setJaar] = useState(beginJaar);
  const [dienst, setDienst] = useState("");
  const [klant, setKlant] = useState("");
  const [omvang, setOmvang] = useState("");
  const [nakijk, setNakijk] = useState("");
  const [zoek, setZoek] = useState("");

  const jaren = useMemo(() => [...new Set(projecten.map((p) => p.jaar))].sort((a, b) => b - a), [projecten]);
  const rijen = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return projecten
      .filter((p) => !jaar || String(p.jaar) === jaar)
      .filter((p) => !dienst || p.dienst === dienst)
      .filter((p) => !omvang || p.omvang?.klasse === omvang)
      .filter((p) => {
        if (!nakijk) return true;
        const v = vast[`project|${p.nr}`]?.status;
        if (nakijk === "open") return !v;
        if (nakijk === "signaal") return p.nakijken.length > 0;
        return v === nakijk;
      })
      .filter((p) => {
        if (!klant) return true;
        const onze = ONZE.has(p.signaal || "");
        if (klant === "onze") return onze;
        if (klant === "prospect") return p.signaal === "prospect";
        if (klant === "geen") return !p.opdrachtgever;
        return !onze && p.signaal !== "prospect";
      })
      .filter(
        (p) =>
          !z ||
          [p.nr, p.adres, p.architect_code, ...p.partijen.map((x) => x.naam)].some((v) => (v || "").toLowerCase().includes(z)),
      )
      .sort((a, b) => b.nr.localeCompare(a.nr));
  }, [projecten, jaar, dienst, klant, omvang, nakijk, zoek, vast]);

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
        <select className={keuze} value={omvang} onChange={(e) => setOmvang(e.target.value)} aria-label="Omvang">
          <option value="">Elke omvang</option>
          <option value="groot">Groot</option>
          <option value="middel">Middel</option>
          <option value="klein">Klein</option>
        </select>
        <select className={keuze} value={klant} onChange={(e) => setKlant(e.target.value)} aria-label="Opdrachtgever">
          <option value="">Alle opdrachtgevers</option>
          <option value="onze">Onze klanten</option>
          <option value="prospect">In onze B2B-lijst</option>
          <option value="ander">Andere</option>
          <option value="geen">Niet vermeld</option>
        </select>
        <select className={keuze} value={nakijk} onChange={(e) => setNakijk(e.target.value)} aria-label="Vaststelling">
          <option value="">Elke vaststelling</option>
          <option value="open">Nog niet nagelezen</option>
          <option value="signaal">Met een signaal ⚠</option>
          <option value="klopt">Klopt</option>
          <option value="fout gekoppeld">Fout gekoppeld</option>
          <option value="nakijken">Nakijken</option>
        </select>
        <input
          className={keuze + " min-w-[220px]"}
          placeholder="Zoek op nummer, adres of opdrachtgever"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <span className="text-[12px] text-zinc-500">{rijen.length} projecten</span>
      </div>
      <div className="max-h-[720px] overflow-auto">
        <table className="tabel">
          <thead className="sticky top-0" style={{ background: "var(--glas-vol, var(--vlak))", zIndex: 1 }}>
            <tr>
              <th>Nr</th>
              <th>Dienst</th>
              <th>Soort</th>
              <th>Omvang</th>
              <th>Opdrachtgever(s)</th>
              <th>Vaststelling</th>
              <th>Werfadres</th>
              <th>Monday</th>
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
                <td>
                  <OmvangChip o={p.omvang} />
                </td>
                <td className="text-[12.5px]" style={{ minWidth: 200 }}>
                  {p.partijen.length === 0 && <span className="text-zinc-400">niet vermeld</span>}
                  {p.partijen.map((x) => (
                    <div key={x.id} title={x.waarom.join("\n")}>
                      <a href={`#bureau-${x.id}`} className="underline decoration-dotted underline-offset-4">
                        {x.naam}
                      </a>
                      <span className="text-[11px] text-zinc-500"> · {x.rollen.join(", ")}</span>
                    </div>
                  ))}
                  {ONZE.has(p.signaal || "") && <span className="chip kritiek">onze klant</span>}
                  {p.signaal === "prospect" && <span className="chip accent">B2B-lijst</span>}
                </td>
                <td>
                  <Vaststelling sleutel={`project|${p.nr}`} begin={vast[`project|${p.nr}`]} klein />
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
                <td className="num" title={p.omvang?.klasse === "groot" ? "Groot project: de mediaanprijs is een ondergrens" : undefined}>
                  {p.schatting ? `${p.omvang?.klasse === "groot" ? "≥ " : ""}${euro(p.schatting)}` : "—"}
                </td>
                <td className="text-[12px]">
                  {p.nakijken.length > 0 && (
                    <span className="chip let" title={p.nakijken.join("\n")}>
                      ⚠ {p.nakijken.length}
                    </span>
                  )}
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
