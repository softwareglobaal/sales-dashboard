"use client";

// Dit jaar tegenover vorig jaar, per maand, gestapeld per bron (bv. Energy: UNABO,
// EE-campagne, EE onderaanneming), zoals de verdeling op het Monday-bord. Eén as per
// grafiek (nooit twee schalen): de keuze Omzet/Aanvragen/Gewonnen wisselt de maat.
// Kleuren gevalideerd met de dataviz-validator (lichte modus): bronnen in vaste
// volgorde #2a78d6, #eb6834, #1baf7a (alle checks PASS, aqua heeft een contrast-WARN:
// daarom altijd legende + tooltip met de getallen). Vorig jaar = gestippelde
// neutrale lijn als referentie, geen categoriekleur.

import { useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { euro, euroShort, num } from "@/lib/format";

type Maten = { omzet: number; aanvragen: number; gewonnen: number };
export type GrafiekRij = { maand: string; nu: Record<string, Maten> | null; vorig: Maten };
export type GrafiekBron = { key: string; label: string };

const KLEUREN = ["#2a78d6", "#eb6834", "#1baf7a"];
const VORIG = "var(--inkt-zacht)"; // neutrale referentielijn, leesbaar in licht en donker
const MATEN = [
  { key: "omzet", label: "Omzet" },
  { key: "aanvragen", label: "Aanvragen" },
  { key: "gewonnen", label: "Gewonnen" },
] as const;

export function JaarGrafiek({ rijen, jaar, bronnen }: { rijen: GrafiekRij[]; jaar: number; bronnen: GrafiekBron[] }) {
  const [maat, setMaat] = useState<(typeof MATEN)[number]["key"]>("omzet");
  const data = rijen.map((r) => {
    const punt: Record<string, string | number | null> = { maand: r.maand, vorig: r.vorig[maat] };
    for (const b of bronnen) punt[b.key] = r.nu ? r.nu[b.key]?.[maat] ?? 0 : null;
    return punt;
  });
  const fmt = (v: number) => (maat === "omzet" ? euro(v) : num(v));
  const zichtbaar = bronnen.slice(0, KLEUREN.length);

  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        {MATEN.map((m) => (
          <button key={m.key} className={m.key === maat ? "actief" : ""} onClick={() => setMaat(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--lijn)" />
          <XAxis dataKey="maand" tick={{ fontSize: 11, fill: "#8f8a82" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#8f8a82" }}
            axisLine={false}
            tickLine={false}
            width={48}
            allowDecimals={false}
            tickFormatter={(v) => (maat === "omzet" ? euroShort(Number(v)) : num(Number(v)))}
          />
          <Tooltip
            cursor={{ fill: "var(--vlak)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const nu = payload.filter((p) => p.dataKey !== "vorig" && p.value != null);
              const som = nu.reduce((s, p) => s + Number(p.value || 0), 0);
              const vorig = payload.find((p) => p.dataKey === "vorig")?.value;
              return (
                <div style={{ background: "var(--wit)", color: "var(--inkt)", border: "1px solid var(--lijn)", borderRadius: 12, padding: "8px 12px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  {nu.map((p) => (
                    <div key={String(p.dataKey)} style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                      <span>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />
                        {p.name}
                      </span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(Number(p.value))}</span>
                    </div>
                  ))}
                  {nu.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(22,21,15,.1)", marginTop: 4, paddingTop: 4, fontWeight: 600 }}>
                      <span>Totaal {jaar}</span>
                      <span>{fmt(som)}</span>
                    </div>
                  )}
                  {vorig != null && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--inkt-zacht)", marginTop: 2 }}>
                      <span>Totaal {jaar - 1}</span>
                      <span>{fmt(Number(vorig))}</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          {zichtbaar.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              stackId="nu"
              fill={KLEUREN[i]}
              stroke="var(--grond)"
              strokeWidth={zichtbaar.length > 1 ? 2 : 0}
              radius={i === zichtbaar.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="vorig"
            name={`Totaal ${jaar - 1}`}
            stroke={VORIG}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: VORIG }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
