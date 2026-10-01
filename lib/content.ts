// Proactieve content (spec §17): het dashboard zet kansen klaar, de SEO-agents werken
// ze uit, Siyan keurt goed. Eén goedkeuringsmoment aan het einde (keuze Siyan,
// 1 oktober 2026): de agents toetsen zelf of een onderwerp bij ons past, doen het
// onderzoek, schrijven en laten QC lopen; daarna komt het hier op "wacht op jou".
//
// Twee soorten kansen per markt:
//  - herschrijf: overheid/portalen staan in de top 5 op onze zoekterm met volume
//    (getHerschrijfKansen); daar kan een betere pagina van ons komen;
//  - concurrent-blog: een echte concurrent in de markt publiceerde een nieuw artikel
//    waarvan het pad over ons vak gaat (laatste 21 dagen).
// Het dashboard schrijft zelf niets naar websites: dat blijft de website-keten.

import { getDb } from "./db";
import { getHerschrijfKansen, geenConcurrentVoor, type Markt } from "./concurrentieQueries";
import cfg from "@/config/afdelingen.json";

export const MARKTEN: { markt: Markt; dienst: string; firma: string; sites: string[]; woorden: string[] }[] = [
  { markt: "energie", dienst: "energy", firma: "Energie Efficiënt", sites: ["energie-efficient.be", "epb-boete.be"], woorden: ["epb", "energie", "ventilat", "epc", "renovatieplicht", "isolat", "warmtepomp", "blowerdoor", "verslaggev"] },
  { markt: "engineering", dienst: "engineering", firma: "UNABO", sites: ["unabo.be", "tkn-buro.be"], woorden: ["stabilit", "draagmuur", "ingenieur", "constructie", "ligger", "fundering", "scheur", "meetstaat"] },
  { markt: "regularisatie", dienst: "regularisatie", firma: "Regulariseren.be", sites: ["regulariseren.be", "mijnregularisatie.be"], woorden: ["regularis", "bouwovertreding", "vergunning", "stedenbouw", "vermoeden", "omgevingsvergunning"] },
  { markt: "architectuur", dienst: "h-architects", firma: "H-Architects", sites: ["h-architects.be"], woorden: ["architect", "verbouw", "renovatie", "nieuwbouw", "aanbouw", "dakkapel", "ontwerp"] },
];

export type Kans = {
  id: string; // stabiel: soort + markt + url/term
  soort: "herschrijf" | "concurrent-blog";
  markt: Markt;
  dienst: string;
  firma: string;
  doelsites: string[];
  onderwerp: string;
  bron: string; // url van de concurrent of de pagina die de term bezet
  context: string;
  volume: number | null;
  datum: string | null;
};

export type ContentStatus = "in-behandeling" | "niet-passend" | "wacht-op-goedkeuring" | "goedgekeurd" | "afgewezen";
export type ContentOpdracht = {
  kans_id: string; soort: string; markt: string; dienst: string; firma: string; titel: string;
  status: ContentStatus; samenvatting: string | null; tekst: string | null; qc: string | null;
  bestand: string | null; door: string | null; bijgewerkt: string; aangemaakt: string;
};

