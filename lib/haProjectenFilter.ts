/**
 * Projectenlijst H-Architects: de vorm van de gegevens en alles wat filtert.
 *
 * Deze module is bewust vrij van `fs` en van React, zodat zowel de
 * servercomponent (`app/h-architects/projecten/page.tsx`) als de
 * clientcomponent (`Projectenlijst.tsx`) hem mag gebruiken. Zo telt de
 * gemeentetabel "te fotograferen" met exact dezelfde regel als de snelknop.
 * Het inlezen van het bronbestand staat in `lib/haProjecten.ts`.
 */

export type Project = {
  nummer: string;
  adres: string;
  postcode: number | null;
  gemeente: string;
  provincie: string;
  jaar: number | null;
  /** Eén project kan meerdere typen dragen ("regularisatie, light"). */
  typen: string[];
  status: string; // lopend | archief | opgezegd
  fotos: string; // ja | nee | onbekend -- élk beeldbestand, dus ook plannen
  aantal: number;
  /** ISO-datum van het laatst gewijzigde beeldbestand, of null. */
  recentste: string | null;
  /** Beelden in een map waarvan de naam op oplevering wijst. Alleen nog als
   *  achtergrondgegeven; de beoordeling hieronder is wat telt. */
  oplevering: number;
  link: string;
  mapnaam: string;

  // --- beoordeling van 14 september 2026 (scripts/h-architects-oplevering.py) ---
  /** Beeldbestanden die er als camerafoto uitzien: jpg/jpeg/heic/heif zonder
   *  tekenwerk- of schermwoord in de bestandsnaam. png telt nooit mee. */
  camerafotos: number;
  /** ISO-datum van de recentste camerafoto, of null. */
  recentste_camerafoto: string | null;
  /** Staat het afgewerkte gebouw echt in beeld? Met het oog beoordeeld op de
   *  drie recentste camerafoto's: "ja" (afgewerkte gevel of afgewerkt
   *  interieur), "nee" (alleen werf, bestaande toestand, opmeting, of geen
   *  camerafoto), "onzeker" (niet uit te maken). */
  oplevering_beoordeling: Beoordeling;
  /** Het bestand met het beste beeld, als de beoordeling "ja" is. */
  oplevering_bestand: string | null;
  /** Datum van die beoordeling. */
  beoordeeld_op: string;
};

export type Beoordeling = "ja" | "nee" | "onzeker";

export type Projectenbron = {
  bron: string;
  /** Datum van de Dropbox-telling. */
  telling: string;
  /** Datum van de projectlijst waarop de telling gelegd is. */
  projectlijst: string;
  onleesbareMappen: { nummer: string; project: string }[];
  gedeeldeMappen: string[];
  /** De beeldbeoordeling: wanneer, hoe, en de drie totalen. */
  beoordeling?: {
    datum: string;
    methode: string;
    ja: number;
    nee: number;
    onzeker: number;
    contactbladen?: number;
    thumbnails?: number;
  };
  projecten: Project[];
};

/** Het jaar vanaf wanneer beeld als "recent" geldt. Zie de toelichting op de
 *  pagina: 213 van de 614 projecten hebben beeld van 2024 of later. */
export const RECENT_VANAF = 2024;

/** Het jaar van de recentste foto, of null als er geen beeld (of geen datum) is. */
export function beeldjaar(p: Project): number | null {
  if (!p.recentste) return null;
  const jaar = Number(p.recentste.slice(0, 4));
  return Number.isFinite(jaar) ? jaar : null;
}

/** Het jaar van de recentste camerafoto. Dat is scherper dan `beeldjaar`: een
 *  pas geëxporteerd plan maakt een dossier niet jong. */
export function camerajaar(p: Project): number | null {
  if (!p.recentste_camerafoto) return null;
  const jaar = Number(p.recentste_camerafoto.slice(0, 4));
  return Number.isFinite(jaar) ? jaar : null;
}

/** Rangorde voor het sorteren op de beoordeling: ja bovenaan, dan onzeker. */
export function beoordelingsrang(b: Beoordeling): number {
  return b === "ja" ? 2 : b === "onzeker" ? 1 : 0;
}

/**
 * De snelknop van Mehdi: welke gebouwen verdienen een bezoek met de camera.
 *
 * Twee voorwaarden samen:
 *  1. het afgewerkte gebouw staat niet zeker in beeld -- beoordeling "nee" of
 *     "onzeker" (onzeker is hier een reden om te gaan kijken, geen reden om
 *     over te slaan; dat geldt ook voor de mappen die Dropbox niet wil geven);
 *  2. het dossier is niet opgezegd.
 *
 * Het aantal foto's telt hier bewust NIET mee. Een map met 300 beelden kan
 * uitsluitend plannen, schermafdrukken en werffoto's bevatten; wat telt is of
 * er een foto van het resultaat is.
 */
