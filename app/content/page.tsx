import { opdrachten, kansen, apartMarkten } from "@/lib/content";
import { ContentKaart as Kaart } from "@/components/ContentKaart";

export const dynamic = "force-dynamic";

// "Wacht op jou" (spec §17): wat de SEO-agents zelf opnamen en uitwerkten. Eén
// goedkeuringsmoment: hier. Publiceren gebeurt pas daarna, via de website-keten.

export default function ContentPagina() {
  // Sites met een eigen wachtrij (Angela, Stychin Tyme) staan in hun eigen overzicht op Websites.
  const alle = opdrachten(undefined, { zonderApart: true });
  const wacht = alle.filter((o) => o.status === "wacht-op-goedkeuring");
  const bezig = alle.filter((o) => o.status === "in-behandeling");
  const nietPassend = alle.filter((o) => o.status === "niet-passend");
  const beoordeeld = alle.filter((o) => o.status === "goedgekeurd" || o.status === "afgewezen");
  const open = kansen(100).filter((k) => !apartMarkten().includes(String(k.markt))).length;
  return (
    <main className="mx-auto max-w-5xl px-6 pb-10">
      <div className="kopbalk">
        <h1 className="h1-glas">Wacht op jou</h1>
        <p className="text-[12.5px] text-zinc-500">
          Teksten die de SEO-agents zelf opnamen, uitwerkten en door de kwaliteitscontrole haalden · {wacht.length} te beoordelen ·{" "}
          {bezig.length} in behandeling · {open} kansen nog niet opgepakt
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {wacht.length === 0 ? (
          <div className="paneel">
            <p className="text-[13px] text-zinc-500">Niets te beoordelen. De agents nemen elke werkdag de beste kansen op.</p>
          </div>
        ) : (
          wacht.map((o) => <Kaart key={o.kans_id} o={o} metOordeel />)
        )}
      </div>
      {bezig.length > 0 && (
        <details className="paneel mt-6">
          <summary className="cursor-pointer font-serif text-[18px]">In behandeling ({bezig.length})</summary>
          <div className="mt-3 flex flex-col gap-3">{bezig.map((o) => <Kaart key={o.kans_id} o={o} />)}</div>
        </details>
      )}
      {nietPassend.length > 0 && (
        <details className="paneel mt-4">
          <summary className="cursor-pointer font-serif text-[18px]">Niet passend voor ons ({nietPassend.length})</summary>
          <div className="mt-3 flex flex-col gap-3">{nietPassend.map((o) => <Kaart key={o.kans_id} o={o} />)}</div>
        </details>
      )}
      {beoordeeld.length > 0 && (
        <details className="paneel mt-4">
          <summary className="cursor-pointer font-serif text-[18px]">Beoordeeld ({beoordeeld.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {beoordeeld.map((o) => (
              <Kaart key={o.kans_id} o={o} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
