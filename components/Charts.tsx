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
type DealMini = { id: number; title: string; client: string; value: number; url: string; addDate: string };

function InsightBars({
  data,
  dataKey,
  name,
  color,
  euroFmt,
  dealsKey,
}: {
  data: any[];
  dataKey: string;
  name: string;
  color: string;
  euroFmt?: boolean;
  dealsKey?: "reqDeals" | "wonDeals" | "lostDeals";
}) {
  const [sel, setSel] = useState<{ label: string; deals: DealMini[] } | null>(null);
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-zinc-400">Geen data voor deze periode.</p>;
  }
  const onBarClick = (d: any) => {
    if (!dealsKey) return;
    const row = d?.payload ?? d;
    const deals: DealMini[] = row?.[dealsKey] ?? [];
    setSel({ label: row?.label ?? "", deals: [...deals].sort((a, b) => b.value - a.value) });
  };
  return (
    <div>
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
          <Bar
            dataKey={dataKey}
            name={name}
            fill={color}
            radius={[3, 3, 0, 0]}
            maxBarSize={38}
            isAnimationActive={false}
            onClick={onBarClick}
            style={dealsKey ? { cursor: "pointer" } : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
      {dealsKey && (
        <p className="mt-1 text-center text-[11px] text-zinc-400">Klik op een balk om de onderliggende deals te zien.</p>
      )}
      {sel && (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50/60">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <div className="text-[13px] font-semibold text-zinc-800">
              {name} · {sel.label} <span className="text-zinc-400">({sel.deals.length})</span>
            </div>
            <button onClick={() => setSel(null)} className="text-zinc-400 hover:text-zinc-700" aria-label="Sluiten">✕</button>
          </div>
          {sel.deals.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-zinc-400">Geen deals in deze balk.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto px-2 py-1.5">
              <table className="w-full text-[12.5px]">
                <tbody>
                  {sel.deals.slice(0, 150).map((d) => (
                    <tr key={d.id} className="border-b border-zinc-100 last:border-0">
                      <td className="py-1.5 pl-2">
                        <span className="text-zinc-800">{d.title}</span>
                        <span className="ml-1.5 text-zinc-400">· {d.client}</span>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-zinc-400" title="Aanvraagdatum">{d.addDate || "—"}</td>
                      <td className="whitespace-nowrap py-1.5 pr-1 text-right tabular-nums text-zinc-500">{d.value > 0 ? euro(d.value) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right">
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-blue-600 hover:underline">openen ↗</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sel.deals.length > 150 && <p className="px-2 pt-1.5 text-[11px] text-zinc-400">Eerste 150 van {sel.deals.length} getoond.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RequestsBarChart({ data }: { data: any[] }) {
  return <InsightBars data={data} dataKey="requests" name="Aanvragen" color="#3b82f6" dealsKey="reqDeals" />;
}

// Eenvoudige balken (bv. per weekdag / per uur) — dataKey "count", geen klik-detail.
export function TimingBars({ data, name, color = "#6366f1" }: { data: any[]; name: string; color?: string }) {
  return <InsightBars data={data} dataKey="count" name={name} color={color} />;
}

export function LostBarChart({ data }: { data: any[] }) {
  return <InsightBars data={data} dataKey="lostCount" name="Verloren" color="#f0645d" dealsKey="lostDeals" />;
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
        dealsKey="wonDeals"
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
