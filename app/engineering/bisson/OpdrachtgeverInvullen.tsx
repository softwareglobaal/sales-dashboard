"use client";

import { useState } from "react";

// Invulveld voor een Bisson-project zonder architect of ingenieur: wie het opzoekt (op adres
// en projectnummer) zet de naam hier. Bewaard via /api/bisson/opdrachtgever; na herladen
// telt het mee bij dat bureau.

export type Ingevuld = { naam: string; soort: string; door: string; op: string } | null | undefined;

const SOORTEN: [string, string][] = [
  ["architect", "Architect"],
  ["ingenieur", "Ingenieur / studiebureau"],
  ["aannemer", "Aannemer"],
  ["overig", "Ander bedrijf"],
];

export function OpdrachtgeverInvullen({ nr, begin, suggesties }: { nr: string; begin: Ingevuld; suggesties: string[] }) {
  const [waarde, setWaarde] = useState<Ingevuld>(begin);
  const [naam, setNaam] = useState(begin?.naam || "");
  const [soort, setSoort] = useState(begin?.soort || "architect");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function bewaar(n: string) {
    setBezig(true);
    setFout(null);
    try {
      const r = await fetch("/api/bisson/opdrachtgever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nr, naam: n, soort }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.status);
      setWaarde(j.ingevuld);
      if (!n) setNaam("");
    } catch (e: any) {
      setFout(String(e?.message || e));
    } finally {
      setBezig(false);
    }
  }

  const veld = "rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[12.5px]";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          className={veld}
          style={{ minWidth: 220 }}
          list={`bureaus-${nr}`}
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Naam architect of ingenieur"
        />
        <datalist id={`bureaus-${nr}`}>
          {suggesties.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <select className={veld} value={soort} onChange={(e) => setSoort(e.target.value)} aria-label="Soort">
          {SOORTEN.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" className="chip donker" style={{ cursor: "pointer" }} disabled={bezig || !naam.trim()} onClick={() => bewaar(naam)}>
          bewaar
        </button>
        {waarde && (
          <button type="button" className="chip" style={{ cursor: "pointer" }} disabled={bezig} onClick={() => bewaar("")}>
            wis
          </button>
        )}
      </div>
      {waarde && (
        <span className="text-[11.5px] text-emerald-700">
          ✓ {waarde.naam} ({SOORTEN.find(([k]) => k === waarde.soort)?.[1] || waarde.soort}) · ingevuld door {waarde.door},{" "}
          {waarde.op.slice(0, 10).split("-").reverse().join("/")}
        </span>
      )}
      {fout && <span className="text-[11.5px] text-red-600">Niet bewaard: {fout}</span>}
    </div>
  );
}
