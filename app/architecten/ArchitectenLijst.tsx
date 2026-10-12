"use client";

import { useEffect, useMemo, useState } from "react";
import type { Architect, BissonProject } from "@/lib/architecten";
import { BureauDetail } from "@/components/architecten/BureauDetail";

// Tabel van architect-klanten met filters en een uitklapbare projectlijst per bureau.

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function maandJaar(d: string | null | undefined) {
  if (!d) return "—";
  const [j, m] = d.split("-");
  return !m || d.endsWith("-01-01") ? j : `${m}/${j}`;
}

const SIGNAAL: Record<string, [string, string]> = {
  "eerst-bij-ons": ["Eerst bij ons, nu via Bisson", "kritiek"],
  beide: ["Ook via Bisson", "let"],
};

export function ArchitectenLijst({
  architecten,
  directie: toonBisson,
  firmas,
  bisson,
}: {
  architecten: Architect[];
  directie: boolean;
  firmas: string[];
  bisson?: Record<string, BissonProject[]>;
}) {
  const [firma, setFirma] = useState("");
  const [dienst, setDienst] = useState("");
  const [zoek, setZoek] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Een link als /architecten#mv2 opent meteen dat bureau.
  useEffect(() => {
    const lees = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) {
        setOpen(id);
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
      }
    };
    lees();
    window.addEventListener("hashchange", lees);
    return () => window.removeEventListener("hashchange", lees);
  }, []);

  const diensten = useMemo(() => [...new Set(architecten.flatMap((a) => a.diensten))].sort(), [architecten]);
  const rijen = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return architecten
      .filter((a) => !firma || a.firmas.includes(firma))
      .filter((a) => !dienst || a.diensten.includes(dienst))
      .filter(
        (a) =>
          !z ||
          [a.naam, a.plaats, ...a.namen, ...a.projecten.flatMap((p) => [...p.projectnrs, ...p.adressen])].some((v) =>
            (v || "").toLowerCase().includes(z),
          ),
      );
  }, [architecten, firma, dienst, zoek]);

  const keuze = "rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12.5px]";
  const kolommen = toonBisson ? 8 : 7;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={keuze} value={firma} onChange={(e) => setFirma(e.target.value)} aria-label="Firma">
          <option value="">Alle firma&apos;s</option>
          {firmas.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select className={keuze} value={dienst} onChange={(e) => setDienst(e.target.value)} aria-label="Dienst">
          <option value="">Alle diensten</option>
          {diensten.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          className={keuze + " min-w-[260px]"}
          placeholder="Zoek op bureau, adres of projectnummer"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <span className="text-[12px] text-zinc-500">{rijen.length} bureaus</span>
      </div>
      <div className="overflow-x-auto">
        <table className="tabel">
          <thead>
            <tr>
              <th>Bureau</th>
              <th>Firma&apos;s</th>
              <th>Diensten</th>
              <th className="num">Projecten</th>
              <th>Eerste – laatste</th>
              <th className="num">Verkocht</th>
              <th className="num">Gefactureerd</th>
              {toonBisson && <th className="num">Via Bisson</th>}
            </tr>
          </thead>
          <tbody>
            {rijen.map((a) => {
              const isOpen = open === a.id;
              const s = a.signaal ? SIGNAAL[a.signaal] : null;
              return [
                <tr key={a.id} id={a.id} onClick={() => setOpen(isOpen ? null : a.id)} style={{ cursor: "pointer", scrollMarginTop: 120 }} title="Klik voor elk project">
                  <td>
                    <span className="mr-1 inline-block w-3 text-zinc-400">{isOpen ? "▾" : "▸"}</span>
                    <span className="font-medium">{a.naam}</span>
                    {a.plaats && <span className="text-zinc-500"> · {a.plaats}</span>}
                    {!a.zeker && <span className="chip ml-2">te bevestigen</span>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {a.firmas.map((f) => (
                        <span key={f} className="chip">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-[12.5px]">{a.diensten.join(", ")}</td>
                  <td className="num font-medium">
                    {a.aantal_projecten}
                    {a.projecten.some((p) => p.zonder_verwijzing) && (
                      <span className="text-[11px] font-normal text-zinc-400" title="plus facturen zonder projectverwijzing"> +</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {maandJaar(a.eerste_bij_ons)} – {maandJaar(a.laatste_bij_ons)}
                  </td>
                  <td className="num">{a.verkocht ? euro(a.verkocht) : "—"}</td>
                  <td className="num">{a.gefactureerd ? euro(a.gefactureerd) : "—"}</td>
                  {toonBisson && (
                    <td className="num">
                      {a.aantal_bisson ?? 0 ? (
                        <span className={"chip " + (s?.[1] || "")} title={s?.[0]}>
                          {a.aantal_bisson}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>,
                isOpen && (
                  <tr key={a.id + "-detail"}>
                    <td colSpan={kolommen} style={{ background: "var(--vlak)" }}>
                      <BureauDetail a={a} bisson={toonBisson ? bisson?.[a.id] || [] : undefined} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
