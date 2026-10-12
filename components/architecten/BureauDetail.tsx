"use client";

// Detail van één architectenbureau: elk project bij onze firma's (met dienst, firma en
// een link naar de deal, de factuur, de map of Monday) en, voor de directie, elk project
// dat via Bisson liep. Gedeeld door /architecten en /engineering/bisson.
// Filterbaar per jaar: de knoppen bovenaan tonen enkel de jaren waarin er iets gebeurde.

import { useState } from "react";
import type { Architect, BissonProject, ProjectBron } from "@/lib/architecten";

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function datum(d: string | null | undefined) {
  if (!d) return "—";
  if (d.endsWith("-01-01")) return d.slice(0, 4);
  return d.slice(0, 10).split("-").reverse().join("/");
}

const LABEL: Record<string, string> = { Pipedrive: "deal", Octopus: "factuur", Dropbox: "map", Monday: "Monday" };

function Bron({ b }: { b: ProjectBron }) {
  const nr = b.bron === "Octopus" ? (b.ref || "").split(" ").pop() : "";
  const tekst = `${LABEL[b.bron] || b.bron}${nr ? " " + nr : ""}`;
  const tip = [b.ref, b.omschrijving, b.gefactureerd != null ? euro(b.gefactureerd) : null].filter(Boolean).join(" · ");
  return b.link ? (
    <a href={b.link} target="_blank" rel="noopener" className="chip accent" title={tip} style={{ textDecoration: "none" }}>
      {tekst} ↗
    </a>
  ) : (
    <span className="chip" title={tip}>
      {tekst}
    </span>
  );
}

export function jaarVan(d: string | null | undefined): string {
  return (d || "").slice(0, 4);
}

export function OnzeProjecten({
  projecten,
  toonBissonNr = false,
}: {
  projecten: Architect["projecten"];
  toonBissonNr?: boolean;
}) {
  if (!projecten.length) return <p className="text-[12.5px] text-zinc-500">Geen project bij onze firma&apos;s in deze periode.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Projectnr</th>
            <th>Werfadres</th>
            <th>Firma</th>
            <th>Dienst</th>
            <th className="num">Verkocht</th>
            <th className="num">Gefactureerd</th>
            <th>Openen</th>
          </tr>
        </thead>
        <tbody>
          {projecten.map((p, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{datum(p.datum)}</td>
              <td className="whitespace-nowrap">
                {p.projectnrs.join(", ") || "—"}
                {toonBissonNr && p.bisson_nummer && <span className="chip let ml-1">Bisson-nr</span>}
              </td>
              <td className="text-[12.5px]">
                {p.zonder_verwijzing ? (
                  <span className="text-zinc-500">facturen zonder projectverwijzing ({p.datum?.slice(0, 4)})</span>
                ) : (
                  p.adres || "—"
                )}
              </td>
              <td className="text-[12.5px]">{p.firmas.join(", ")}</td>
              <td className="text-[12.5px]">{p.diensten.join(", ") || "—"}</td>
              <td className="num">{p.verkocht ? euro(p.verkocht) : "—"}</td>
              <td className="num">{p.gefactureerd ? euro(p.gefactureerd) : "—"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.bronnen.map((b, j) => (
                    <Bron key={j} b={b} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BissonProjecten({ projecten }: { projecten: BissonProject[] }) {
  if (!projecten.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Nr</th>
            <th>Start</th>
            <th>Dienst</th>
            <th>Soort</th>
            <th>Werfadres</th>
            <th>Ingenieur (OA)</th>
            <th>Stand op Monday</th>
            <th>Openen</th>
          </tr>
        </thead>
        <tbody>
          {projecten.map((p) => (
            <tr key={p.nr}>
              <td className="font-medium">{p.nr}</td>
              <td className="whitespace-nowrap">{datum(p.datum)}</td>
              <td>{p.dienst_naam || "—"}</td>
              <td className="text-[12.5px]">{p.soort_naam || "—"}</td>
              <td className="text-[12.5px]">{p.adres || "—"}</td>
              <td className="text-[12.5px]">{p.ingenieur || "—"}</td>
              <td className="text-[12.5px]">{p.monday?.stand || "—"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener" className="chip accent" style={{ textDecoration: "none" }}>
                      map ↗
                    </a>
                  )}
                  {p.monday?.link && (
                    <a href={p.monday.link} target="_blank" rel="noopener" className="chip accent" style={{ textDecoration: "none" }}>
                      Monday ↗
                    </a>
                  )}
                  {p.facturen.map((f) =>
                    f.pdf ? (
                      <a key={f.nr} href={f.pdf} target="_blank" rel="noopener" className="chip let" style={{ textDecoration: "none" }} title={`${f.klant} ${euro(f.bedrag || 0)}`}>
                        factuur {f.nr.split("/").pop()} ↗
                      </a>
                    ) : (
                      <span key={f.nr} className="chip let" title={`${f.klant} ${euro(f.bedrag || 0)}`}>
                        factuur {f.nr.split("/").pop()}
                      </span>
                    ),
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Beide lijsten onder elkaar, met jaarknoppen bovenaan. */
export function BureauDetail({ a, bisson, jaar: beginJaar = "" }: { a: Architect; bisson?: BissonProject[]; jaar?: string }) {
  const [jaar, setJaar] = useState(beginJaar);
  const jaren = [
    ...new Set([...a.projecten.map((p) => jaarVan(p.datum)), ...(bisson || []).map((p) => String(p.jaar))].filter(Boolean)),
  ].sort((x, y) => y.localeCompare(x));
  const ons = a.projecten.filter((p) => !jaar || jaarVan(p.datum) === jaar);
  const bis = (bisson || []).filter((p) => !jaar || String(p.jaar) === jaar);
  const telOns = ons.filter((p) => !p.zonder_verwijzing).length;
  const knop = (waarde: string, label: string) => (
    <button
      key={label}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setJaar(waarde);
      }}
      className={jaar === waarde ? "chip donker" : "chip"}
      style={{ padding: "4px 11px", fontSize: 12, cursor: "pointer" }}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-zinc-500">Jaar:</span>
        {knop("", "Alle")}
        {jaren.map((j) => knop(j, j))}
      </div>
      {a.namen.length > 0 && <div className="text-[12px] text-zinc-500">Staat in onze systemen als: {a.namen.join(" · ")}</div>}
      <div>
        <div className="label mb-1">
          Bij onze firma&apos;s{jaar ? ` in ${jaar}` : ""} · {telOns} project{telOns === 1 ? "" : "en"}
        </div>
        <OnzeProjecten projecten={ons} toonBissonNr={!!bisson} />
      </div>
      {bisson && bisson.length > 0 && (
        <div>
          <div className="label mb-1">
            Via Studiebureau Bisson{jaar ? ` in ${jaar}` : ""} · {bis.length} projecten
          </div>
          {bis.length ? <BissonProjecten projecten={bis} /> : <p className="text-[12.5px] text-zinc-500">Geen Bisson-project in deze periode.</p>}
        </div>
      )}
    </div>
  );
}
