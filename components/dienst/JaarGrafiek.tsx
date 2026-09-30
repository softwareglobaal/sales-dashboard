"use client";

// Dit jaar tegenover vorig jaar, per maand. Eén as per grafiek (nooit twee
// schalen): de keuze Omzet/Aanvragen/Gewonnen wisselt de maat, niet de as.
// Kleuren gevalideerd met de dataviz-validator (lichte modus, alle checks PASS):
// dit jaar = staven #2a78d6, vorig jaar = lijn #eb6834 als referentie.

import { useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { euro, euroShort, num } from "@/lib/format";

type Rij = { maand: string; nu: Record<string, number> | null; vorig: Record<string, number> };
const MATEN = [
  { key: "omzet", label: "Omzet" },
  { key: "aanvragen", label: "Aanvragen" },
  { key: "gewonnen", label: "Gewonnen" },
] as const;

export function JaarGrafiek({ rijen, jaar }: { rijen: Rij[]; jaar: number }) {
  const [maat, setMaat] = useState<(typeof MATEN)[number]["key"]>("omzet");
  const data = rijen.map((r) => ({ maand: r.maand, nu: r.nu ? r.nu[maat] : null, vorig: r.vorig[maat] }));
  const fmt = (v: number) => (maat === "omzet" ? euro(v) : num(v));
  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        {MATEN.map((m) => (
          <button key={m.key} className={m.key === maat ? "actief" : ""} onClick={() => setMaat(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="rgba(22,21,15,.08)" />
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
            cursor={{ fill: "rgba(22,21,15,.05)" }}
            formatter={(v: any, naam: any) => [v == null ? "—" : fmt(Number(v)), naam]}
            contentStyle={{ borderRadius: 12, border: "1px solid rgba(22,21,15,.1)", fontSize: 12 }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="nu" name={String(jaar)} fill="#2a78d6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line dataKey="vorig" name={String(jaar - 1)} stroke="#eb6834" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