function tabel() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS content_opdrachten (
      kans_id TEXT PRIMARY KEY, soort TEXT, markt TEXT, dienst TEXT, firma TEXT, titel TEXT,
      status TEXT NOT NULL, samenvatting TEXT, tekst TEXT, qc TEXT, bestand TEXT, door TEXT,
      bijgewerkt TEXT NOT NULL, aangemaakt TEXT NOT NULL
    );
  `);
}

/** Open kansen: nog niet opgepakt (of opnieuw te bekijken na een afwijzing van 90+ dagen). */
export function kansen(max = 30): Kans[] {
  tabel();
  const db = getDb();
  const behandeld = new Set((db.prepare("SELECT kans_id FROM content_opdrachten").all() as any[]).map((r) => r.kans_id));
  const uit: Kans[] = [];
  const vanaf = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  for (const m of MARKTEN) {
    for (const h of getHerschrijfKansen(8, m.markt)) {
      uit.push({
        id: `herschrijf:${m.markt}:${h.term}`,
        soort: "herschrijf",
        markt: m.markt, dienst: m.dienst, firma: m.firma, doelsites: m.sites,
        onderwerp: h.term,
        bron: h.url,
        context: `"${h.term}" (${h.volume ?? "?"} zoekopdrachten/maand) staat op #${h.positie} bezet door ${h.domein} (${h.categorie}), niet door een concurrent. Een sterkere eigen pagina kan die plek nemen.`,
        volume: h.volume ?? null,
        datum: null,
      });
    }
    const geen = geenConcurrentVoor(m.markt);
    const like = m.woorden.map(() => "lower(s.url) LIKE ?").join(" OR ");
    const blogs = db.prepare(`
      SELECT s.url, s.domein, s.datum, COALESCE(NULLIF(c.naam,''), s.domein) naam
      FROM signalen s
      JOIN concurrenten c ON c.domein = s.domein
      LEFT JOIN beoordelingen b ON b.soort = 'domein' AND b.sleutel = c.domein
      WHERE s.soort = 'nieuwe-blog' AND s.datum >= ?
        AND s.domein IN (SELECT domein FROM concurrent_markt WHERE markt = ?)
        AND COALESCE(NULLIF(b.oordeel,''), c.categorie, 'onbekend') NOT IN (${geen.map(() => "?").join(",")})
        AND (${like})
      ORDER BY s.datum DESC LIMIT 15
    `).all(vanaf, m.markt, ...geen, ...m.woorden.map((w) => `%${w}%`)) as any[];
    for (const b of blogs) {
      uit.push({
        id: `blog:${m.markt}:${b.url}`,
        soort: "concurrent-blog",
        markt: m.markt, dienst: m.dienst, firma: m.firma, doelsites: m.sites,
        onderwerp: decodeURIComponent(String(b.url).replace(/\/$/, "").split("/").pop() || b.url).replace(/[-_]/g, " "),
        bron: b.url,
        context: `${b.naam} publiceerde op ${b.datum} een nieuw artikel. Toets of het onderwerp bij ons past en of wij er een beter artikel over kunnen plaatsen.`,
        volume: null,
        datum: b.datum,
      });
    }
  }
  // Eén kans per id (een term kan door meerdere pagina's bezet zijn); Franstalige
  // pagina's vallen weg, onze sites zijn Nederlandstalig.
  const gezien = new Set<string>();
  return uit
    .filter((k) => !behandeld.has(k.id) && !gezien.has(k.id) && gezien.add(k.id))
    .filter((k) => !/\/fr(-[a-z]{2})?\//.test(k.bron))
    .slice(0, max);
}

export function opdrachten(status?: ContentStatus): ContentOpdracht[] {
  tabel();
  const db = getDb();
  return (status
    ? db.prepare("SELECT * FROM content_opdrachten WHERE status = ? ORDER BY bijgewerkt DESC").all(status)
    : db.prepare("SELECT * FROM content_opdrachten ORDER BY bijgewerkt DESC LIMIT 200").all()) as ContentOpdracht[];
}

export function aantalWachtend(): number {
  tabel();
  return (getDb().prepare("SELECT COUNT(*) n FROM content_opdrachten WHERE status = 'wacht-op-goedkeuring'").get() as any).n;
}

const STATUSSEN: ContentStatus[] = ["in-behandeling", "niet-passend", "wacht-op-goedkeuring", "goedgekeurd", "afgewezen"];

/** Door de agents: een kans oppakken of het resultaat melden. */
export function meld(o: Partial<ContentOpdracht> & { kans_id: string; status: ContentStatus }) {
  if (!STATUSSEN.includes(o.status)) throw new Error(`onbekende status ${o.status}`);
  tabel();
  const nu = new Date().toISOString();
  const db = getDb();
  const oud = db.prepare("SELECT * FROM content_opdrachten WHERE kans_id = ?").get(o.kans_id) as ContentOpdracht | undefined;
  // Lege velden in een melding wissen niets: enkel wat meegegeven wordt, overschrijft.
  const nieuw = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
  const r = { ...(oud || {}), ...nieuw, bijgewerkt: nu, aangemaakt: oud?.aangemaakt || nu } as ContentOpdracht;
  const velden = ["soort", "markt", "dienst", "firma", "titel", "samenvatting", "tekst", "qc", "bestand", "door"] as const;
  const rij: Record<string, unknown> = { kans_id: r.kans_id, status: r.status, bijgewerkt: r.bijgewerkt, aangemaakt: r.aangemaakt };
  for (const v of velden) rij[v] = (r as any)[v] ?? null;
  db.prepare(`INSERT OR REPLACE INTO content_opdrachten
    (kans_id, soort, markt, dienst, firma, titel, status, samenvatting, tekst, qc, bestand, door, bijgewerkt, aangemaakt)
    VALUES (@kans_id, @soort, @markt, @dienst, @firma, @titel, @status, @samenvatting, @tekst, @qc, @bestand, @door, @bijgewerkt, @aangemaakt)`)
    .run(rij);
  return r;
}

/** Door Siyan (of een andere editor): goedkeuren of afwijzen, met naam uit de login. */
export function oordeel(kans_id: string, goed: boolean, door: string) {
  return meld({ kans_id, status: goed ? "goedgekeurd" : "afgewezen", door });
}

export const DIENST_NAAM = Object.fromEntries((cfg.afdelingen as any[]).map((a) => [a.pad, a.naam]));
