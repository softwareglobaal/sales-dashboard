"use client";

import { useEffect, useState } from "react";
import type { Architect, BissonProject, Contact, NietBinnen } from "@/lib/architecten";
import { BureauDetail, jaarVan } from "@/components/architecten/BureauDetail";
import type { VaststellingWaarde } from "@/components/architecten/Vaststelling";

// Uitklapbare lijst opdrachtgevers op de Bisson-pagina: klik een bureau open en zie elk
// project bij onze firma's (dienst, firma, deal, factuur, map, en waarom het aan dit bureau
// hangt) naast elk Bisson-project, de niet binnengehaalde deals en de contactpersonen.
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
  extra = {},
  vast = {},
}: {
  bureaus: Architect[];
  bisson: Record<string, BissonProject[]>;
  extra?: Record<string, { nietBinnen: NietBinnen[]; contacten: Contact[] }>;
  vast?: Record<string, VaststellingWaarde>;
  metOns: boolean; // kolommen voor "bij ons" tonen (overlap) of enkel Bisson
  anker?: string; // id-voorvoegsel: #bureau-<id> opent het bureau in deze tabel
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [jaar, setJaar] = useState("");
  const jaren = [
    ...new Set([
      ...bureaus.flatMap((b) => (metOns ? b.projecten.map((p) => jaarVan(p.datum)) : [])),
      ...bureaus.flatMap((b) => (bisson[b.id] || []).map((p) => String(p.jaar))),
    ].filter(Boolean)),
  ].sort((x, y) => y.localeCompare(x));
  const telOns = (b: Architect) =>
    b.projecten.filter((p) => !p.zonder_verwijzing && (!jaar || jaarVan(p.datum) === jaar)).length;
  const telLos = (b: Architect) =>
    b.projecten.filter((p) => p.zonder_verwijzing && (!jaar || jaarVan(p.datum) === jaar)).reduce((t, p) => t + p.bronnen.length, 0);
  const telBis = (b: Architect) => (bisson[b.id] || []).filter((p) => !jaar || String(p.jaar) === jaar).length;
  const zichtbaar = bureaus.filter((b) => !jaar || telBis(b) > 0 || (metOns && telOns(b) > 0));

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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select
          className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12.5px]"
          value={jaar}
          onChange={(e) => setJaar(e.target.value)}
          aria-label="Jaar"
        >
          <option value="">Alle jaren</option>
          {jaren.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-zinc-500">
          {zichtbaar.length} bureaus{jaar ? ` met een project in ${jaar}` : ""} · klik een bureau voor de projecten
        </span>
      </div>
      <table className="tabel">
        <thead>
          <tr>
            <th>Bureau</th>
            <th>Status bij ons</th>
            {metOns && <th>Bij ons</th>}
            {metOns && <th className="num">Projecten bij ons{jaar ? ` (${jaar})` : ""}</th>}
            {metOns && <th>Periode bij ons</th>}
            {!metOns && <th>Code in de map</th>}
            <th className="num">Via Bisson{jaar ? ` (${jaar})` : ""}</th>
            <th>Periode Bisson</th>
            {metOns ? <th className="num">Bij ons na 1e Bisson</th> : <th />}
          </tr>
        </thead>
        <tbody>
          {zichtbaar.map((x) => {
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
                  <div className="text-[11.5px] text-zinc-500">
                    {x.soort_label}
                    {vast[`bureau|${x.id}`]?.status && <span className="chip ml-1" style={{ fontSize: 10.5 }}>{vast[`bureau|${x.id}`]!.status}</span>}
                  </div>
                </td>
                <td>{s && <span className={"chip " + s[1]}>{s[0]}</span>}</td>
                {metOns && (
                  <td className="text-[12.5px]">
                    {x.firmas.join(", ")}
                    <div className="text-zinc-500">{x.diensten.join(", ")}</div>
                  </td>
                )}
                {metOns && (
                  <td className="num">
                    {telOns(x)}
                    {telLos(x) > 0 && (
                      <div className="text-[11px] font-normal text-zinc-500" title="facturen zonder projectnummer of werf">
                        + {telLos(x)} fact.
                      </div>
                    )}
                  </td>
                )}
                {metOns && (
                  <td className="whitespace-nowrap">
                    {maandJaar(x.eerste_bij_ons)} – {maandJaar(x.laatste_bij_ons)}
                  </td>
                )}
                {!metOns && <td className="text-[12px] text-zinc-500">{x.codes.join(", ")}</td>}
                <td className="num font-medium">{telBis(x)}</td>
                <td className="whitespace-nowrap">
                  {maandJaar(x.eerste_bisson)} – {maandJaar(x.laatste_bisson)}
                </td>
                <td className="num">{metOns ? x.bij_ons_na_eerste_bisson ?? "—" : ""}</td>
              </tr>,
              isOpen && (
                <tr key={x.id + "-detail"}>
                  <td colSpan={kolommen} style={{ background: "var(--vlak)" }}>
                    <BureauDetail
                      key={jaar}
                      a={x}
                      bisson={bisson[x.id] || []}
                      jaar={jaar}
                      nietBinnen={extra[x.id]?.nietBinnen}
                      contacten={extra[x.id]?.contacten}
                      vast={vast}
                    />
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
