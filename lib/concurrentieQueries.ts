/**
 * Leesvragen voor de concurrentiepagina. Alles komt uit de laatste snapshot
 * per domein, zodat de pagina niet afhangt van het moment van de laatste crawl.
 */
import { getDb } from "./db";
import { LEAD_SCOPE } from "./energyQueries";
import { parseProjectLocation } from "./regio";
import { UNABO_ADDR_HASH } from "./queries";

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
  blog_artikels: number | null;
  laatste_blog_url: string | null;
  epb_paginas: number | null;
  spam_verdacht: number | null;
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
      SUM(CASE WHEN blog_artikels > 0 THEN 1 ELSE 0 END)    AS met_blog,
      SUM(CASE WHEN laatste_blog >= date('now','-90 days') THEN 1 ELSE 0 END) AS actief_bloggend,
      SUM(CASE WHEN spam_verdacht > 0 THEN 1 ELSE 0 END)    AS gehackt,
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
           s.diensten, s.cms, s.titel, s.ttfb_ms, s.heeft_localbiz, s.heeft_sitemap,
           s.blog_artikels, s.laatste_blog_url, s.epb_paginas, s.spam_verdacht, s.fout
    FROM concurrenten c
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    ${waar}
    ORDER BY COALESCE(s.epb_paginas,0) DESC, c.verslaggevers DESC, c.domein
  `;
  return (categorie ? db.prepare(sql).all(categorie) : db.prepare(sql).all()) as ConcurrentRij[];
}

export type BureauRij = {
  naam: string; domein: string; verslaggevers: number; provincie: string;
  paginas: number | null; epb_paginas: number | null; blog_artikels: number | null;
  laatste_blog: string | null; laatste_blog_url: string | null;
  bereikbaar: number | null; heeft_sitemap: number | null; spam_verdacht: number | null;
};

const BUREAU_KOLOMMEN = `
  c.naam, c.domein, c.verslaggevers, c.provincie,
  s.paginas, s.epb_paginas, s.blog_artikels, s.laatste_blog, s.laatste_blog_url,
  s.bereikbaar, s.heeft_sitemap, s.spam_verdacht
`;

/**
 * Sterkst online in ONZE markt. Bewust op epb_paginas en niet op het totale
 * aantal pagina's: Arcadis en Sweco hebben duizenden pagina's maar zijn geen
 * EPB-bureau, en mijnEPB heeft maar drie verslaggevers maar staat overal.
 */
export function getSterksteOnline(limiet = 15): BureauRij[] {
  const db = getDb();
  return db.prepare(`
    SELECT ${BUREAU_KOLOMMEN}
    FROM concurrenten c
    JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE c.categorie <> 'eigen'
    ORDER BY COALESCE(s.epb_paginas,0) DESC, COALESCE(s.blog_artikels,0) DESC
    LIMIT ?
  `).all(limiet) as BureauRij[];
}

/** De andere lens: wie heeft de meeste mensen in dienst. */
export function getGrootsteBureaus(limiet = 10): BureauRij[] {
  const db = getDb();
  return db.prepare(`
    SELECT ${BUREAU_KOLOMMEN}
    FROM concurrenten c
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE c.categorie <> 'eigen'
    ORDER BY c.verslaggevers DESC, COALESCE(s.epb_paginas,0) DESC
    LIMIT ?
  `).all(limiet) as BureauRij[];
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
           (SELECT COUNT(*) FROM concurrenten WHERE substr(COALESCE(laatste_check,''),1,10) < date('now','-7 days')) AS ouder_dan_week,
           (SELECT COUNT(*) FROM site_snapshots WHERE datum = (SELECT MAX(datum) FROM site_snapshots)) AS gisteren_gemeten,
           (SELECT COUNT(*) FROM (${LAATSTE_SNAPSHOT}) WHERE fout <> '' AND fout IS NOT NULL) AS met_fout
  `).get() as {
    laatste_crawl: string | null; nooit_gecrawld: number; ouder_dan_week: number;
    gisteren_gemeten: number; met_fout: number;
  };
}

// ---------------------------------------------------------------------------
// Zoekwoorden en posities
// ---------------------------------------------------------------------------

export type ZoekwoordRij = {
  term: string;
  thema: string;
  intentie: string;
  volume: number | null;
  concurrentie: string | null;
  cpc_hoog: number | null;
  onze_positie: number | null;
  beste_concurrent: string | null;
  beste_positie: number | null;
  adverteerders: number;
};

