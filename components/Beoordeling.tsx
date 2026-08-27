"use client";

import { useState } from "react";

const KEUZES = [
  { key: "prospect", label: "Prospect", kleur: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "geen-prospect", label: "Geen", kleur: "bg-zinc-200 text-zinc-700 border-zinc-400" },
  { key: "concurrent", label: "Concurrent", kleur: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "klant", label: "Klant", kleur: "bg-blue-100 text-blue-800 border-blue-300" },
];

/**
 * Knopjes om een automatische indeling te corrigeren. Klikken op het actieve
 * oordeel zet het terug op automatisch.
 */
export function Beoordeling({
  soort,
  sleutel,
  huidig,
}: {
  soort: "verslaggever" | "domein";
  sleutel: string;
  huidig: string | null;
}) {
  const [waarde, setWaarde] = useState<string | null>(huidig);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function kies(oordeel: string) {
    const nieuw = waarde === oordeel ? "" : oordeel;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/concurrentie/beoordeel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soort, sleutel, oordeel: nieuw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setWaarde(nieuw || null);
    } catch (e) {
      setFout((e as Error).message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {KEUZES.map((k) => (
        <button
          key={k.key}
          onClick={() => kies(k.key)}
          disabled={bezig}
          title={waarde === k.key ? "Klik nogmaals om terug te zetten op automatisch" : undefined}
          className={
            "rounded border px-1.5 py-0.5 text-[11px] transition disabled:opacity-50 " +
            (waarde === k.key ? k.kleur : "border-transparent text-zinc-400 hover:border-zinc-300 hover:text-zinc-700")
          }
        >
          {k.label}
        </button>
      ))}
      {fout && <span className="text-[11px] text-red-600" title={fout}>niet gelukt</span>}
    </div>
  );
}
