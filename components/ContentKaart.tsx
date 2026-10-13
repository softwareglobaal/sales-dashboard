// Eén tekst van de SEO-agents, met (optioneel) de knoppen Goedkeuren/Afwijzen. Gedeeld
// door "Wacht op jou" en de eigen wachtrij van sites zonder dienst (tab Websites).

import { DIENST_NAAM, type ContentOpdracht } from "@/lib/content";
import { Oordeel } from "@/app/content/Oordeel";

export const datum = (s: string | null) => (s ? s.slice(0, 16).replace("T", " ") : "—");

export function ContentKaart({ o, metOordeel }: { o: ContentOpdracht; metOordeel?: boolean }) {
  return (
    <div className="paneel">
      <div className="kop">
        <h2 style={{ fontSize: 18 }}>{o.titel || o.kans_id}</h2>
        <small>
          {DIENST_NAAM[o.dienst] || o.dienst || "Website"} · {o.firma} · {o.soort === "herschrijf" ? "herschrijfkans" : o.soort === "zoekterm" ? "zoekterm zonder eigen pagina" : "reactie op concurrent-blog"} · {datum(o.bijgewerkt)}
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

