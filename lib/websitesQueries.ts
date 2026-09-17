// Leesqueries voor de tab Websites (spec §15). Alleen lezen uit data/websites.db.

import { meetDb, belgischeTijd, SITES } from "@/lib/websitesMeting";

export const PERIODES = [
  { key: "vandaag", label: "Vandaag", dagen: 1 },
  { key: "7d", label: "7 dagen", dagen: 7 },
  { key: "30d", label: "30 dagen", dagen: 30 },
  { key: "90d", label: "90 dagen", dagen: 90 },
  { key: "12m", label: "12 maanden", dagen: 365 },
] as const;
export type Periode = (typeof PERIODES)[number]["key"];
export const isPeriode = (p?: string): p is Periode => PERIODES.some((x) => x.key === p);

export type Bereik = { van: string; tot: string; vorigVan: string; vorigTot: string; dagen: string[]; label: string };

export function bereik(p: Periode): Bereik {
  const n = PERIODES.find((x) => x.key === p)!.dagen;
  const nu = Date.now();
  const dag = (terug: number) => belgischeTijd(nu - terug * 86400000).dag;
  const dagen: string[] = [];
  for (let i = n - 1; i >= 0; i--) dagen.push(dag(i));
  return { van: dag(n - 1), tot: dag(0), vorigVan: dag(2 * n - 1), vorigTot: dag(n), dagen, label: PERIODES.find((x) => x.key === p)!.label };
}

type Filter = { sql: string; args: unknown[] };
function filter(sites: string[], van: string, tot: string, alias = ""): Filter {
  const a = alias ? alias + "." : "";
  return {
    sql: `${a}site IN (${sites.map(() => "?").join(",")}) AND ${a}dag BETWEEN ? AND ?`,
    args: [...sites, van, tot],
  };
}
const alle = <T>(sql: string, args: unknown[]) => meetDb().prepare(sql).all(...args) as T[];
const een = <T>(sql: string, args: unknown[]) => meetDb().prepare(sql).get(...args) as T;

export function heeftMetingen(): boolean {
  return !!meetDb().prepare("SELECT 1 FROM sessies LIMIT 1").get();
}

/** Sites die in de keuze horen: live sites + sites waarvan al metingen binnenkomen. */
export function zichtbareSites() {
  const gemeten = new Set(alle<{ site: string }>("SELECT DISTINCT site FROM sessies", []).map((r) => r.site));
  return SITES.filter((s) => s.live || gemeten.has(s.sleutel)).map((s) => ({ ...s, gemeten: gemeten.has(s.sleutel) }));
}

// ---------- kerncijfers ----------

export type Kern = {
  bezoekers: number;
  sessies: number;
  weergaven: number;
  gemDuurS: number;
  betrokkenPct: number; // sessie > 10 s actief, of 2+ pagina's, of een conversie
  paginasPerSessie: number;
  conversies: number;
  conversieSessies: number;
  terugkerendPct: number;
  gemScroll: number;
};

function kernVoor(sites: string[], van: string, tot: string): Kern {
  const f = filter(sites, van, tot);
  const s = een<{ b: number; s: number; d: number; betr: number; p: number; c: number; cs: number; t: number }>(
    `SELECT COUNT(DISTINCT site || bezoeker) b, COUNT(*) s, COALESCE(AVG(actief_ms), 0) d,
       SUM(CASE WHEN actief_ms >= 10000 OR paginas >= 2 OR conversies > 0 THEN 1 ELSE 0 END) betr,
       COALESCE(SUM(paginas), 0) p, COALESCE(SUM(conversies), 0) c,
       SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) cs, SUM(terugkerend) t
     FROM sessies WHERE ${f.sql}`, f.args);
  const w = een<{ n: number; sc: number }>(`SELECT COUNT(*) n, COALESCE(AVG(scroll), 0) sc FROM weergaven WHERE ${f.sql}`, f.args);
  return {
    bezoekers: s.b || 0,
    sessies: s.s || 0,
    weergaven: w.n || 0,
    gemDuurS: Math.round((s.d || 0) / 1000),
    betrokkenPct: s.s ? (s.betr || 0) / s.s : 0,
    paginasPerSessie: s.s ? (s.p || 0) / s.s : 0,
    conversies: s.c || 0,
    conversieSessies: s.cs || 0,
    terugkerendPct: s.s ? (s.t || 0) / s.s : 0,
    gemScroll: Math.round(w.sc || 0),
  };
}

