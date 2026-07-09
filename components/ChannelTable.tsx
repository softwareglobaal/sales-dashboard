"use client";

import { Fragment, useState } from "react";
import { num } from "@/lib/format";

type Sub = { sub: string; leads: number; won: number; open: number; lost: number };
type Row = { channel: string; leads: number; won: number; open: number; lost: number; subs: Sub[] };

export function ChannelTable({ rows, total }: { rows: Row[]; total: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (c: string) => {
    const n = new Set(open);
    n.has(c) ? n.delete(c) : n.add(c);
    setOpen(n);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4 text-left font-medium">Hoofdkanaal</th>
            <th className="py-2 pr-4 text-right font-medium">Aanvragen</th>
            <th className="py-2 pr-4 text-right font-medium">Gewonnen</th>
            <th className="py-2 pr-4 text-right font-medium">Open</th>
            <th className="py-2 pr-4 text-right font-medium">Verloren</th>
            <th className="py-2 pr-4 text-right font-medium" title="Aandeel van dit kanaal in alle binnengekomen aanvragen">
              Aandeel v/d aanvragen
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hasSubs = r.subs.length > 0;
            const isOpen = open.has(r.channel);
            return (
              <Fragment key={r.channel}>
                <tr
                  className={"border-b border-zinc-100 " + (hasSubs ? "cursor-pointer hover:bg-zinc-50" : "")}
                  onClick={hasSubs ? () => toggle(r.channel) : undefined}
                >
                  <td className="py-2 pr-4 font-medium text-zinc-800">
                    <span className="mr-1 inline-block w-3 text-zinc-400">{hasSubs ? (isOpen ? "▾" : "▸") : ""}</span>
                    {r.channel}
                    {hasSubs && <span className="ml-1 text-xs text-zinc-400">({r.subs.length})</span>}
                  </td>
                  <td className="py-2 pr-4 text-right">{num(r.leads)}</td>
                  <td className="py-2 pr-4 text-right text-green-700">{num(r.won)}</td>
                  <td className="py-2 pr-4 text-right text-blue-600">{num(r.open)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{num(r.lost)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-500">
                    {total ? Math.round((r.leads / total) * 100) : 0}%
                  </td>
                </tr>
                {isOpen &&
                  r.subs.map((s) => (
                    <tr key={r.channel + "|" + s.sub} className="border-b border-zinc-100 bg-zinc-50/60">
                      <td className="py-1.5 pr-4 pl-8 text-zinc-600">{s.sub}</td>
                      <td className="py-1.5 pr-4 text-right text-zinc-600">{num(s.leads)}</td>
                      <td className="py-1.5 pr-4 text-right text-green-600">{num(s.won)}</td>
                      <td className="py-1.5 pr-4 text-right text-blue-500">{num(s.open)}</td>
                      <td className="py-1.5 pr-4 text-right text-zinc-400">{num(s.lost)}</td>
                      <td className="py-1.5 pr-4 text-right text-zinc-400">
                        {total ? Math.round((s.leads / total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
