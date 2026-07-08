import { getGlobalMap, hasData } from "@/lib/queries";
import { ACCOUNTS } from "@/lib/accounts";
import { num } from "@/lib/format";
import { BelgiumMap, type OurOffice } from "@/components/BelgiumMap";
import { FirmaSelector, RegionStatusSelector } from "@/components/Controls";
import { SyncFreshness } from "@/components/SyncFreshness";
import { POSTCODE_COORDS } from "@/lib/postcodeCoords";
import officesConfig from "@/config/offices.json";

export const dynamic = "force-dynamic";

const PATH = "/kaart";
const ACC_KEYS = ACCOUNTS.map((a) => a.key);

export default async function KaartPage({ searchParams }: { searchParams: Promise<{ acc?: string; rs?: string }> }) {
  const sp = await searchParams;
  const accountKey = sp.acc && ACC_KEYS.includes(sp.acc) ? sp.acc : "all";
  const status = (["won", "open", "lost", "all"].includes(sp.rs || "") ? sp.rs : "all") as "won" | "open" | "lost" | "all";
  const params = sp as Record<string, string | undefined>;

  if (!hasData()) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-zinc-500">Nog geen data. Ga naar het Algemeen dashboard en klik op &ldquo;Data verversen&rdquo;.</p>
      </main>
    );
  }

  const data = getGlobalMap(accountKey, status);
  const firmaColors: Record<string, string> = Object.fromEntries(ACCOUNTS.map((a) => [a.name, a.color]));
  const firmaOptions = [{ key: "", label: "Alle firma's" }, ...ACCOUNTS.map((a) => ({ key: a.key, label: a.name }))];
  const statusLabel = status === "won" ? "Gewonnen" : status === "open" ? "Open" : status === "lost" ? "Verloren" : "Alle statussen";
  const accLabel = accountKey === "all" ? "Alle firma's" : ACCOUNTS.find((a) => a.key === accountKey)?.name || accountKey;

  const ourOffices: OurOffice[] = officesConfig.offices
    .map((o) => {
      const c = (POSTCODE_COORDS as Record<string, [number, number]>)[o.postal];
      return c ? { label: o.label, address: o.address, city: o.city, lat: c[0], lng: c[1], confirmed: o.confirmed } : null;
    })
    .filter((o): o is OurOffice => o !== null);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-black/10 bg-[#d7dde7]/85 px-6 pt-7 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Kaart — alle projecten</h1>
            <p className="text-[12.5px] text-zinc-500">Alle firma&#39;s &amp; diensten samen · gekleurd per firma · projectadres uit de deal-titel</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FirmaSelector options={firmaOptions} current={accountKey === "all" ? "" : accountKey} params={params} path={PATH} />
            <RegionStatusSelector current={status} params={params} path={PATH} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11.5px]">
          <SyncFreshness />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Firma: <b className="text-zinc-800">{accLabel}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-zinc-600">
            Status: <b className="text-zinc-800">{statusLabel}</b>
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {data.plotted === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">Geen herkenbare projectadressen voor deze selectie.</p>
        ) : (
          <>
            <BelgiumMap points={data.points} b2bOffices={[]} ourOffices={ourOffices} colorBy="firma" firmaColors={firmaColors} />
            <p className="mt-2 text-center text-[11.5px] text-zinc-400">
              {num(data.plotted)} van {num(data.total)} deals op de kaart · {num(data.unplaced)} zonder herkenbaar projectadres
              (vaak B2B op firmanaam)
            </p>
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">Op de kaart, per firma</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">
                {data.byFirma.map((f) => (
                  <div key={f.firma} className="flex items-center justify-between border-b border-zinc-50 py-1.5 text-sm">
                    <span className="flex items-center gap-1.5 text-zinc-700">
                      <span className="h-2 w-2 rounded-full" style={{ background: firmaColors[f.firma] || "#64748b" }} />
                      {f.firma}
                    </span>
                    <b className="tabular-nums text-zinc-900">{num(f.count)}</b>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        Dit is de globale kaart over álle firma&#39;s. Voor enkel Engineering-projecten: gebruik de kaart op de Engineering-tab.
      </p>
    </main>
  );
}