export function kern(sites: string[], b: Bereik) {
  return { nu: kernVoor(sites, b.van, b.tot), vorig: kernVoor(sites, b.vorigVan, b.vorigTot) };
}

export function perSite(sites: string[], b: Bereik) {
  return sites.map((s) => {
    const k = kernVoor([s], b.van, b.tot);
    const v = kernVoor([s], b.vorigVan, b.vorigTot);
    const f = filter([s], b.van, b.tot);
    const kanaal = een<{ kanaal: string; n: number } | undefined>(
      `SELECT kanaal, COUNT(*) n FROM sessies WHERE ${f.sql} GROUP BY kanaal ORDER BY n DESC LIMIT 1`, f.args);
    const be = een<{ n: number }>(`SELECT COUNT(*) n FROM sessies WHERE ${f.sql} AND land = 'BE'`, f.args);
    const mobiel = een<{ n: number }>(`SELECT COUNT(*) n FROM sessies WHERE ${f.sql} AND apparaat != 'desktop'`, f.args);
    return {
      site: s, ...k, vorigBezoekers: v.bezoekers,
      topKanaal: kanaal?.kanaal || null,
      bePct: k.sessies ? be.n / k.sessies : 0,
      mobielPct: k.sessies ? mobiel.n / k.sessies : 0,
    };
  });
}

/** Actieve bezoekers in de laatste 5 minuten. */
export function nuOnline(sites: string[]): number {
  return (een<{ n: number }>(
    `SELECT COUNT(*) n FROM sessies WHERE site IN (${sites.map(() => "?").join(",")}) AND laatst > ?`,
    [...sites, Date.now() - 5 * 60000],
  )).n;
}

// ---------- tijdreeksen ----------

/** Bezoekers per dag per site (voor de vergelijking) of per maand bij 12 maanden. */
export function reeksPerSite(sites: string[], b: Bereik, perMaand: boolean) {
  const f = filter(sites, b.van, b.tot);
  const sleutel = perMaand ? "substr(dag, 1, 7)" : "dag";
  const rijen = alle<{ d: string; site: string; n: number }>(
    `SELECT ${sleutel} d, site, COUNT(DISTINCT bezoeker) n FROM sessies WHERE ${f.sql} GROUP BY d, site`, f.args);
  const assen = perMaand ? [...new Set(b.dagen.map((d) => d.slice(0, 7)))] : b.dagen;
  return assen.map((d) => {
    const punt: Record<string, string | number> = { d };
    for (const s of sites) punt[s] = rijen.find((r) => r.d === d && r.site === s)?.n || 0;
    return punt;
  });
}

export function reeksKern(sites: string[], b: Bereik, perMaand: boolean) {
  const f = filter(sites, b.van, b.tot);
  const sleutel = perMaand ? "substr(dag, 1, 7)" : "dag";
  const s = alle<{ d: string; b: number; s: number }>(
    `SELECT ${sleutel} d, COUNT(DISTINCT site || bezoeker) b, COUNT(*) s FROM sessies WHERE ${f.sql} GROUP BY d`, f.args);
  const w = alle<{ d: string; n: number }>(`SELECT ${sleutel} d, COUNT(*) n FROM weergaven WHERE ${f.sql} GROUP BY d`, f.args);
  const assen = perMaand ? [...new Set(b.dagen.map((d) => d.slice(0, 7)))] : b.dagen;
  return assen.map((d) => ({
    d,
    bezoekers: s.find((r) => r.d === d)?.b || 0,
    sessies: s.find((r) => r.d === d)?.s || 0,
    weergaven: w.find((r) => r.d === d)?.n || 0,
  }));
}

/** Sessies per weekdag x uur (Belgische tijd). */
export function uurRaster(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ weekdag: number; uur: number; n: number }>(
    `SELECT weekdag, uur, COUNT(*) n FROM sessies WHERE ${f.sql} GROUP BY weekdag, uur`, f.args);
}

// ---------- herkomst ----------

