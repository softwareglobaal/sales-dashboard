/**
 * Leesvragen voor de concurrentiepagina. Alles komt uit de laatste snapshot
 * per domein, zodat de pagina niet afhangt van het moment van de laatste crawl.
 */
import { getDb } from "./db";

export type ConcurrentRij = {
  domein: string;
  naam: string;
  categorie: string;
  verslaggevers: number;
  provincie: string;
  gemeente: string;
  bereikbaar: number | null;
  paginas: number | null;
  blog_paginas: number | null;
  laatste_blog: string | null;
  blog_per_maand: number | null;
  diensten: string | null;
  cms: string | null;
  titel: string | null;
  ttfb_ms: number | null;
  heeft_localbiz: number | null;
  heeft_sitemap: number | null;
  laatste_check: string | null;
  fout: string | null;
};

const LAATSTE_SNAPSHOT = `
  SELECT s.* FROM site_snapshots s
  JOIN (SELECT domein, MAX(datum) d FROM site_snapshots GROUP BY domein) m
    ON m.domein = s.domein AND m.d = s.datum
`;

export function concurrentieHeeftData(): boolean {
  const db = getDb();
  const r = db.prepare("SELECT COUNT(*) n FROM verslaggevers").get() as { n: number };
  return r.n > 0;
}

export function getMarktKpis() {
  const db = getDb();
  const k = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM verslaggevers)                                   AS erkenningen,
      (SELECT COUNT(DISTINCT naam) FROM verslaggevers)                       AS personen,
      (SELECT COUNT(*) FROM concurrenten WHERE categorie<>'eigen')           AS bedrijven,
      (SELECT COUNT(*) FROM concurrenten WHERE categorie='concurrent')       AS concurrenten,
      (SELECT COUNT(*) FROM concurrenten WHERE categorie='prospect')         AS prospects,
      (SELECT COUNT(*) FROM verslaggevers WHERE domein='')                   AS zonder_domein
  `).get() as Record<string, number>;

  const web = db.prepare(`
    SELECT
      COUNT(*)                                              AS gemeten,
      SUM(CASE WHEN bereikbaar=1 THEN 1 ELSE 0 END)         AS online,
      SUM(CASE WHEN blog_paginas > 0 THEN 1 ELSE 0 END)     AS met_blog,
      SUM(CASE WHEN blog_per_maand >= 1 THEN 1 ELSE 0 END)  AS actief_bloggend,
      AVG(NULLIF(paginas,0))                                AS gem_paginas
    FROM (${LAATSTE_SNAPSHOT})
  `).get() as Record<string, number>;

  return { ...k, ...web };
}

export function getConcurrenten(categorie?: string): ConcurrentRij[] {
  const db = getDb();
  const waar = categorie ? "WHERE c.categorie = ?" : "";
  const sql = `
    SELECT c.domein, c.naam, c.categorie, c.verslaggevers, c.provincie, c.gemeente, c.laatste_check,
           s.bereikbaar, s.paginas, s.blog_paginas, s.laatste_blog, s.blog_per_maand,
           s.diensten, s.cms, s.titel, s.ttfb_ms, s.heeft_localbiz, s.heeft_sitemap, s.fout
    FROM concurrenten c
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    ${waar}
    ORDER BY c.verslaggevers DESC, COALESCE(s.paginas,0) DESC, c.domein
  `;
  return (categorie ? db.prepare(sql).all(categorie) : db.prepare(sql).all()) as ConcurrentRij[];
}

/** Bedrijven met de meeste erkende verslaggevers: de zwaargewichten van de markt. */
export function getGrootsteBureaus(limiet = 15) {
  const db = getDb();
  return db.prepare(`
    SELECT c.naam, c.domein, c.verslaggevers, c.provincie,
           s.paginas, s.blog_paginas, s.blog_per_maand, s.bereikbaar, s.heeft_sitemap
    FROM concurrenten c
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE c.categorie <> 'eigen'
    ORDER BY c.verslaggevers DESC, COALESCE(s.paginas,0) DESC
    LIMIT ?
  `).all(limiet) as {
    naam: string; domein: string; verslaggevers: number; provincie: string;
    paginas: number | null; blog_paginas: number | null; blog_per_maand: number | null;
    bereikbaar: number | null; heeft_sitemap: number | null;
  }[];
}

export function getPerProvincie() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(NULLIF(provincie,''),'onbekend') provincie,
           COUNT(*) erkenningen,
           COUNT(DISTINCT NULLIF(domein,'')) domeinen
    FROM verslaggevers GROUP BY 1 ORDER BY erkenningen DESC
  `).all() as { provincie: string; erkenningen: number; domeinen: number }[];
}

/** Welke diensten bieden concurrenten aan, en hoe vaak. Dit legt de gaten bloot. */
export function getDienstenDekking() {
  const db = getDb();
  const rijen = db.prepare(`SELECT diensten FROM (${LAATSTE_SNAPSHOT}) WHERE diensten IS NOT NULL`).all() as { diensten: string }[];
  const telling = new Map<string, number>();
  for (const r of rijen) {
    let lijst: string[] = [];
    try { lijst = JSON.parse(r.diensten); } catch { lijst = []; }
    for (const d of lijst) telling.set(d, (telling.get(d) || 0) + 1);
  }
  const totaal = rijen.length || 1;
  return [...telling.entries()]
    .map(([dienst, n]) => ({ dienst, aantal: n, aandeel: n / totaal }))
    .sort((a, b) => b.aantal - a.aantal);
}

export function getSignalen(limiet = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.domein, s.datum, s.soort, s.omschrijving, s.url, s.gezien,
           COALESCE(NULLIF(c.naam,''), s.domein) naam
    FROM signalen s LEFT JOIN concurrenten c ON c.domein = s.domein
    ORDER BY s.datum DESC, s.id DESC LIMIT ?
  `).all(limiet) as {
    id: number; domein: string; datum: string; soort: string;
    omschrijving: string; url: string; gezien: number; naam: string;
  }[];
}

/** Erkend, maar nauwelijks online: geen concurrent maar een kandidaat voor onderaanneming. */
export function getOnderaannemingProspects(limiet = 40) {
  const db = getDb();
  return db.prepare(`
    SELECT v.naam, v.bedrijf, v.gemeente, v.provincie, v.domein, v.email, v.telefoon,
           s.paginas, s.bereikbaar
    FROM verslaggevers v
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = v.domein
    WHERE v.domein = '' OR s.bereikbaar = 0 OR COALESCE(s.paginas,0) <= 5
    ORDER BY v.provincie, v.gemeente, v.naam
    LIMIT ?
  `).all(limiet) as {
    naam: string; bedrijf: string; gemeente: string; provincie: string;
    domein: string; email: string; telefoon: string; paginas: number | null; bereikbaar: number | null;
  }[];
}

export function getCrawlStatus() {
  const db = getDb();
  return db.prepare(`
    SELECT (SELECT MAX(datum) FROM site_snapshots)                        AS laatste_crawl,
           (SELECT COUNT(*) FROM concurrenten WHERE laatste_check IS NULL) AS nooit_gecrawld,
           (SELECT COUNT(*) FROM site_snapshots WHERE datum = (SELECT MAX(datum) FROM site_snapshots)) AS gisteren_gemeten,
           (SELECT COUNT(*) FROM (${LAATSTE_SNAPSHOT}) WHERE fout <> '' AND fout IS NOT NULL) AS met_fout
  `).get() as { laatste_crawl: string | null; nooit_gecrawld: number; gisteren_gemeten: number; met_fout: number };
}
