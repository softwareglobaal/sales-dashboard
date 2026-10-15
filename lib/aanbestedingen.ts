// Openbare aanbestedingen (spec §19). De Tenderwachter (vakagent overheidsopdrachten) zoekt
// elke werkdag aanbestedingen per firma op en toetst ze aan de situatie van die firma. Zijn
// scan op de AppPortal-server stuurt de stand als één momentopname naar /api/v1/aanbestedingen;
// dit dashboard bewaart de laatste en toont ze. Het dashboard rekent zelf niets na: het
// oordeel ("kunnen we meedoen") komt van de agent of van zijn vaste toets.

import { getDb } from "./db";

export type OordeelStatus = "ja" | "als" | "nee";

export type Treffer = {
  sleutel: string;
  titel: string;
  aanbesteder: string;
  bron: string;
  niveau: "EU" | "nationaal";
  deadline: string | null;
  waarde: number | null;
  valuta: string | null;
  procedure: string | null;
  cpv: string[];
  url: string | null;
  past: string[]; // waarom de scan hem vond (CPV, trefwoord, voorrang)
  score: number | null;
  oordeel: {
    status: OordeelStatus;
    reden: string | null; // oordeel van De Tenderwachter
    redenen: string[]; // vaste toets
    nodig: string | null; // wat er moet gebeuren om wel mee te kunnen doen
    vereisten: Vereiste[]; // nagekeken in de opdrachtdocumenten (verplicht voor "ja")
    documenten_gelezen: string[];
    door: string;
    datum: string | null;
    dossier: string | null;
  };
  map: { pad: string; link: string } | null; // Dropbox-map met fiche en documenten
  opdracht: string;
  beschrijving?: string;
};

export type Vereiste = { eis: string; bron: string; voldoen: "ja" | "nee" | "onbekend"; toelichting: string };

export type SamenRol = {
  firma: string;
  naam: string;
  dienst: string;
  waarom: string;
  status: OordeelStatus;
  reden: string;
  nodig: string | null;
};

export type SamenOpdracht = {
  opdracht: string;
  titel: string;
  aanbesteder: string;
  bron: string;
  niveau: "EU" | "nationaal";
  deadline: string | null;
  url: string | null;
  map: { pad: string; link: string } | null;
  rollen: SamenRol[];
  ontbreekt: string[];
  status: OordeelStatus;
  advies: string | null;
};

export type Punt = { onderwerp: string; stand: string; kleur: "rood" | "oranje" | "groen"; gevolg: string };
export type BosaProfiel = {
  naam: string;
  onderneming: string;
  aard: string;
  cpv: [string, string][];
  regio: [string, string][];
  status: string;
};
export type Alternatief = { optie: string; oordeel: string; waarom: string };

export type Firma = {
  code: string;
  naam: string;
  land: "BE" | "SR";
  plaats: string;
  samenvatting: string;
  punten: Punt[];
  nodig: string[];
  criteria: {
    bosa: BosaProfiel[];
    scan: {
      bronnen: string[];
      cpv: [string, string][];
      regio: [string, string][];
      max_bedrag: number | null;
      trefwoorden: string[];
      uitsluiten: string[];
      voorrang: string[];
    };
    bronnen_uitleg: { bron: string; wat: string; hoe: string }[];
    waarom: string | null;
    alternatieven: Alternatief[];
  };
  treffers: Treffer[];
};

export type Momentopname = {
  bijgewerkt: string;
  bronnen: { bron: string; datum: string; status: "ok" | "oud" | "fout"; uitleg: string }[];
  firmas: Firma[];
  samen?: SamenOpdracht[]; // opdrachten waarop meerdere van onze firma's samen kunnen inschrijven
};

function tabel() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS aanbestedingen_stand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontvangen TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
}

/** Minimale vormcontrole: liever een duidelijke fout dan een halve pagina. */
export function controleer(m: any): string | null {
  if (!m || typeof m !== "object") return "Geen object.";
  if (typeof m.bijgewerkt !== "string") return "bijgewerkt ontbreekt.";
  if (!Array.isArray(m.firmas) || m.firmas.length === 0) return "firmas ontbreekt of is leeg.";
  for (const f of m.firmas) {
    if (!f?.code || !f?.naam || !Array.isArray(f?.treffers)) return `Firma zonder code, naam of treffers.`;
    for (const t of f.treffers) {
      if (!t?.sleutel || !t?.titel || !["ja", "als", "nee"].includes(t?.oordeel?.status)) {
        return `Treffer zonder sleutel, titel of geldig oordeel bij ${f.code}.`;
      }
    }
  }
  return null;
}

/** Bewaart een nieuwe stand; houdt de laatste 30 bij (genoeg om terug te kijken). */
export function bewaar(m: Momentopname): number {
  tabel();
  const db = getDb();
  const r = db
    .prepare("INSERT INTO aanbestedingen_stand (ontvangen, data) VALUES (?, ?)")
    .run(new Date().toISOString(), JSON.stringify(m));
  db.prepare("DELETE FROM aanbestedingen_stand WHERE id NOT IN (SELECT id FROM aanbestedingen_stand ORDER BY id DESC LIMIT 30)").run();
  return Number(r.lastInsertRowid);
}

export function laatste(): (Momentopname & { ontvangen: string }) | null {
  tabel();
  const r = getDb().prepare("SELECT ontvangen, data FROM aanbestedingen_stand ORDER BY id DESC LIMIT 1").get() as
    | { ontvangen: string; data: string }
    | undefined;
  if (!r) return null;
  try {
    return { ...(JSON.parse(r.data) as Momentopname), ontvangen: r.ontvangen };
  } catch {
    return null;
  }
}

/** Dagen tot de deadline (negatief = voorbij), null als onbekend. */
export function dagenTot(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline.slice(0, 10) + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const nu = new Date();
  nu.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - nu.getTime()) / 86400000);
}