export function kanalen(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ kanaal: string; sessies: number; bezoekers: number; betrokken: number; conversies: number; gemDuurS: number }>(
    `SELECT kanaal, COUNT(*) sessies, COUNT(DISTINCT site || bezoeker) bezoekers,
       SUM(CASE WHEN actief_ms >= 10000 OR paginas >= 2 OR conversies > 0 THEN 1 ELSE 0 END) betrokken,
       SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) conversies,
       CAST(AVG(actief_ms) / 1000 AS INTEGER) gemDuurS
     FROM sessies WHERE ${f.sql} GROUP BY kanaal ORDER BY sessies DESC`, f.args);
}

export function kanaalPerSite(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ site: string; kanaal: string; n: number }>(
    `SELECT site, kanaal, COUNT(*) n FROM sessies WHERE ${f.sql} GROUP BY site, kanaal`, f.args);
}

export function bronnen(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ kanaal: string; bron: string; campagne: string | null; sessies: number; conversies: number }>(
    `SELECT kanaal, bron, campagne, COUNT(*) sessies, SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) conversies
     FROM sessies WHERE ${f.sql} AND kanaal != 'Direct' GROUP BY kanaal, bron, campagne ORDER BY sessies DESC LIMIT 25`, f.args);
}

// ---------- pagina's ----------

export function instappaginas(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ site: string; pad: string; sessies: number; bounce: number; gemDuurS: number; paginas: number; conversies: number }>(
    `SELECT site, instap pad, COUNT(*) sessies,
       AVG(CASE WHEN actief_ms < 10000 AND paginas < 2 AND conversies = 0 THEN 1.0 ELSE 0 END) bounce,
       CAST(AVG(actief_ms) / 1000 AS INTEGER) gemDuurS, AVG(paginas) paginas,
       SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) conversies
     FROM sessies WHERE ${f.sql} GROUP BY site, instap ORDER BY sessies DESC LIMIT 25`, f.args);
}

export function uitstappaginas(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ site: string; pad: string; n: number }>(
    `SELECT site, uitstap pad, COUNT(*) n FROM sessies WHERE ${f.sql} GROUP BY site, uitstap ORDER BY n DESC LIMIT 15`, f.args);
}

export function paginas(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot, "w");
  return alle<{ site: string; pad: string; titel: string; weergaven: number; bezoekers: number; gemActiefS: number; gemScroll: number; klikken: number }>(
    `SELECT w.site, w.pad, MAX(w.titel) titel, COUNT(*) weergaven, COUNT(DISTINCT w.sessie) bezoekers,
       CAST(AVG(NULLIF(w.actief_ms, 0)) / 1000 AS INTEGER) gemActiefS, CAST(AVG(w.scroll) AS INTEGER) gemScroll,
       (SELECT COUNT(*) FROM klikken k WHERE k.site = w.site AND k.pad = w.pad AND k.dag BETWEEN ? AND ?) klikken
     FROM weergaven w WHERE ${f.sql} GROUP BY w.site, w.pad ORDER BY weergaven DESC LIMIT 40`, [b.van, b.tot, ...f.args]);
}

/** Meest gevolgde stappen tussen pagina's (van -> naar). */
export function paden(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ site: string; van: string; naar: string; n: number }>(
    `SELECT site, vorig van, pad naar, COUNT(*) n FROM weergaven WHERE ${f.sql} AND vorig IS NOT NULL AND vorig != pad
     GROUP BY site, vorig, pad ORDER BY n DESC LIMIT 20`, f.args);
}

export function paginaKeuze(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ site: string; pad: string; n: number }>(
    `SELECT site, pad, COUNT(*) n FROM weergaven WHERE ${f.sql} GROUP BY site, pad ORDER BY n DESC LIMIT 60`, f.args);
}

// ---------- locatie ----------

export function landen(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ land: string | null; sessies: number; bezoekers: number }>(
    `SELECT land, COUNT(*) sessies, COUNT(DISTINCT site || bezoeker) bezoekers FROM sessies WHERE ${f.sql}
     GROUP BY land ORDER BY sessies DESC LIMIT 20`, f.args);
}

