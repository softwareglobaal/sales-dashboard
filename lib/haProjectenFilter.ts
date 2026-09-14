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
  fotos: string; // ja | nee | onbekend
  aantal: number;
  /** ISO-datum van het laatst gewijzigde beeldbestand, of null. */
  recentste: string | null;
  oplevering: number;
  link: string;
  mapnaam: string;
};

export type Projectenbron = {
  bron: string;
  /** Datum van de Dropbox-telling. */
  telling: string;
  /** Datum van de projectlijst waarop de telling gelegd is. */
  projectlijst: string;
  onleesbareMappen: { nummer: string; project: string }[];
  gedeeldeMappen: string[];
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

/**
 * De snelknop van Mehdi: welke gebouwen verdienen een bezoek met de camera.
 *
 * Drie voorwaarden samen:
 *  1. geen opleveringsfoto's (de scherpste aanwijzing dat er een reportage is);
 *  2. geen beeld, of geen beeld meer sinds 2024 (een map zonder datum telt als
 *     "geen beeld" -- ook de zes mappen die Dropbox niet wil geven, want
 *     onbekend is hier een reden om te gaan kijken, geen reden om over te slaan);
 *  3. het dossier is niet opgezegd.
 *
 * De kolom "Foto's aanwezig" telt hier bewust NIET mee: die staat op "ja" zodra
 * er één png in de map zit, en dat is meestal een plan of een schermafdruk.
 */
export function teFotograferen(p: Project): boolean {
  if (p.oplevering > 0) return false;
  if (p.status === "opgezegd") return false;
  const jaar = beeldjaar(p);
  return jaar === null || jaar < RECENT_VANAF;
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
    if (f.fotos && p.fotos !== f.fotos) return false;
    if (f.oplevering === "ja" && p.oplevering === 0) return false;
    if (f.oplevering === "nee" && p.oplevering > 0) return false;
    if (beeldVanaf) {
      const jaar = beeldjaar(p);
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
        v = a.aantal - b.aantal;
        break;
      case "recentste":
        v = tekst(a.recentste || "", b.recentste || "");
        break;
      case "oplevering":
        v = a.oplevering - b.oplevering;
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
  metFoto: number;
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
        metFoto: 0,
        teFotograferen: 0,
      };
      kaart.set(sleutel, rij);
    }
    rij.projecten += 1;
    if (p.fotos === "ja") rij.metFoto += 1;
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
