import fs from "node:fs";
import path from "node:path";
import { beeldjaar, RECENT_VANAF, type Project, type Projectenbron } from "./haProjectenFilter";

/**
 * De projectenlijst van H-Architects met fototelling inlezen.
 *
 * Bron: `data-bronnen/h-architects-projecten-2026-09-14.json`, gemaakt met
 * `scripts/h-architects-projecten.py` uit de Dropbox-telling van 14 september
 * 2026. Geen database en geen Pipedrive: dit is een momentopname die met de
 * hand ververst wordt, net als het VEKA-register en het architectenregister.
 *
 * Deze module leest van schijf en hoort dus uitsluitend in een servercomponent.
 * Alles wat de browser ook nodig heeft (vorm, filters, de regel achter "te
 * fotograferen") staat in `lib/haProjectenFilter.ts`.
 */

const BESTAND = path.join(
  process.cwd(),
  "data-bronnen",
  "h-architects-projecten-2026-09-14.json",
);

let gelezen: Projectenbron | null = null;

/** De lijst inlezen. Ontbreekt het bestand, dan geeft dit null terug en toont
 *  de pagina een lege toestand in plaats van te breken. */
export function laadProjecten(): Projectenbron | null {
  if (gelezen) return gelezen;
  try {
    gelezen = JSON.parse(fs.readFileSync(BESTAND, "utf8")) as Projectenbron;
    return gelezen;
  } catch {
    return null;
  }
}

export type Samenvatting = {
  totaal: number;
  metFoto: number;
  zonderFoto: number;
  onbekend: number;
  metOplevering: number;
  recentBeeld: number;
};

/** De tegels bovenaan. Deze cijfers beschrijven de telling zelf en bewegen
 *  bewust niet mee met de filters; het aantal resultaten staat bij de tabel. */
export function samenvatting(projecten: Project[]): Samenvatting {
  return {
    totaal: projecten.length,
    metFoto: projecten.filter((p) => p.fotos === "ja").length,
    zonderFoto: projecten.filter((p) => p.fotos === "nee").length,
    onbekend: projecten.filter((p) => p.fotos === "onbekend").length,
    metOplevering: projecten.filter((p) => p.oplevering > 0).length,
    recentBeeld: projecten.filter((p) => {
      const jaar = beeldjaar(p);
      return jaar !== null && jaar >= RECENT_VANAF;
    }).length,
  };
}