const ONZE_DOMEINEN = ["energie-efficient.be", "unabo.be"];

export function getZoekwoorden(): ZoekwoordRij[] {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM posities").get() as { d: string | null }).d;
  const params = ONZE_DOMEINEN.map(() => "?").join(",");

  return db.prepare(`
    SELECT z.term, z.thema, z.intentie, z.volume, z.concurrentie, z.cpc_hoog,
           (SELECT MIN(p.positie) FROM posities p
             WHERE p.term = z.term AND p.datum = ? AND p.soort = 'organisch'
               AND p.domein IN (${params}))                                   AS onze_positie,
           (SELECT p.domein FROM posities p
             WHERE p.term = z.term AND p.datum = ? AND p.soort = 'organisch'
               AND p.domein NOT IN (${params})
             ORDER BY p.positie LIMIT 1)                                      AS beste_concurrent,
           (SELECT MIN(p.positie) FROM posities p
             WHERE p.term = z.term AND p.datum = ? AND p.soort = 'organisch'
               AND p.domein NOT IN (${params}))                               AS beste_positie,
           (SELECT COUNT(DISTINCT p.domein) FROM posities p
             WHERE p.term = z.term AND p.datum = ? AND p.soort = 'advertentie') AS adverteerders
    FROM zoekwoorden z
    ORDER BY COALESCE(z.volume, -1) DESC, z.thema, z.term
  `).all(laatste, ...ONZE_DOMEINEN, laatste, ...ONZE_DOMEINEN, laatste, ...ONZE_DOMEINEN, laatste) as ZoekwoordRij[];
}

export function getZoekwoordStatus() {
  const db = getDb();
  return db.prepare(`
    SELECT (SELECT COUNT(*) FROM zoekwoorden)                          AS termen,
           (SELECT COUNT(*) FROM zoekwoorden WHERE volume IS NOT NULL) AS met_volume,
           (SELECT MAX(volume_datum) FROM zoekwoorden)                 AS volume_datum,
           (SELECT MAX(datum) FROM posities)                           AS positie_datum,
           (SELECT COUNT(*) FROM posities)                             AS metingen
  `).get() as {
    termen: number; met_volume: number; volume_datum: string | null;
    positie_datum: string | null; metingen: number;
  };
}

/** Wie adverteert er op onze termen. Alleen betrouwbaar zodra een SERP-bron gekoppeld is. */
export function getAdverteerders(limiet = 15) {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM posities").get() as { d: string | null }).d;
  if (!laatste) return [];
  return db.prepare(`
    SELECT p.domein, COUNT(DISTINCT p.term) termen, MIN(p.positie) beste,
           COALESCE(NULLIF(c.naam,''), p.domein) naam
    FROM posities p LEFT JOIN concurrenten c ON c.domein = p.domein
    WHERE p.datum = ? AND p.soort = 'advertentie'
    GROUP BY p.domein ORDER BY termen DESC LIMIT ?
  `).all(laatste, limiet) as { domein: string; termen: number; beste: number; naam: string }[];
}

export type LeaderboardRij = {
  term: string;
  thema: string;
  volume: number | null;
  positie: number;
  domein: string;
  naam: string | null;
  van_ons: number;
};

/**
 * De top 5 per zoekterm, voor de termen met het meeste zoekvolume.
 * Toont wie er werkelijk bovenaan staat — inclusief spelers die niet in het
 * verslaggeversregister voorkomen.
 */
/** Categorieën die geen concurrent zijn: overheid schrijft de wetgeving, portalen verkopen niets. */
export const GEEN_CONCURRENT = ["overheid", "portaal"];

/**
 * De top per zoekterm. `alles = false` laat overheid en portalen weg — je gaat
 * vlaanderen.be niet verslaan en Batibouw is geen concurrent.
 *
 * De positienummers blijven wél de echte Google-posities. Staat vlaanderen.be
 * op 1 en mijnEPB op 2, dan blijft mijnEPB #2. Anders lieg je tegen jezelf over
 * hoe hoog je moet klimmen.
 */
