"use client";

import { useEffect, useState } from "react";
import type { Architect, BissonProject } from "@/lib/architecten";
import { BureauDetail } from "@/components/architecten/BureauDetail";

// Uitklapbare lijst bureaus op de Bisson-pagina: klik een bureau open en zie elk project
// bij onze firma's (dienst, firma, deal, factuur, map) naast elk Bisson-project.
// Een link #bureau-<id> (vanuit de projectlijst) opent meteen dat bureau.

const SIGNAAL: Record<string, [string, string]> = {
  "eerst-bij-ons": ["Eerst bij ons, nu via Bisson", "kritiek"],
  eigen: ["Eigen firma via Bisson", "kritiek"],
  beide: ["Klant bij ons én via Bisson", "let"],
  prospect: ["In onze B2B-lijst", "accent"],
  "enkel-bisson": ["Enkel via Bisson", ""],
};

function maandJaar(d: string | null | undefined) {
  if (!d) return "—";
  const [j, m] = d.split("-");
  return !m || d.endsWith("-01-01") ? j : `${m}/${j}`;
}

export function BureauTabel({
  bureaus,
  bisson,
  metOns,
  anker = "bureau",
}: {
  bureaus: Architect[];
  bisson: Record<string, BissonProject[]>;
  metOns: boolean; // kolommen voor "bij ons" tonen (overlap) of enkel Bisson
  anker?: string; // id-voorvoegsel: #bureau-<id> opent het bureau in deze tabel
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const lees = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      const id = h.slice(anker.length + 1);
      if (h.startsWith(anker + "-") && bureaus.some((b) => b.id === id)) {
        setOpen(id);
        setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
      }
    };
    lees();
    window.addEventListener("hashchange", lees);
    return () => window.removeEventListener("hashchange", lees);
  }, [bureaus, anker]);

  const kolommen = metOns ? 8 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Bureau</th>
            <th>Status bij ons</th>
            {metOns && <th>Bij ons</th>}
            {metOns && <th className="num">Projecten bij ons</th>}
            {metOns && <th>Periode bij ons</th>}
            {!metOns && <th>Code in de map</th>}
            <th className="num">Via Bisson</th>
            <th>Periode Bisson</th>
            {metOns ? <th className="num">Bij ons na 1e Bisson</th> : <th />}
          </tr>
        </thead>
        <tbody>
          {bureaus.map((x) => {
            const isOpen = open === x.id;
            const s = x.signaal ? SIGNAAL[x.signaal] : null;
            return [
              <tr
                key={x.id}
                id={`${anker}-${x.id}`}
                onClick={() => setOpen(isOpen ? null : x.id)}
                style={{ cursor: "pointer", scrollMarginTop: 120 }}
                title="Klik voor elk project"
              >
                <td>
                  <span className="mr-1 inline-block w-3 text-zinc-400">{isOpen ? "▾" : "▸"}</span>
                  <span className="font-medium underline decoration-dotted underline-offset-4">{x.naam}</span>
                  {x.plaats && <span className="text-zinc-500"> · {x.plaats}</span>}
                  {!x.zeker && <span className="chip ml-2" title="De code in de map is niet eenduidig aan één bureau te hangen">te bevestigen</span>}
                </td>
                <td>{s && <span className={"chip " + s[1]}>{s[0]}</span>}</td>
                {metOns && (
                  <td className="text-[12.5px]">
                    {x.firmas.join(", ")}
                    <div className="text-zinc-500">{x.diensten.join(", ")}</div>
                  </td>
                )}
                {metOns && <td className="num">{x.aantal_projecten}</td>}
                {metOns && (
                  <td className="whitespace-nowrap">
                    {maandJaar(x.eerste_bij_ons)} – {maandJaar(x.laatste_bij_ons)}
                  </td>
                )}
                {!metOns && <td className="text-[12px] text-zinc-500">{x.codes.join(", ")}</td>}
                <td className="num font-medium">{x.aantal_bisson}</td>
                <td className="whitespace-nowrap">
                  {maandJaar(x.eerste_bisson)} – {maandJaar(x.laatste_bisson)}
                </td>
                <td className="num">{metOns ? x.bij_ons_na_eerste_bisson ?? "—" : ""}</td>
              </tr>,
              isOpen && (
                <tr key={x.id + "-detail"}>
                  <td colSpan={kolommen} style={{ background: "var(--vlak)" }}>
                    <BureauDetail a={x} bisson={bisson[x.id] || []} />
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
