"use client";

import { useState } from "react";
import { euro, num } from "@/lib/format";

type Row = {
  service: string;
  source: string;
  requests: number;
  soldCount: number;
  revenue: number;
  avgDays: number | null;
};

type SortKey = "service" | "source" | "requests" | "soldCount" | "revenue" | "avgDays";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "service", label: "Dienst", numeric: false },
  { key: "source", label: "Bron", numeric: false },
  { key: "requests", label: "Aanvragen", numeric: true },
  { key: "soldCount", label: "Verkocht", numeric: true },
  { key: "revenue", label: "Omzet", numeric: true },
  { key: "avgDays", label: "Gem. dagen → verkoop", numeric: true },
];

export function ServiceTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [asc, setAsc] = useState(false);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      // tekst standaard oplopend, getallen standaard aflopend
      setAsc(key === "service" || key === "source");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    // null (geen dagen) altijd onderaan
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
    return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={
                  "cursor-pointer select-none py-2 pr-4 font-medium hover:text-zinc-800 " +
                  (c.numeric ? "text-right" : "text-left")
                }
              >
                {c.label}
                {sortKey === c.key && <span className="ml-1">{asc ? "▲" : "▼"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-medium text-zinc-800">{r.service}</td>
              <td className="py-2 pr-4">
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-xs " +
                    (r.source === "TKN-Buro" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")
                  }
                >
                  {r.source}
                </span>
              </td>
              <td className="py-2 pr-4 text-right">{num(r.requests)}</td>
              <td className="py-2 pr-4 text-right">{num(r.soldCount)}</td>
              <td className="py-2 pr-4 text-right">{euro(r.revenue)}</td>
              <td className="py-2 pr-4 text-right">{r.avgDays != null ? `${num(r.avgDays)} d` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
