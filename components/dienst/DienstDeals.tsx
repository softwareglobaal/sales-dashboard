import Link from "next/link";
import { bereik, dataset, dealLijst, filterFirma, firmasVan, firma as firmaVan, isDienstPeriode, type Afdeling } from "@/lib/afdelingen";
import { euro, num } from "@/lib/format";
import { DienstKop, dienstHref, type DienstZoek } from "./DienstKop";

// Doorklik op Gewonnen / Verloren (spec §17): elke deal met aanvraagdatum, offerte,
// afronding, de fase waarin hij verloren ging, de verliesreden en de productwaarde van
// enkel deze dienst. Bij verloren kan je op een reden filteren.

const datumNl = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export function DienstDeals({ a, sp }: { a: Afdeling; sp: DienstZoek & { status?: string; reden?: string } }) {
  const periode = isDienstPeriode(sp.periode) ? sp.periode : "ytd";
  const f = sp.firma && firmasVan(a).some((x) => x.sleutel === sp.firma) ? sp.firma : undefined;
  const status = sp.status === "lost" ? "lost" : "won";
  const b = bereik(periode);
  const alle = dealLijst(filterFirma(dataset(a), f), status, b.van, b.tot);
  const redenen = new Map<string, number>();
  for (const r of alle) if (r.verliesreden) redenen.set(r.verliesreden, (redenen.get(r.verliesreden) || 0) + 1);
  const rijen = sp.reden ? alle.filter((r) => r.verliesreden === sp.reden) : alle;
  const totaal = rijen.reduce((s, r) => s + r.productwaarde, 0);
  const metOfferte = rijen.filter((r) => r.offerte).length;
  const zoek = { periode, firma: f };
  const basis = `/${a.pad}/deals`;
  const lijstHref = (st: string, reden?: string) => {
    const u = dienstHref(basis, zoek);
    const p = new URLSearchParams(u.split("?")[1] || "");
    p.set("status", st);
    if (reden) p.set("reden", reden);
    return `${basis}?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <DienstKop a={a} tab="overzicht" sp={zoek} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={lijstHref("won")} className={status === "won" ? "chip donker" : "chip"} style={{ padding: "6px 13px" }}>
          Gewonnen
        </Link>
        <Link href={lijstHref("lost")} className={status === "lost" ? "chip donker" : "chip"} style={{ padding: "6px 13px" }}>
          Verloren
        </Link>
        <span className="text-[12.5px] text-zinc-500">
          {b.label}
          {f ? ` · enkel ${firmaVan(f)?.naam}` : ""} · {num(rijen.length)} deals · {num(metOfferte)} met offerte · productwaarde {euro(totaal)}
        </span>
      </div>

      {status === "lost" && redenen.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={lijstHref("lost")} className={!sp.reden ? "chip donker" : "chip"}>
            Alle redenen ({alle.length})
          </Link>
          {[...redenen.entries()]
            .sort((x, y) => y[1] - x[1])
            .map(([r, n]) => (
              <Link key={r} href={lijstHref("lost", r)} className={sp.reden === r ? "chip donker" : "chip"}>
                {r} ({n})
              </Link>
            ))}
        </div>
      )}

      <section className="paneel mt-4">
        {rijen.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Geen deals in deze periode.</p>
        ) : (
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Aanvraag</th>
                  <th>Offerte</th>
                  <th>{status === "won" ? "Gewonnen" : "Verloren"}</th>
                  <th className="num">Dagen</th>
                  {status === "lost" && <th>Verloren in fase</th>}
                  {status === "lost" && <th>Reden</th>}
                  <th className="num">Productwaarde</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.uid}>
                    <td style={{ minWidth: 220 }}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {r.titel}
                      </a>
                      <div className="text-[11.5px] text-zinc-500">
                        {r.bronLabel}
                        {r.producten.length ? ` · ${r.producten.join(", ")}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{datumNl(r.aanvraag)}</td>
                    <td className="whitespace-nowrap">
                      {r.offerte ? <span className="chip goed">ja</span> : <span className="chip">nee</span>}
                      {r.offerteOp && <div className="text-[11.5px] text-zinc-500">{datumNl(r.offerteOp)}</div>}
                    </td>
                    <td className="whitespace-nowrap">{datumNl(r.afgerond)}</td>
                    <td className="num">{r.doorlooptijd ?? "—"}</td>
                    {status === "lost" && (
                      <td>
                        {r.fase || "—"}
                        {r.pipeline && <div className="text-[11.5px] text-zinc-500">{r.pipeline}</div>}
                      </td>
                    )}
                    {status === "lost" && (
                      <td>
                        {r.verliesreden}
                        {r.verliesredenRuw && r.verliesredenRuw !== r.verliesreden && (
                          <div className="text-[11.5px] text-zinc-500">{r.verliesredenRuw}</div>
                        )}
                      </td>
                    )}
                    <td className="num">{euro(r.productwaarde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-zinc-500">
          Productwaarde = enkel de producten van {a.naam} op de deal (bij een bundel dus niet de hele deal). Offerte = indicatief uit de
          fase; de offertedatum komt uit de fasegeschiedenis en bestaat enkel voor UNABO en TKN-Buro.
        </p>
      </section>
    </main>
  );
}
