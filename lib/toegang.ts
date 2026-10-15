// Toegang per afdeling, afgedwongen aan de serverkant.
//
// Tot nu toe kende dit dashboard geen afdelingsrechten: wie door de Authentik-login
// kwam, zag elke afdeling. Watch Tower verbergt de tegel wel, maar het adres bleef
// bereikbaar -- een slot op de voordeur met de achterdeur open. Dit sluit die deur.
//
// De regel is een naamafspraak, geen tweede lijst die kan verouderen: de
// Authentik-groep `wp-<afdeling>` geeft toegang tot die afdeling, `wp-alles` tot alles.
// Watch Tower gebruikt exact dezelfde afspraak.

import cfg from "@/config/afdelingen.json";

/**
 * Route in dit dashboard -> afdeling zoals Watch Tower hem noemt. Komt uit
 * config/afdelingen.json (pad -> registerAfdeling), zodat een nieuwe dienst
 * meteen ook zijn slot krijgt. Twee routes heten hier anders dan in het register
 * (safety = veiligheidscoordinatie, h-architects = architectuur); dat staat in de config.
 */
export const AFDELING_VAN_PAD: Record<string, string> = Object.fromEntries(
  cfg.afdelingen.map((a) => [a.pad, a.registerAfdeling]),
);

export const AFDELINGSPADEN = Object.keys(AFDELING_VAN_PAD);

/** Pagina's die niet bij één afdeling horen en dus voor iedereen open staan. */
const ALGEMEEN = ["", "kaart", "sales-team", "woordenboek", "applicaties", "seo-sea", "websites", "content"];

function groepenUit(kop: string | null): string[] {
  return (kop || "").split(/[|,]/).map((g) => g.trim().toLowerCase()).filter(Boolean);
}

/** Welke afdelingen mag deze bezoeker openen. */
export function afdelingenVoor(groepenKop: string | null): Set<string> {
  const groepen = groepenUit(groepenKop);
  // Alleen om lokaal te werken: zonder forward-auth is er geen groep en zou alles
  // op slot staan. Op de server staat TOEGANG_DEV niet aan, dus daar telt
  // uitsluitend wat de header meegeeft -- en is dicht de standaard.
  if (process.env.TOEGANG_DEV === "1" && groepen.length === 0) {
    return new Set(Object.values(AFDELING_VAN_PAD));
  }
  if (groepen.includes("wp-alles")) return new Set(Object.values(AFDELING_VAN_PAD));
  const uit = new Set<string>();
  for (const afdeling of Object.values(AFDELING_VAN_PAD)) {
    if (groepen.includes(`wp-${afdeling}`)) uit.add(afdeling);
  }
  return uit;
}

/** Het eerste paddeel, zonder schuine strepen. */
export function eersteDeel(pad: string): string {
  return pad.replace(/^\/+/, "").split("/")[0] || "";
}

/**
 * Mag dit pad geopend worden? Onbekende paden en algemene pagina's blijven open --
 * dit slot gaat over afdelingsgegevens, niet over de rest van de app.
 */
export function magPad(pad: string, groepenKop: string | null): boolean {
  const deel = eersteDeel(pad);
  if (ALGEMEEN.includes(deel)) return true;
  const afdeling = AFDELING_VAN_PAD[deel];
  if (!afdeling) return true;
  return afdelingenVoor(groepenKop).has(afdeling);
}

/**
 * Mag deze bezoeker de teambeloning (teampot, bedragen per persoon, regels) zien?
 * Enkel `wp-alles` (directie en het salesteam zelf). Afdelingsteams zien wel de
 * teamdoel-balk (omzet tegenover het doel), maar niet wie er commissie op krijgt.
 */
export function magCommissie(groepenKop: string | null): boolean {
  const groepen = groepenUit(groepenKop);
  if (process.env.TOEGANG_DEV === "1" && groepen.length === 0) return true;
  return groepen.includes("wp-alles");
}

/**
 * Mag deze bezoeker het Bisson-overzicht zien (Engineering → Studiebureau Bisson)?
 * Strenger dan wp-alles: enkel de directie en Matthew (BISSON_KIJKERS, standaard siyan,
 * mehdi en matthew).
 * Het overzicht gaat over de samenwerking met de firma van een vennoot; het salesteam
 * en de afdelingen hoeven het niet te zien. Op gebruikersnaam, want daar bestaat geen
 * eigen Authentik-groep voor.
 */
export function magBisson(groepenKop: string | null, gebruiker: string | null): boolean {
  const groepen = groepenUit(groepenKop);
  if (process.env.TOEGANG_DEV === "1" && groepen.length === 0) return true;
  // Matthew (Engineering) leest het na en stelt per project vast wat klopt (Siyan, 13 okt 2026).
  const kijkers = (process.env.BISSON_KIJKERS || "siyan,mehdi,matthew")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
  return kijkers.includes((gebruiker || "").trim().toLowerCase());
}

/** Het architecten-klantenbestand (/architecten): klantgegevens over alle firma's heen, dus wp-alles. */
export function magArchitecten(groepenKop: string | null): boolean {
  const groepen = groepenUit(groepenKop);
  if (process.env.TOEGANG_DEV === "1" && groepen.length === 0) return true;
  return groepen.includes("wp-alles");
}

/**
 * Openbare aanbestedingen (/aanbestedingen, spec §19): toont de financiële toestand van de
 * firma's (eigen vermogen, achterstallige jaarrekeningen) naast de opdrachten. Enkel wp-alles.
 */
export function magAanbestedingen(groepenKop: string | null): boolean {
  const groepen = groepenUit(groepenKop);
  if (process.env.TOEGANG_DEV === "1" && groepen.length === 0) return true;
  return groepen.includes("wp-alles");
}
