// Toegang per afdeling, afgedwongen aan de serverkant.
//
// Tot nu toe kende dit dashboard geen afdelingsrechten: wie door de Authentik-login
// kwam, zag elke afdeling. Watch Tower verbergt de tegel wel, maar het adres bleef
// bereikbaar -- een slot op de voordeur met de achterdeur open. Dit sluit die deur.
//
// De regel is een naamafspraak, geen tweede lijst die kan verouderen: de
// Authentik-groep `wp-<afdeling>` geeft toegang tot die afdeling, `wp-alles` tot alles.
// Watch Tower gebruikt exact dezelfde afspraak.

/** Route in dit dashboard -> afdeling zoals Watch Tower hem noemt. */
export const AFDELING_VAN_PAD: Record<string, string> = {
  engineering: "engineering",
  energy: "energy",
  "3d-scanning": "3d-scanning",
  plaatsbeschrijving: "plaatsbeschrijving",
  meetstaten: "meetstaten",
  // Deze twee heten hier anders dan in het register. Op termijn de route
  // hernoemen zodat er één woordenlijst overblijft.
  safety: "veiligheidscoordinatie",
  "h-architects": "architectuur",
};

export const AFDELINGSPADEN = Object.keys(AFDELING_VAN_PAD);

/** Pagina's die niet bij één afdeling horen en dus voor iedereen open staan. */
const ALGEMEEN = ["", "kaart", "sales-team", "woordenboek", "applicaties", "seo-sea"];

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
