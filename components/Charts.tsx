"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Cell,
  ComposedChart,
} from "recharts";
import { euroShort, euro, num } from "@/lib/format";

type Account = { key: string; name: string; color: string };

// Leadinstroom per maand (aantallen)
export function LeadsByMonthChart({
  data,
  accounts,
}: {
  data: Record<string, number | string>[];
  accounts: Account[];
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
        <Tooltip formatter={(v: any) => `${num(Number(v))} leads`} />
        <Legend />
        {accounts.map((a) => (
          <Line
            key={a.key}
            type="monotone"
            dataKey={a.key}
            name={a.name}
            stroke={a.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Open vs gewonnen waarde per account
export function ValueByAccountChart({
  data,
}: {
  data: { name: string; openValue: number; wonValue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => euroShort(Number(v))} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={(v: any) => euro(Number(v))} />
        <Legend />
        <Bar dataKey="openValue" name="Open waarde" fill="#93c5fd" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="wonValue" name="Gewonnen waarde" fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Omzet per afdeling (horizontale balken, gewonnen omzet)
export function DepartmentChart({
  data,
}: {
  data: { department: string; wonRevenue: number; unassigned: boolean }[];
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen productdata voor deze periode.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 60, left: 8, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => euroShort(Number(v))} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="department" width={150} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => euro(Number(v))} />
        <Bar dataKey="wonRevenue" name="Gewonnen omzet" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.unassigned ? "#dc2626" : "#16a34a"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Engineering: aanvragen (balk) + omzet (lijn) per maand
export function EngineeringTrendChart({
  data,
}: {
  data: { month: string; requests: number; revenue: number }[];
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen data voor deze periode.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(v) => euroShort(Number(v))}
          tick={{ fontSize: 11 }}
          width={55}
        />
        <Tooltip
          formatter={(v: any, _name: any, item: any) =>
            item?.dataKey === "revenue"
              ? [euro(Number(v)), "Omzet (zelfde maand)"]
              : [`${num(Number(v))} aanvragen`, "Aanvragen"]
          }
        />
        <Legend />
        <Bar yAxisId="left" dataKey="requests" name="Aanvragen (binnengekomen)" fill="#93c5fd" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Line yAxisId="right" type="monotone" dataKey="revenue" name="Omzet (zelfde maand gewonnen)" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Eén kolomreeks in Pipedrive Insights-stijl
function InsightBars({
  data,
  dataKey,
  name,
  color,
  euroFmt,
}: {
  data: any[];
  dataKey: string;
  name: string;
  color: string;
  euroFmt?: boolean;
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen data voor deze periode.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={euroFmt ? 52 : 36}
          tickFormatter={euroFmt ? (v) => euroShort(Number(v)) : undefined}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
          formatter={(v: any) => [euroFmt ? euro(Number(v)) : num(Number(v)), name]}
        />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={38} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RequestsBarChart({ data }: { data: any[] }) {
  return <InsightBars data={data} dataKey="requests" name="Aanvragen" color="#3b82f6" />;
}

export function LostBarChart({ data }: { data: any[] }) {
  return <InsightBars data={data} dataKey="lostCount" name="Verloren" color="#f0645d" />;
}

export function WonBarChart({ data }: { data: any[] }) {
  const [metric, setMetric] = useState<"count" | "value">("count");
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="inline-flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          {(["count", "value"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={
                "rounded-md px-3 py-1 text-sm font-medium transition " +
                (metric === m ? "bg-zinc-800 text-white" : "text-zinc-600 hover:bg-zinc-100")
              }
            >
              {m === "count" ? "Aantal" : "Waarde"}
            </button>
          ))}
        </div>
      </div>
      <InsightBars
        data={data}
        dataKey={metric === "count" ? "wonCount" : "wonValue"}
        name={metric === "count" ? "Gewonnen (aantal)" : "Gewonnen (waarde)"}
        color="#22a06b"
        euroFmt={metric === "value"}
      />
    </div>
  );
}

// Aanvragen per kanaal (gestapelde horizontale balk: gewonnen/open/verloren)
export function ChannelChart({
  data,
}: {
  data: { channel: string; won: number; open: number; lost: number }[];
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen aanvragen in deze periode.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 20, left: 8, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="channel" width={150} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any, n: any) => [`${num(Number(v))}`, n]} />
        <Legend />
        <Bar dataKey="won" name="Gewonnen" stackId="a" fill="#16a34a" isAnimationActive={false} />
        <Bar dataKey="open" name="Open" stackId="a" fill="#93c5fd" isAnimationActive={false} />
        <Bar dataKey="lost" name="Verloren" stackId="a" fill="#fca5a5" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Trechter per fase (horizontale balken, aantal open deals)
export function FunnelChart({
  data,
}: {
  data: { stage: string; openCount: number; openValue: number }[];
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen deals in deze pipeline voor de gekozen periode.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="stage" width={150} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: any, _n: any, p: any) => [
            `${num(Number(v))} open · ${euro(p.payload.openValue)}` +
              (p.payload.avgDaysInStage != null ? ` · gem. ${num(p.payload.avgDaysInStage)} d in deze fase` : ""),
            "Open deals",
          ]}
        />
        <Bar dataKey="openCount" fill="#2563eb" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill="#2563eb" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
