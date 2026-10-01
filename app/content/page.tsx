import { opdrachten, kansen, DIENST_NAAM, type ContentOpdracht } from "@/lib/content";
import { Oordeel } from "./Oordeel";

export const dynamic = "force-dynamic";

// "Wacht op jou" (spec §17): wat de SEO-agents zelf opnamen en uitwerkten. Eén
// goedkeuringsmoment: hier. Publiceren gebeurt pas daarna, via de website-keten.

const datum = (s: string | null) => (s ? s.slice(0, 16).replace("T", " ") : "—");

function Kaart({ o, metOordeel }: { o: ContentOpdracht; metOordeel?: boolean }) {
  return (
    <div className="paneel">
      <div className="kop">
        <h2 style={{ fontSize: 18 }}>{o.titel || o.kans_id}</h2>
        <small>
          {DIENST_NAAM[o.dienst] || o.dienst} · {o.firma} · {o.soort === "herschrijf" ? "herschrijfkans" : "reactie op concurrent-blog"} · {datum(o.bijgewerkt)}
        </small>
      </div>
      {o.samenvatting && <p className="mb-3 text-[13px] text-zinc-700">{o.samenvatting}</p>}
      {o.qc && (
        <details className="mb-2">
          <summary className="cursor-pointer text-[12.5px] font-medium">Verslag kwaliteitscontrole</summary>
          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-zinc-700">{o.qc}</pre>
        </details>
      )}
      {o.tekst && (
        <details className="mb-3">
          <summary className="cursor-pointer text-[12.5px] font-medium">Lees de tekst</summary>
          <pre className="mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl bg-white/70 p-4 text-[13px] leading-relaxed text-zinc-800">{o.tekst}</pre>
        </details>
      )}
      {o.bestand && <p className="mb-3 text-[11.5px] text-zinc-500">Bestand: {o.bestand}</p>}
      {metOordeel ? <Oordeel kansId={o.kans_id} /> : o.door && <p className="text-[12px] text-zinc-500">Door {o.door}</p>}
    </div>
  );
}

export default function ContentPagina() {
  const alle = opdrachten();
  const wacht = alle.filter((o) => o.status === "wacht-op-goedkeuring");
  const bezig = alle.filter((o) => o.status === "in-behandeling");
  const nietPassend = alle.filter((o) => o.status === "niet-passend");
  const beoordeeld = alle.filter((o) => o.status === "goedgekeurd" || o.status === "afgewezen");
  const open = kansen(100).length;
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