export function teFotograferen(p: Project): boolean {
  if (p.status === "opgezegd") return false;
  return p.oplevering_beoordeling !== "ja";
}

export type Filters = {
  zoek: string;
  provincie: string;
  gemeente: string;
  van: string;
  tot: string;
  type: string;
  status: string;
  fotos: string;
  oplevering: string;
  beeldVanaf: string;
  focus: boolean;
};

export const LEEG: Filters = {
  zoek: "",
  provincie: "",
  gemeente: "",
  van: "",
  tot: "",
  type: "",
  status: "",
  fotos: "",
  oplevering: "",
  beeldVanaf: "",
  focus: false,
};

/** Zoeken op adres, gemeente, projectnummer en mapnaam, hoofdletterloos. */
function past(p: Project, zoek: string): boolean {
  const t = zoek.trim().toLowerCase();
  if (!t) return true;
  return (
    p.adres.toLowerCase().includes(t) ||
    p.gemeente.toLowerCase().includes(t) ||
    p.nummer.toLowerCase().includes(t) ||
    p.mapnaam.toLowerCase().includes(t) ||
    String(p.postcode ?? "").includes(t)
  );
}

export function filter(projecten: Project[], f: Filters): Project[] {
  const van = Number(f.van) || null;
  const tot = Number(f.tot) || null;
  const beeldVanaf = Number(f.beeldVanaf) || null;

  return projecten.filter((p) => {
    if (!past(p, f.zoek)) return false;
    if (f.provincie && p.provincie !== f.provincie) return false;
    if (f.gemeente && p.gemeente !== f.gemeente) return false;
    if (van && (p.jaar === null || p.jaar < van)) return false;
    if (tot && (p.jaar === null || p.jaar > tot)) return false;
    if (f.type && !p.typen.includes(f.type)) return false;
    if (f.status && p.status !== f.status) return false;
    // "Camerafoto's" volgt de kolom Foto's: onbekend blijft onbekend, ook als
    // de map zelf niet leesbaar was.
    if (f.fotos === "onbekend" && p.fotos !== "onbekend") return false;
    if (f.fotos === "ja" && p.camerafotos === 0) return false;
    if (f.fotos === "nee" && (p.camerafotos > 0 || p.fotos === "onbekend")) return false;
    if (f.oplevering && p.oplevering_beoordeling !== f.oplevering) return false;
    if (beeldVanaf) {
      const jaar = camerajaar(p);
      if (jaar === null || jaar < beeldVanaf) return false;
    }
    if (f.focus && !teFotograferen(p)) return false;
    return true;
  });
}

export type Sorteersleutel =
  | "nummer"
  | "gemeente"
  | "jaar"
  | "aantal"
  | "recentste"
  | "oplevering"
  | "status";

/** Standaard: `gemeente` oplopend, dat is provincie, dan gemeente, dan jaar
 *  aflopend. Klikken op een kop wisselt de eerste sleutel; daarbinnen blijft
 *  diezelfde rust staan, zodat de lijst nooit willekeurig door elkaar springt. */
export function sorteer(rijen: Project[], sleutel: Sorteersleutel, oplopend: boolean): Project[] {
  const richting = oplopend ? 1 : -1;
  const tekst = (a: string, b: string) => a.localeCompare(b, "nl-BE");
  const getal = (a: number | null, b: number | null) => (a ?? -1) - (b ?? -1);
  // "(onbekend)" en "(geen gemeente in mapnaam)" horen onderaan, niet bovenaan:
  // een haakje sorteert van nature vóór de letters.
  const plaats = (a: Project, b: Project) =>
    Number(a.provincie.startsWith("(")) - Number(b.provincie.startsWith("(")) ||
    tekst(a.provincie, b.provincie) ||
    Number(a.gemeente.startsWith("(")) - Number(b.gemeente.startsWith("(")) ||
    tekst(a.gemeente, b.gemeente);

  return [...rijen].sort((a, b) => {
    let v = 0;
    switch (sleutel) {
      case "gemeente":
        v = plaats(a, b);
        break;
      case "nummer":
        v = tekst(a.nummer, b.nummer);
        break;
      case "jaar":
        v = getal(a.jaar, b.jaar);
        break;
      case "aantal":
        v = a.camerafotos - b.camerafotos;
        break;
      case "recentste":
        v = tekst(a.recentste_camerafoto || "", b.recentste_camerafoto || "");
        break;
      case "oplevering":
        v = beoordelingsrang(a.oplevering_beoordeling) - beoordelingsrang(b.oplevering_beoordeling);
        break;
      case "status":
        v = tekst(a.status, b.status);
        break;
      default:
        v = 0;
    }
    if (v !== 0) return v * richting;
    // Binnen dezelfde waarde altijd dezelfde rust: provincie, gemeente, jaar aflopend.
    return plaats(a, b) || getal(b.jaar, a.jaar) || tekst(a.nummer, b.nummer);
  });
}

