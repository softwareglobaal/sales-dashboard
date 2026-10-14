"use client";

import { useState } from "react";

// Vaststelling door wie naleest (Matthew, Mehdi, Siyan): klopt / fout gekoppeld / nakijken
// plus een notitie, per Bisson-project of per opdrachtgever. Bewaard via
// /api/bisson/vaststelling; de naam komt uit de login.

export type VaststellingWaarde = { status: string | null; notitie: string | null; door: string; op: string } | undefined;

const KLASSE: Record<string, string> = { klopt: "goed", "fout gekoppeld": "kritiek", nakijken: "let" };

export function Vaststelling({ sleutel, begin, klein = false }: { sleutel: string; begin?: VaststellingWaarde; klein?: boolean }) {
  const [waarde, setWaarde] = useState<VaststellingWaarde>(begin);
  const [open, setOpen] = useState(false);
  const [notitie, setNotitie] = useState(begin?.notitie || "");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function bewaar(status: string | null, n: string) {
    setBezig(true);
    setFout(null);
    try {
      const r = await fetch("/api/bisson/vaststelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleutel, status, notitie: n }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.status);
      setWaarde(j.vaststellingen?.[sleutel]);
      setOpen(false);
    } catch (e: any) {
      setFout(String(e?.message || e));
    } finally {
      setBezig(false);
    }
  }

  const status = waarde?.status || null;
  return (
    <span className="inline-flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex flex-wrap items-center gap-1">
        {(["klopt", "fout gekoppeld", "nakijken"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={bezig}
            onClick={() => bewaar(status === s ? null : s, notitie)}
            className={"chip " + (status === s ? KLASSE[s] : "")}
            style={{ cursor: "pointer", padding: klein ? "2px 8px" : "3px 10px", fontSize: klein ? 11 : 11.5, opacity: status && status !== s ? 0.55 : 1 }}
            title={status === s ? "Klik om te wissen" : `Markeer als ${s}`}
          >
            {s}
          </button>
        ))}
        <button type="button" className="chip" style={{ cursor: "pointer", padding: klein ? "2px 8px" : "3px 10px", fontSize: 11 }} onClick={() => setOpen(!open)}>
          {waarde?.notitie ? "notitie ✎" : "+ notitie"}
        </button>
      </span>
      {waarde && (waarde.status || waarde.notitie) && !open && (
        <span className="text-[11px] text-zinc-500">
          {waarde.notitie ? `“${waarde.notitie}” · ` : ""}
          {waarde.door}, {waarde.op.slice(0, 10).split("-").reverse().join("/")}
        </span>
      )}
      {open && (
        <span className="inline-flex flex-wrap items-center gap-1">
          <input
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[12px]"
            style={{ minWidth: 220 }}
            value={notitie}
            onChange={(e) => setNotitie(e.target.value)}
            placeholder="Wat klopt er (niet)?"
          />
          <button type="button" className="chip donker" style={{ cursor: "pointer" }} disabled={bezig} onClick={() => bewaar(status, notitie)}>
            bewaar
          </button>
        </span>
      )}
      {fout && <span className="text-[11px] text-red-600">Niet bewaard: {fout}</span>}
    </span>
  );
}
