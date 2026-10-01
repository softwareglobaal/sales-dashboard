import { notFound } from "next/navigation";
import { afdeling } from "@/lib/afdelingen";
import { DienstKop, type DienstZoek, type Tab } from "./DienstKop";
import { DienstOverzicht } from "./DienstOverzicht";
import { DienstKanalen } from "./DienstKanalen";
import { DienstDeals } from "./DienstDeals";
import { DienstAnalyse } from "./DienstAnalyse";

// Eén ingang voor elke dienstpagina: de routes in app/<dienst>/ zijn enkel een
// verwijzing hierheen, zodat alle diensten dezelfde opbouw houden (spec §17).
export function DienstPagina({ pad, tab, searchParams }: { pad: string; tab: Tab | "deals"; searchParams: DienstZoek & { status?: string; reden?: string; rs?: string } }) {
  const a = afdeling(pad);
  if (!a) notFound();
  if (tab === "kanalen") return <DienstKanalen a={a} sp={searchParams} />;
  if (tab === "deals") return <DienstDeals a={a} sp={searchParams} />;
  if (tab === "analyse") return <DienstAnalyse a={a} sp={searchParams} />;
  if (tab === "concurrentie") {
    // Enkel voor diensten zonder eigen marktmonitor; de andere hebben een eigen pagina.
    return (
      <main className="mx-auto max-w-7xl px-6 pb-10">
        <DienstKop a={a} tab="concurrentie" sp={{}} filters={false} />
        <div className="paneel mt-4">
          <div className="leeg">
            <h2>Nog geen marktmonitor voor {a.naam}</h2>
            <p className="lede mt-2">
              De concurrentiemonitor meet nu Energie, Engineering, Architectuur en Regularisatie. Een markt erbij vraagt een eigen
              zoekwoordenlijst en ruimte in het SERP-quotum (250 zoekopdrachten per maand, ~220 in gebruik). Tot dan staat het
              marktonderzoek voor deze dienst hier niet.
            </p>
          </div>
        </div>
      </main>
    );
  }
  return <DienstOverzicht a={a} sp={searchParams} />;
}
