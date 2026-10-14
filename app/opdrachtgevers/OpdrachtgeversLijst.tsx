"use client";

import { useEffect, useMemo, useState } from "react";
import type { Architect, BissonProject, Contact, NietBinnen } from "@/lib/architecten";
import { BureauDetail, jaarVan } from "@/components/architecten/BureauDetail";

// Tabel van opdrachtgevers (architecten, ingenieurs, studiebureaus, ...) met filters en een
// uitklapbare projectlijst per bureau: waarom elk project aan het bureau hangt, de
// contactpersonen en de deals die niet binnengehaald werden.

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

export function OpdrachtgeversLijst({
  architecten,
  directie: toonBisson,
  firmas,
  bisson,
  extra = {},
  soorten,
}: {
  architecten: Architect[];
  directie: boolean;
  firmas: string[];
  bisson?: Record<string, BissonProject[]>;
  extra?: Record<string, { nietBinnen: NietBinnen[]; contacten: Contact[] }>;
  soorten: { soort: string; label: string; n: number }[];
}) {
  const [soort, setSoort] = useState("");
  const [firma, setFirma] = useState("");
  const [dienst, setDienst] = useState("");
  const [zoek, setZoek] = useState("");
  const [jaar, setJaar] = useState("");
  // Per jaar: wat dit bureau dat jaar bij ons (en via Bisson) deed.
  const inJaar = (a: Architect) => a.projecten.filter((p) => !jaar || jaarVan(p.datum) === jaar);
  const bisJaar = (a: Architect) => (bisson?.[a.id] || []).filter((p) => !jaar || String(p.jaar) === jaar).length;
  const jaren = useMemo(
    () =>
      [
        ...new Set(
          [
            ...architecten.flatMap((a) => a.projecten.map((p) => jaarVan(p.datum))),
            ...Object.values(bisson || {}).flatMap((l) => l.map((p) => String(p.jaar))),
          ].filter(Boolean),
        ),
      ].sort((x, y) => y.localeCompare(x)),
    [architecten, bisson],
  );
  const [open, setOpen] = useState<string | null>(null);

  // Een link als /opdrachtgevers#mv2 opent meteen dat bureau.
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
      .filter((a) => !soort || a.soort === soort)
      .filter((a) => !firma || a.firmas.includes(firma))
      .filter((a) => !dienst || a.diensten.includes(dienst))
      .filter((a) => !jaar || inJaar(a).length > 0 || (toonBisson && bisJaar(a) > 0))
      .filter(
        (a) =>
          !z ||
          [a.naam, a.plaats, ...a.namen, ...a.projecten.flatMap((p) => [...p.projectnrs, ...p.adressen])].some((v) =>
            (v || "").toLowerCase().includes(z),
          ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [architecten, soort, firma, dienst, zoek, jaar]);

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
        <select className={keuze} value={soort} onChange={(e) => setSoort(e.target.value)} aria-label="Soort">
          <option value="">Alle soorten</option>
          {soorten.map((x) => (
            <option key={x.soort} value={x.soort}>
              {x.label} ({x.n})
            </option>
          ))}
        </select>
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
              <th className="num">Projecten{jaar ? ` (${jaar})` : ""}</th>
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
                    <div className="text-[11.5px] text-zinc-500">{a.soort_label}</div>
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
                    {inJaar(a).filter((p) => !p.zonder_verwijzing).length}
                    {inJaar(a).some((p) => p.zonder_verwijzing) && (
                      <span className="text-[11px] font-normal text-zinc-400" title="plus facturen zonder projectverwijzing"> +</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {maandJaar(a.eerste_bij_ons)} – {maandJaar(a.laatste_bij_ons)}
                  </td>
                  <td className="num">{(() => { const v = inJaar(a).reduce((t, p) => t + p.verkocht, 0); return v ? euro(v) : "—"; })()}</td>
                  <td className="num">{(() => { const v = inJaar(a).reduce((t, p) => t + p.gefactureerd, 0); return v ? euro(v) : "—"; })()}</td>
                  {toonBisson && (
                    <td className="num">
                      {bisJaar(a) ? (
                        <span className={"chip " + (s?.[1] || "")} title={s?.[0]}>
                          {bisJaar(a)}
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
                      <BureauDetail
                        key={jaar}
                        a={a}
                        bisson={toonBisson ? bisson?.[a.id] || [] : undefined}
                        jaar={jaar}
                        nietBinnen={extra[a.id]?.nietBinnen}
                        contacten={extra[a.id]?.contacten}
                      />
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