export function getLeaderboard(aantalTermen = 8, diepte = 5, alles = false): LeaderboardRij[] {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM posities").get() as { d: string | null }).d;
  if (!laatste) return [];
  const params = ONZE_DOMEINEN.map(() => "?").join(",");

  return db.prepare(`
    WITH top AS (
      SELECT p.term, p.domein, p.positie,
             ROW_NUMBER() OVER (PARTITION BY p.term ORDER BY p.positie) AS rang
      FROM posities p
      WHERE p.datum = ? AND p.soort = 'organisch'
    ),
    termen AS (
      SELECT z.term, z.thema, z.volume FROM zoekwoorden z
      WHERE z.term IN (SELECT DISTINCT term FROM top)
      ORDER BY COALESCE(z.volume, -1) DESC, z.term
      LIMIT ?
    )
    SELECT t.term, t.thema, t.volume, top.positie, top.domein,
           NULLIF(c.naam,'') AS naam,
           CASE WHEN top.domein IN (${params}) THEN 1 ELSE 0 END AS van_ons
    FROM termen t
    JOIN top ON top.term = t.term AND top.rang <= ?
    LEFT JOIN concurrenten c ON c.domein = top.domein
    ORDER BY COALESCE(t.volume,-1) DESC, t.term, top.positie
  `).all(laatste, aantalTermen, ...ONZE_DOMEINEN, diepte) as LeaderboardRij[];
}

// ---------------------------------------------------------------------------
// Search Console: echte Google-cijfers voor onze eigen sites
// ---------------------------------------------------------------------------

export type GscRij = {
  term: string;
  thema: string | null;
  site: string;
  positie: number;
  vertoningen: number;
  klikken: number;
  url: string;
  in_lijst: number;
};

/**
 * Onze eigen posities volgens Google zelf. Alleen de laatste meting.
 * `in_lijst` zegt of de term ook in onze zoekwoordenlijst staat — termen die
 * Google wél oppikt maar wij niet volgen, zijn juist interessant.
 */
/**
 * Search Console levert per domein soms meerdere properties: een domain-property
 * (`sc-domain:unabo.be`) en losse URL-prefixen (`https://unabo.be/`,
 * `https://www.unabo.be/`). Die overlappen, dus optellen telt dubbel -- UNABO kwam
 * zo op 5.726 vertoningen in plaats van 2.863. Deze CTE kiest per domein een
 * property, bij voorkeur de domain-property omdat die www en non-www samen dekt,
 * en houdt alleen onze eigen domeinen over. Het account bevat namelijk ook
 * contrax.be, h-architects.be en highdesignstudio.in, die hier niets te zoeken hebben.
 */
const GSC_EIGEN = `
  WITH genormaliseerd AS (
    SELECT g.*,
           rtrim(replace(replace(replace(replace(g.site,'sc-domain:',''),'https://',''),'http://',''),'www.',''),'/') AS domein
    FROM gsc_metingen g
  ),
  gekozen AS (
    SELECT domein, site FROM (
      SELECT domein, site,
             ROW_NUMBER() OVER (
               PARTITION BY domein ORDER BY (site LIKE 'sc-domain:%') DESC, site
             ) AS rn
      FROM (SELECT DISTINCT domein, site FROM genormaliseerd)
    ) WHERE rn = 1
  ),
  eigen AS (
    SELECT n.* FROM genormaliseerd n
    JOIN gekozen k ON k.domein = n.domein AND k.site = n.site
    WHERE n.domein IN (${ONZE_DOMEINEN.map((d) => `'${d}'`).join(",")})
  )
`;

export function getOnzeGscPosities(limiet = 50): GscRij[] {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM gsc_metingen").get() as { d: string | null }).d;
  if (!laatste) return [];
  return db.prepare(`
    ${GSC_EIGEN}
    SELECT e.term, z.thema, e.site, e.positie, e.vertoningen, e.klikken, e.url,
           CASE WHEN z.term IS NULL THEN 0 ELSE 1 END AS in_lijst
    FROM eigen e
    LEFT JOIN zoekwoorden z ON lower(z.term) = lower(e.term)
    WHERE e.datum = ?
    ORDER BY e.vertoningen DESC, e.positie
    LIMIT ?
  `).all(laatste, limiet) as GscRij[];
}

/** Voor welke van onze domeinen ontbreekt er een Search Console-property? */
export function gscOntbrekendeSites(): string[] {
  const db = getDb();
  const rijen = db.prepare("SELECT DISTINCT site FROM gsc_metingen").all() as { site: string }[];
  return ONZE_DOMEINEN.filter((d) => !rijen.some((r) => r.site.includes(d)));
}

export function gscStatus() {
  const db = getDb();
  return db.prepare(`
    ${GSC_EIGEN}
    SELECT COUNT(*)               AS metingen,
           MAX(datum)             AS datum,
           COUNT(DISTINCT domein) AS sites,
           SUM(CASE WHEN datum = (SELECT MAX(datum) FROM eigen) THEN vertoningen ELSE 0 END) AS vertoningen,
           SUM(CASE WHEN datum = (SELECT MAX(datum) FROM eigen) THEN klikken     ELSE 0 END) AS klikken
    FROM eigen
  `).get() as {
    metingen: number; datum: string | null; sites: number;
    vertoningen: number | null; klikken: number | null;
  };
}

