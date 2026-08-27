import {
  getRegister,
  getRegisterTotalen,
  getProvincieKeuzes,
  concurrentieHeeftData,
} from "@/lib/concurrentieQueries";
import { num } from "@/lib/format";
import { Kpi, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const SOORTEN = [
  { key: "alles", label: "Alles" },
  { key: "bureau", label: "Bureaus (2+ verslaggevers)" },
  { key: "eenmanszaak", label: "Alleen of klein" },
  { key: "zonder-website", label: "Zonder eigen domein" },
];

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ zoek?: string; provincie?: string; soort?: string }>;
}) {
  const sp = await searchParams;
  const filter = {
    zoek: sp.zoek || "",
    provincie: sp.provincie || "alles",
    soort: sp.soort || "alles",
  };

  if (!concurrentieHeeftData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-bold text-zinc-900">Register EPB-verslaggevers</h1>
        <p className="mt-4 text-sm text-zinc-500">Nog geen register ingelezen.</p>
      </main>
    );
  }

  const totalen = getRegisterTotalen();
  const provincies = getProvincieKeuzes();
  const rijen = getRegister(filter, 400);

  const link = (wijziging: Record<string, string>) => {
    const p = new URLSearchParams({ ...filter, ...wijziging } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v || v === "alles") p.delete(k);
    const q = p.toString();
    return "/energy/register" + (q ? "?" + q : "");
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-zinc-900">Register EPB-verslaggevers</h1>
        <div className="text-xs text-zinc-500">Bron: VEKA / energiesparen.be — export augustus 2026</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Erkenningen" value={num(totalen.erkenningen)} sub="waarvan sommige dubbel" />
        <Kpi label="Personen" value={num(totalen.personen)} sub="unieke namen" />
        <Kpi label="Bedrijfsdomeinen" value={num(totalen.domeinen)} />
        <Kpi label="Zonder eigen domein" value={num(totalen.zonder_website)} sub="gratis mailadres" />
      </div>

      <div className="mt-4">
        <Card title="Zoeken en filteren">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500">Naam, bedrijf, gemeente of domein</label>
              <input
                type="search"
                name="zoek"
                defaultValue={filter.zoek}
                placeholder="bv. Missiaen, Genk, egeon.be"
                className="mt-1 w-72 rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Provincie</label>
              <select name="provincie" defaultValue={filter.provincie}
                      className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm">
                <option value="alles">Alle provincies</option>
                {provincies.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Soort</label>
              <select name="soort" defaultValue={filter.soort}
                      className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm">
                {SOORTEN.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
              Zoeken
            </button>
            {(filter.zoek || filter.provincie !== "alles" || filter.soort !== "alles") && (
              <a href="/energy/register" className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline">
                wissen
              </a>
            )}
          </form>
        </Card>
      </div>

      <div className="mt-4">
        <Card title={`${num(rijen.length)} resultaten${rijen.length >= 400 ? " (eerste 400)" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Naam</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Bedrijf</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Gemeente</th>
                  <th className="pb-2 pr-4 whitespace-nowrap font-medium">Provincie</th>
                  <th className="pb-2 pr-4 whitespace-nowrap text-right font-medium">Collega&apos;s</th>
                  <th className="pb-2 pr-4 whitespace-nowrap text-right font-medium">EPB-pag.</th>
                  <th className="pb-2 whitespace-nowrap font-medium">Website</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.ep_code} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-4 text-zinc-800">
                      {r.naam}
                      <div className="text-[11px] text-zinc-400">{r.ep_code}</div>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{r.bedrijf || <span className="text-zinc-300">—</span>}</td>
                    <td className="py-2 pr-4 text-zinc-600">{r.gemeente}</td>
                    <td className="py-2 pr-4 text-zinc-500">{r.provincie || <span className="text-zinc-300">—</span>}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-700">
                      {r.collegas > 1 ? r.collegas : <span className="text-zinc-300">1</span>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                      {r.epb_paginas === null ? <span className="text-zinc-300">—</span> : num(r.epb_paginas)}
                    </td>
                    <td className="py-2 text-xs">
                      {r.domein ? (
                        <a href={`https://${r.domein}`} target="_blank" rel="noreferrer noopener"
                           className="text-blue-600 hover:underline">{r.domein}</a>
                      ) : (
                        <span className="text-zinc-400">geen</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Contactgegevens staan bewust niet in deze tabel. Ze zitten wel in de database voor
            de onderaanneming-lijst; dit blijft een openbaar register met persoonsgegevens,
            uitsluitend voor intern gebruik.
          </p>
        </Card>
      </div>
    </main>
  );
}