export function regios(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ land: string | null; regio: string | null; provincie: string | null; sessies: number }>(
    `SELECT land, regio, provincie, COUNT(*) sessies FROM sessies WHERE ${f.sql}
     GROUP BY land, regio, provincie ORDER BY sessies DESC LIMIT 25`, f.args);
}

export function steden(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ land: string | null; provincie: string | null; stad: string | null; lat: number | null; lon: number | null; sessies: number; conversies: number }>(
    `SELECT land, MAX(provincie) provincie, stad, AVG(lat) lat, AVG(lon) lon, COUNT(*) sessies,
       SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) conversies
     FROM sessies WHERE ${f.sql} AND stad IS NOT NULL GROUP BY land, stad ORDER BY sessies DESC LIMIT 150`, f.args);
}

// ---------- gedrag ----------

export function kliksoorten(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  return alle<{ soort: string; n: number }>(`SELECT soort, COUNT(*) n FROM klikken WHERE ${f.sql} GROUP BY soort ORDER BY n DESC`, f.args);
}

export function topKlikken(sites: string[], b: Bereik, pad?: string) {
  const f = filter(sites, b.van, b.tot);
  const extra = pad ? " AND pad = ?" : "";
  return alle<{ site: string; soort: string; tekst: string | null; doel: string | null; n: number; paginas: number }>(
    `SELECT site, soort, tekst, doel, COUNT(*) n, COUNT(DISTINCT pad) paginas FROM klikken WHERE ${f.sql}${extra}
     GROUP BY site, soort, tekst, doel ORDER BY n DESC LIMIT 30`, pad ? [...f.args, pad] : f.args);
}

/** Klikposities op één pagina, genormaliseerd: x en y in promille van breedte/hoogte. */
export function klikkaart(site: string, pad: string, b: Bereik, apparaat: "desktop" | "mobiel") {
  const f = filter([site], b.van, b.tot);
  const breed = apparaat === "desktop" ? "vw >= 900" : "vw < 900";
  return alle<{ x: number; y: number; soort: string; tekst: string | null }>(
    `SELECT x, CAST(y * 1000.0 / doc_h AS INTEGER) y, soort, tekst FROM klikken
     WHERE ${f.sql} AND pad = ? AND x IS NOT NULL AND y IS NOT NULL AND doc_h > 0 AND ${breed} ORDER BY id DESC LIMIT 4000`,
    [...f.args, pad]);
}

/** Aandacht per sectie: hoeveel van de bezoekers ze zagen en hoe lang, met de positie op de pagina. */
export function sectieAandacht(site: string, pad: string, b: Bereik, apparaat: "desktop" | "mobiel") {
  const f = filter([site], b.van, b.tot, "s");
  const breed = apparaat === "desktop" ? "w.vw >= 900" : "w.vw < 900";
  const totaal = een<{ n: number }>(
    `SELECT COUNT(*) n FROM weergaven w WHERE w.site = ? AND w.dag BETWEEN ? AND ? AND w.pad = ? AND ${breed}`,
    [site, b.van, b.tot, pad]).n;
  const rijen = alle<{ naam: string; volgorde: number; gezien: number; gemMs: number; y: number; h: number }>(
    `SELECT s.naam, MIN(s.volgorde) volgorde, SUM(CASE WHEN s.ms >= 1000 THEN 1 ELSE 0 END) gezien,
       CAST(AVG(CASE WHEN s.ms >= 1000 THEN s.ms END) AS INTEGER) gemMs,
       CAST(AVG(s.y * 1000.0 / NULLIF(s.doc_h, 0)) AS INTEGER) y, CAST(AVG(s.h * 1000.0 / NULLIF(s.doc_h, 0)) AS INTEGER) h
     FROM secties s JOIN weergaven w ON w.id = s.weergave
     WHERE ${f.sql} AND s.pad = ? AND ${breed} GROUP BY s.naam ORDER BY volgorde`, [...f.args, pad]);
  return { totaal, rijen };
}

