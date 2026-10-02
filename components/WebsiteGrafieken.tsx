"use client";

// Grafieken van de tab Websites (spec §15). Kleur volgt de site, nooit de rangorde:
// een site houdt zijn kleur uit config/websites.json, ook als er een filter op staat.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { num } from "@/lib/format";

type SiteKleur = { sleutel: string; naam: string; kleur: string };

const as = { fontSize: 11, fill: "#8f8a82" };
const raster = "var(--lijn)";

function datumLabel(d: string) {
  if (d.length === 7) {
    const [j, m] = d.split("-");
    return ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][Number(m) - 1] + " " + j.slice(2);
  }
  const [, m, dag] = d.split("-");
  return `${Number(dag)}/${Number(m)}`;
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const rijen = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div style={{ background: "var(--wit)", border: "1px solid var(--lijn)", borderRadius: 12, padding: "8px 12px", fontSize: 12, boxShadow: "0 10px 24px rgba(22,21,15,.1)" }}>
      <div style={{ color: "var(--inkt-zacht)", marginBottom: 4 }}>{label ? datumLabel(label) : ""}</div>
      {rijen.map((r) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--inkt)" }}>
            <i style={{ width: 10, height: 3, borderRadius: 2, background: r.color, display: "inline-block" }} />
            {r.name}
          </span>
          <b style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{num(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** Bezoekers per dag, één lijn per site. */
export function VergelijkingPerSite({ data, sites }: { data: Record<string, string | number>[]; sites: SiteKleur[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={raster} vertical={false} />
        <XAxis dataKey="d" tick={as} tickFormatter={datumLabel} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={as} width={36} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ stroke: "var(--inkt-vaag)", strokeWidth: 1 }} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {sites.map((s) => (
          <Line key={s.sleutel} dataKey={s.sleutel} name={s.naam} stroke={s.kleur} strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--wit)" }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Bezoekers, sessies en paginaweergaven over de tijd voor één site of alle samen. */
export function KernReeks({ data }: { data: { d: string; bezoekers: number; sessies: number; weergaven: number }[] }) {
  const reeksen = [
    { key: "weergaven", naam: "Paginaweergaven", kleur: "#86b6ef" },
    { key: "sessies", naam: "Sessies", kleur: "#3987e5" },
    { key: "bezoekers", naam: "Bezoekers", kleur: "#1c5cab" },
  ];
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={raster} vertical={false} />
        <XAxis dataKey="d" tick={as} tickFormatter={datumLabel} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={as} width={36} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ stroke: "var(--inkt-vaag)", strokeWidth: 1 }} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {reeksen.map((r) => (
          <Line key={r.key} dataKey={r.key} name={r.naam} stroke={r.kleur} strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--wit)" }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Keuzelijst die de URL-parameter aanpast (pagina en apparaat voor de klikkaart). */
export function ParamKeuze({ naam, waarde, opties, label }: { naam: string; waarde: string; opties: { waarde: string; label: string }[]; label: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-zinc-500">
      {label}
      <select
        value={waarde}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          p.set(naam, e.target.value);
          router.push("?" + p.toString() + "#gedrag", { scroll: false });
        }}
        className="max-w-[320px] rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[12.5px] text-zinc-800"
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Tabel die na `max` rijen inklapt, zodat de pagina overzichtelijk blijft. */
export function InklapTabel({ koppen, rijen, rechts = [], max = 10 }: { koppen: string[]; rijen: React.ReactNode[][]; rechts?: number[]; max?: number }) {
  const [open, setOpen] = useState(false);
  const zichtbaar = open ? rijen : rijen.slice(0, max);
  return (
    <div className="tabelwrap">
      <table className="tabel">
        <thead>
          <tr>{koppen.map((k, i) => <th key={k} className={rechts.includes(i) ? "num" : ""}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {zichtbaar.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={rechts.includes(j) ? "num" : ""}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rijen.length > max && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[12px] text-zinc-600 hover:bg-white">
          {open ? "Minder tonen" : `Toon alle ${rijen.length}`}
        </button>
      )}
    </div>
  );
}
