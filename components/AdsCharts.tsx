"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { euro, euroShort, num } from "@/lib/format";

// Advertentiekosten per dienst (met markering welke diensten géén ads hebben).
export function SpendByServiceChart({
  data,
}: {
  data: { label: string; spend: number; hasAds: boolean }[];
}) {
  const rows = [...data].sort((a, b) => b.spend - a.spend);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 42)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 24, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => euroShort(Number(v))} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: any) => [euro(Number(v)), "Advertentiekosten"]}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="spend" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.spend > 0 ? "#2563eb" : "#e5e7eb"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Kost per lead vs. advertentiekosten per dienst (alleen diensten met ads-uitgaven).
export function CostPerLeadChart({
  data,
}: {
  data: { label: string; costPerLead: number | null }[];
}) {
  const rows = data.filter((d) => d.costPerLead != null).sort((a, b) => (b.costPerLead || 0) - (a.costPerLead || 0));
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-zinc-400">Nog geen kost-per-lead te berekenen.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 46)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 24, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => euroShort(Number(v))} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [euro(Number(v)), "Kost per lead"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="costPerLead" radius={[0, 4, 4, 0]} fill="#7c3aed" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