// ---------------------------------------------------------------------------
// Provincies: onze aanwezigheid tegenover de marktdichtheid
// ---------------------------------------------------------------------------

export type ProvincieRij = {
  provincie: string;
  erkenningen: number;      // erkende verslaggevers in die provincie
  bureaus: number;          // bedrijven met een eigen domein
  onzeDeals: number;        // onze Energy-projecten
  onzeWon: number;
  dekking: number;          // deals per erkenning — laag = veel markt, weinig van ons
};

/**
 * De vraag is niet "waar zitten de concurrenten" maar "waar zitten wij niet".
 * Een provincie met veel erkende verslaggevers en weinig projecten van ons is
 * open terrein; andersom is het een markt waar we al sterk staan.
 *
 * Onze kant komt uit dezelfde deal-afbakening als de rest van de Energy-tab
 * (LEAD_SCOPE), en de provincie uit `parseProjectLocation` — hetzelfde als op
 * de kaart. Anders krijg je twee cijfers die allebei "onze projecten" heten.
 */
export function getProvincieVergelijking(): ProvincieRij[] {
  const db = getDb();

  const markt = db.prepare(`
    SELECT COALESCE(NULLIF(provincie,''),'onbekend') provincie,
           COUNT(*) erkenningen,
           COUNT(DISTINCT NULLIF(domein,'')) bureaus
    FROM verslaggevers GROUP BY 1
  `).all() as { provincie: string; erkenningen: number; bureaus: number }[];

  const deals = db.prepare(
    `SELECT id, title, raw, status FROM deals WHERE ${LEAD_SCOPE}`
  ).all() as { id: number; title: string | null; raw: string | null; status: string }[];

  const onze: Record<string, { deals: number; won: number }> = {};
  for (const d of deals) {
    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(d.raw || "{}"); } catch { /* deal zonder ruwe data */ }
    const pc = (raw[UNABO_ADDR_HASH + "_postal_code"] as string) || null;
    const loc = parseProjectLocation(d.title, pc);
    if (!loc) continue;
    const p = (onze[loc.province] ||= { deals: 0, won: 0 });
    p.deals++;
    if (d.status === "won") p.won++;
  }

  const provincies = new Set([...markt.map((m) => m.provincie), ...Object.keys(onze)]);
  return [...provincies]
    .map((p) => {
      const m = markt.find((x) => x.provincie === p);
      const o = onze[p] || { deals: 0, won: 0 };
      const erkenningen = m?.erkenningen || 0;
      return {
        provincie: p,
        erkenningen,
        bureaus: m?.bureaus || 0,
        onzeDeals: o.deals,
        onzeWon: o.won,
        dekking: erkenningen ? o.deals / erkenningen : 0,
      };
    })
    .filter((r) => r.erkenningen > 0 || r.onzeDeals > 0)
    .sort((a, b) => b.erkenningen - a.erkenningen);
}


export type HerschrijfKans = {
  term: string;
  volume: number | null;
  positie: number;
  domein: string;
  url: string;
  categorie: string;
};

/**
 * Overheidspagina's die hoog scoren op onze zoektermen. Geen concurrenten, maar
 * wél een contentlijst: dat zijn onderwerpen waarvan Google vindt dat ze bij de
 * zoekterm horen, geschreven in ambtelijke taal. Zoals in de meeting gezegd:
 * die teksten kunnen wij beter en duidelijker maken.
 */
export function getHerschrijfKansen(limiet = 20): HerschrijfKans[] {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM posities").get() as { d: string | null }).d;
  if (!laatste) return [];
  return db.prepare(`
    SELECT p.term, z.volume, p.positie, p.domein, p.url, c.categorie
    FROM posities p
    JOIN concurrenten c ON c.domein = p.domein
    LEFT JOIN zoekwoorden z ON z.term = p.term
    WHERE p.datum = ? AND p.soort = 'organisch' AND p.positie <= 5
      AND c.categorie IN (${GEEN_CONCURRENT.map((x) => `'${x}'`).join(",")})
    ORDER BY COALESCE(z.volume,0) DESC, p.positie
    LIMIT ?
  `).all(laatste, limiet) as HerschrijfKans[];
}
