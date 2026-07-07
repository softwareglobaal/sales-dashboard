"use client";

import { Fragment, useState } from "react";
import { num } from "@/lib/format";

type Deal = { id: number; title: string; pipeline: string; accountName: string; url: string };
type Reason = { reason: string; count: number; unabo: number; tkn: number; deals: Deal[] };

export function LostReasonsTable({ reasons, total }: { reasons: Reason[]; total: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{ reason: Reason; x: number; y: number } | null>(null);

  const toggle = (r: string) => {
    const n = new Set(open);
    n.has(r) ? n.delete(r) : n.add(r);
    setOpen(n);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4 text-left font-medium">Verlies-reden</th>
            <th className="py-2 pr-4 text-right font-medium">Totaal</th>
            <th className="py-2 pr-4 text-right font-medium text-zinc-400">UNABO</th>
            <th className="py-2 pr-4 text-right font-medium text-zinc-400">TKN</th>
            <th className="py-2 pr-4 text-right font-medium">Aandeel</th>
          </tr>
        </thead>
        <tbody>
          {reasons.map((r) => {
            const isOpen = open.has(r.reason);
            return (
              <Fragment key={r.reason}>
                <tr
                  className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                  onClick={() => toggle(r.reason)}
                  onMouseMove={(e) => setHover({ reason: r, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover((h) => (h && h.reason.reason === r.reason ? null : h))}
                >
                  <td className="py-2 pr-4 text-zinc-800">
                    <span className="mr-1 inline-block w-3 text-zinc-400">{isOpen ? "▾" : "▸"}</span>
                    {r.reason}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">{num(r.count)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{num(r.unabo)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{num(r.tkn)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-500">
                    {total ? Math.round((r.count / total) * 100) : 0}%
                  </td>
                </tr>
                {isOpen &&
                  r.deals.map((d) => (
                    <tr key={d.id} className="border-b border-zinc-100 bg-zinc-50/60">
                      <td className="py-1.5 pr-4 pl-8" colSpan={5}>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {d.title} ↗
                          </a>
                        ) : (
                          <span className="font-medium text-zinc-800">{d.title}</span>
                        )}
                        <span className="text-zinc-400">
                          {" "}
                          · {d.pipeline} · {d.accountName}
                        </span>
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {hover && hover.reason.deals.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: Math.min(hover.y + 16, typeof window !== "undefined" ? window.innerHeight - 260 : hover.y + 16),
            left: Math.min(hover.x + 16, typeof window !== "undefined" ? window.innerWidth - 340 : hover.x + 16),
          }}
          className="pointer-events-none z-50 w-80 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg"
        >
          <div className="mb-1 font-semibold text-zinc-800">
            {hover.reason.reason} — {num(hover.reason.count)} deals
          </div>
          <ul className="space-y-0.5">
            {hover.reason.deals.slice(0, 10).map((d) => (
              <li key={d.id} className="truncate">
                <span className="text-zinc-700">{d.title}</span>
                <span className="text-zinc-400"> · {d.pipeline}</span>
              </li>
            ))}
          </ul>
          {hover.reason.deals.length > 10 && (
            <div className="mt-1 text-zinc-400">+ {hover.reason.deals.length - 10} meer — klik om alles te zien</div>
          )}
        </div>
      )}
    </div>
  );
}