export type Gemeenterij = {
  gemeente: string;
  provincie: string;
  projecten: number;
  /** Projecten waarvan het afgewerkte gebouw in beeld staat (beoordeling "ja"). */
  inBeeld: number;
  /** Projecten met beoordeling "onzeker": wel camerafoto's, maar niet uit te maken. */
  onzeker: number;
  teFotograferen: number;
};

/** De tweede weergave: per gemeente, aflopend op aantal projecten. */
export function perGemeente(projecten: Project[]): Gemeenterij[] {
  const kaart = new Map<string, Gemeenterij>();
  for (const p of projecten) {
    const sleutel = p.gemeente + "|" + p.provincie;
    let rij = kaart.get(sleutel);
    if (!rij) {
      rij = {
        gemeente: p.gemeente,
        provincie: p.provincie,
        projecten: 0,
        inBeeld: 0,
        onzeker: 0,
        teFotograferen: 0,
      };
      kaart.set(sleutel, rij);
    }
    rij.projecten += 1;
    if (p.oplevering_beoordeling === "ja") rij.inBeeld += 1;
    if (p.oplevering_beoordeling === "onzeker") rij.onzeker += 1;
    if (teFotograferen(p)) rij.teFotograferen += 1;
  }
  return [...kaart.values()].sort(
    (a, b) => b.projecten - a.projecten || a.gemeente.localeCompare(b.gemeente, "nl-BE"),
  );
}

/** Keuzelijsten uit de gegevens zelf, zodat er nooit een waarde in het filter
 *  staat die niet in de lijst voorkomt. */
export function keuzes(projecten: Project[]) {
  const provincies = [...new Set(projecten.map((p) => p.provincie))].sort((a, b) =>
    a.localeCompare(b, "nl-BE"),
  );
  const typen = [...new Set(projecten.flatMap((p) => p.typen))].sort((a, b) =>
    a.localeCompare(b, "nl-BE"),
  );
  const statussen = [...new Set(projecten.map((p) => p.status))].sort((a, b) =>
    a.localeCompare(b, "nl-BE"),
  );
  const jaren = [...new Set(projecten.map((p) => p.jaar).filter((j): j is number => j !== null))]
    .sort((a, b) => a - b);
  return { provincies, typen, statussen, jaren };
}

// ---------------------------------------------------------------------------
// Filters in het adres. Een gefilterde lijst moet deelbaar zijn: wie de link
// doorstuurt, stuurt de selectie mee. De servercomponent leest de beginstand
// hiermee; de clientcomponent schrijft hem met history.replaceState terug,
// zodat het filteren geen herlaadbeurt kost.
// ---------------------------------------------------------------------------

export type Query = Record<string, string | string[] | undefined>;

function een(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || "";
}

export function uitQuery(q: Query): Filters {
  return {
    zoek: een(q.q),
    provincie: een(q.provincie),
    gemeente: een(q.gemeente),
    van: een(q.van),
    tot: een(q.tot),
    type: een(q.type),
    status: een(q.status),
    fotos: een(q.fotos),
    oplevering: een(q.oplevering),
    beeldVanaf: een(q.beeld),
    focus: een(q.focus) === "1",
  };
}

export function naarQuery(f: Filters, tabblad: string): string {
  const p = new URLSearchParams();
  if (f.zoek) p.set("q", f.zoek);
  if (f.provincie) p.set("provincie", f.provincie);
  if (f.gemeente) p.set("gemeente", f.gemeente);
  if (f.van) p.set("van", f.van);
  if (f.tot) p.set("tot", f.tot);
  if (f.type) p.set("type", f.type);
  if (f.status) p.set("status", f.status);
  if (f.fotos) p.set("fotos", f.fotos);
  if (f.oplevering) p.set("oplevering", f.oplevering);
  if (f.beeldVanaf) p.set("beeld", f.beeldVanaf);
  if (f.focus) p.set("focus", "1");
  if (tabblad === "gemeenten") p.set("tab", "gemeenten");
  const s = p.toString();
  return s ? "?" + s : "";
}

/** Staat er ergens een filter aan? Bepaalt of de wisknop getoond wordt. */
export function actief(f: Filters): boolean {
  return Object.entries(f).some(([, v]) => (typeof v === "boolean" ? v : v !== ""));
}

/** De gemeenten binnen de gekozen provincie (of alle, zonder keuze). */
export function gemeentenVan(projecten: Project[], provincie: string): string[] {
  return [
    ...new Set(
      projecten.filter((p) => !provincie || p.provincie === provincie).map((p) => p.gemeente),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl-BE"));
}
