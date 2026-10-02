"use client";

import { Fragment, useState } from "react";
import { num } from "@/lib/format";
import type { KanaalRij } from "@/lib/afdelingen";

// Aanvragen per kanaal met uitklapbare subkanalen (bv. Rechtstreeks (onderaanneming)
// -> per EPB-bureau). Subrijen staan in dezelfde tabel, ingesprongen, met een balkje
// voor hun aandeel binnen het kanaal: leesbaar in plaats van een blok platte tekst.

export function KanaalTabel({ kanalen, totaal }: { kanalen: KanaalRij[]; totaal: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <div className="tabelwrap">
      <table className="tabel">
        <thead>
          <tr>
            <th>Kanaal</th>
            <th className="num">Aanvragen</th>
            <th className="num">Aandeel</th>
            <th className="num">Gewonnen</th>
            <th className="num">Winratio</th>
          </tr>
        </thead>
        <tbody>
          {kanalen.map((k) => {
            const isOpen = !!open[k.kanaal];
            const heeftSubs = k.subs.length > 0;
            return (
              <Fragment key={k.kanaal}>
                <tr
                  onClick={heeftSubs ? () => setOpen((o) => ({ ...o, [k.kanaal]: !o[k.kanaal] })) : undefined}
                  style={{ cursor: heeftSubs ? "pointer" : undefined }}
                  aria-expanded={heeftSubs ? isOpen : undefined}
                >
                  <td className="font-medium">
                    {heeftSubs && (
                      <span aria-hidden="true" style={{ display: "inline-block", width: 14, transform: isOpen ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>
                        ›
                      </span>
                    )}
                    {k.kanaal}
                    {heeftSubs && <span className="ml-2 text-[11.5px] font-normal text-zinc-500">{k.subs.length} subkanalen</span>}
                  </td>
                  <td className="num">{num(k.aanvragen)}</td>
                  <td className="num">{pct(k.aanvragen, totaal)}%</td>
                  <td className="num">{num(k.gewonnen)}</td>
                  <td className="num">{pct(k.gewonnen, k.aanvragen)}%</td>
                </tr>
                {isOpen &&
                  k.subs.map((s) => (
                    <tr key={k.kanaal + s.sub} style={{ background: "var(--vlak)" }}>
                      <td style={{ paddingLeft: 34 }}>
                        <div className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.sub}</span>
                          <span className="staaf" style={{ width: 90, flex: "none" }}>
                            <i className="accent" style={{ width: `${pct(s.aanvragen, k.subs[0].aanvragen)}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="num text-[12.5px]">{num(s.aanvragen)}</td>
                      <td className="num text-[12.5px] text-zinc-500">{pct(s.aanvragen, k.aanvragen)}% van kanaal</td>
                      <td className="num text-[12.5px]">{num(s.gewonnen)}</td>
                      <td className="num text-[12.5px]">{pct(s.gewonnen, s.aanvragen)}%</td>
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