/** Hoeveel procent van de weergaven haalde 25/50/75/100% van de pagina. */
export function scrolldiepte(sites: string[], b: Bereik, pad?: string) {
  const f = filter(sites, b.van, b.tot);
  const extra = pad ? " AND pad = ?" : "";
  const r = een<{ n: number; p25: number; p50: number; p75: number; p100: number }>(
    `SELECT COUNT(*) n, SUM(scroll >= 25) p25, SUM(scroll >= 50) p50, SUM(scroll >= 75) p75, SUM(scroll >= 95) p100
     FROM weergaven WHERE ${f.sql}${extra}`, pad ? [...f.args, pad] : f.args);
  const n = r.n || 0;
  return { n, stappen: [25, 50, 75, 100].map((p, i) => ({ p, aandeel: n ? ([r.p25, r.p50, r.p75, r.p100][i] || 0) / n : 0 })) };
}

// ---------- techniek ----------

export function verdeling(sites: string[], b: Bereik, kolom: "apparaat" | "browser" | "os" | "taal") {
  const f = filter(sites, b.van, b.tot);
  const expr = kolom === "taal" ? "lower(substr(taal, 1, 2))" : kolom;
  return alle<{ waarde: string | null; n: number }>(
    `SELECT ${expr} waarde, COUNT(*) n FROM sessies WHERE ${f.sql} GROUP BY waarde ORDER BY n DESC LIMIT 10`, f.args);
}

/** 75e percentiel van de laadsnelheid, zoals Google het meet. */
export function snelheid(sites: string[], b: Bereik) {
  const f = filter(sites, b.van, b.tot);
  const p75 = (kolom: string) => {
    const w = alle<{ v: number }>(`SELECT ${kolom} v FROM weergaven WHERE ${f.sql} AND ${kolom} IS NOT NULL ORDER BY ${kolom}`, f.args);
    return w.length ? w[Math.min(w.length - 1, Math.floor(w.length * 0.75))].v : null;
  };
  const perPagina = alle<{ site: string; pad: string; n: number; lcp: number | null; laad: number | null }>(
    `SELECT site, pad, COUNT(lcp) n, CAST(AVG(lcp) AS INTEGER) lcp, CAST(AVG(laad) AS INTEGER) laad
     FROM weergaven WHERE ${f.sql} GROUP BY site, pad HAVING n >= 3 ORDER BY lcp DESC LIMIT 10`, f.args);
  return { lcp: p75("lcp"), inp: p75("inp"), cls: p75("cls"), ttfb: p75("ttfb"), laad: p75("laad"), traagste: perPagina };
}

// ---------- live ----------

export function recent(sites: string[]) {
  return alle<{ ts: number; site: string; pad: string; stad: string | null; land: string | null; kanaal: string | null; apparaat: string | null }>(
    `SELECT w.ts, w.site, w.pad, s.stad, s.land, s.kanaal, s.apparaat FROM weergaven w JOIN sessies s ON s.id = w.sessie
     WHERE w.site IN (${sites.map(() => "?").join(",")}) ORDER BY w.ts DESC LIMIT 25`, sites);
}

/** Afmetingen van een pagina en de scrolldiepte per weergave, voor de klikkaart. */
export function paginaMaat(site: string, pad: string, b: Bereik, apparaat: "desktop" | "mobiel") {
  const breed = apparaat === "desktop" ? "vw >= 900" : "vw < 900";
  const r = een<{ n: number; docH: number | null; vw: number | null }>(
    `SELECT COUNT(*) n, AVG(doc_h) docH, AVG(vw) vw FROM weergaven WHERE site = ? AND dag BETWEEN ? AND ? AND pad = ? AND ${breed}`,
    [site, b.van, b.tot, pad]);
  const scrolls = alle<{ s: number }>(
    `SELECT scroll s FROM weergaven WHERE site = ? AND dag BETWEEN ? AND ? AND pad = ? AND ${breed}`,
    [site, b.van, b.tot, pad]).map((x) => x.s);
  return { n: r.n || 0, docH: r.docH || 0, vw: r.vw || 0, scrolls };
}

/** Laatste meting per site: zo is meteen zichtbaar op welke site het script ontbreekt. */
export function laatsteMeting() {
  return alle<{ site: string; laatst: number; vandaag: number }>(
    `SELECT site, MAX(laatst) laatst, SUM(CASE WHEN laatst > ? THEN 1 ELSE 0 END) vandaag FROM sessies GROUP BY site`,
    [Date.now() - 86400000]);
}
