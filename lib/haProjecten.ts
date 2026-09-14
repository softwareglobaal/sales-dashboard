import fs from "node:fs";
import path from "node:path";
import {
  camerajaar,
  RECENT_VANAF,
  teFotograferen,
  type Project,
  type Projectenbron,
} from "./haProjectenFilter";

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
  /** Beoordeling "ja": het afgewerkte gebouw staat op minstens één foto. */
  inBeeld: number;
  /** Beoordeling "nee": alleen werf, bestaande toestand, of geen camerafoto. */
  nietInBeeld: number;
  /** Beoordeling "onzeker": niet uit te maken op de drie recentste foto's. */
  onzeker: number;
  /** De snelknop van Mehdi: nee of onzeker, en niet opgezegd. */
  teFotograferen: number;
  /** Projecten zonder één enkele camerafoto in de map. */
  zonderCamerafoto: number;
  /** Camerafoto's in totaal, over alle projecten. */
  camerafotos: number;
  recentBeeld: number;
};

/** De tegels bovenaan. Deze cijfers beschrijven de beoordeling zelf en bewegen
 *  bewust niet mee met de filters; het aantal resultaten staat bij de tabel. */
export function samenvatting(projecten: Project[]): Samenvatting {
  const met = (b: string) => projecten.filter((p) => p.oplevering_beoordeling === b).length;
  return {
    totaal: projecten.length,
    inBeeld: met("ja"),
    nietInBeeld: met("nee"),
    onzeker: met("onzeker"),
    teFotograferen: projecten.filter(teFotograferen).length,
    zonderCamerafoto: projecten.filter((p) => p.camerafotos === 0).length,
    camerafotos: projecten.reduce((t, p) => t + p.camerafotos, 0),
    recentBeeld: projecten.filter((p) => {
      const jaar = camerajaar(p);
      return jaar !== null && jaar >= RECENT_VANAF;
    }).length,
  };
}
