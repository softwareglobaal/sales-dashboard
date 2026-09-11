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
  architecten: number;
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
  eng_paginas: number | null;
  arch_paginas: number | null;
  reg_paginas: number | null;
  omvang: number | null;          // omvang in de opgevraagde markt
  oordeel?: string | null;        // handmatige correctie, als iemand die zette
  oordeel_door?: string | null;
  spam_verdacht: number | null;
  laatste_check: string | null;
  fout: string | null;
};

const LAATSTE_SNAPSHOT = `
  SELECT s.* FROM site_snapshots s
  JOIN (SELECT domein, MAX(datum) d FROM site_snapshots GROUP BY domein) m
    ON m.domein = s.domein AND m.d = s.datum
`;

// ---------------------------------------------------------------------------
// Markten
//
// Dezelfde crawl bedient vier markten. Wat per markt verschilt is (1) welke
// domeinen meetellen, (2) welke kolom de omvang meet, (3) welke van onze
// eigen sites er speelt en (4) welke categorieën géén concurrent zijn. De rest
// van de vragen is identiek, en dat is precies waarom hier geen tweede en derde
// set queries staat.
// ---------------------------------------------------------------------------

export type Markt = "energie" | "engineering" | "architectuur" | "regularisatie";

/** Nooit een marktnaam uit een parameter rechtstreeks in SQL. */
function veiligeMarkt(markt: Markt): string {
  switch (markt) {
    case "engineering": return "engineering";
    case "architectuur": return "architectuur";
    case "regularisatie": return "regularisatie";
    default: return "energie";
  }
}

/** De kolom die de omvang in díé markt meet. */
function omvangKolom(markt: Markt): "epb_paginas" | "eng_paginas" | "arch_paginas" | "reg_paginas" {
  switch (markt) {
    case "engineering": return "eng_paginas";
    case "architectuur": return "arch_paginas";
    case "regularisatie": return "reg_paginas";
    default: return "epb_paginas";
  }
}

/**
 * Regio-filter op de register-gegevens van een domein. Alleen de
 * Architectuur-pagina gebruikt dit: dat register is groot genoeg dat "de markt"
 * pas iets betekent zodra je hem tot een provincie of een gemeente inperkt.
 * Provincie en gemeente komen uit het register, niet uit de crawl.
 */
export type RegioFilter = { provincie?: string; gemeente?: string };

function regioWaar(f: RegioFilter, alias = "c"): { sql: string; params: string[] } {
  const delen: string[] = [];
  const params: string[] = [];
  if (f.provincie) { delen.push(`${alias}.provincie = ?`); params.push(f.provincie); }
  if (f.gemeente) { delen.push(`${alias}.gemeente = ?`); params.push(f.gemeente); }
  return { sql: delen.length ? " AND " + delen.join(" AND ") : "", params };
}

/** Beperkt tot de domeinen die in deze markt meespelen. */
function inMarkt(markt: Markt, alias = "c"): string {
  return `${alias}.domein IN (SELECT domein FROM concurrent_markt WHERE markt = '${veiligeMarkt(markt)}')`;
}

/** Alleen de zoektermen van deze markt. */
function termInMarkt(markt: Markt, alias = "z"): string {
  return `${alias}.markt = '${veiligeMarkt(markt)}'`;
}

/**
 * Categorieën die geen concurrent zijn: overheid schrijft de wetgeving, portalen
 * verkopen niets, een jobsite bedient werkzoekenden, en een Nederlands bureau neemt
 * ons geen dossier in Vlaanderen af. Aannemers, fabrikanten en architecten staan
 * hier om de omgekeerde reden: die kópen stabiliteitswerk. Een architect in deze
 * lijst is geen bedreiging maar een lead voor onderaanneming.
 * `geen-concurrent` is de handmatige variant: iemand heeft er zelf naar gekeken.
 */
export const GEEN_CONCURRENT = [
  "overheid", "portaal", "vacature", "buitenland", "aannemer", "fabrikant", "architect",
  "geen-concurrent",
];

/**
 * In de Architectuur-markt draait die redenering om: dáár is de architect niet
 * de klant maar dé concurrent, want hij vecht om dezelfde bouwheer. Alleen wat
 * geen ontwerpopdracht verkoopt blijft er buiten: overheid, portalen,
 * jobsites, buitenlandse bureaus en fabrikanten. Aannemers blijven er wél in
 * staan -- een sleutel-op-de-deurbouwer neemt een particuliere bouwheer net zo
 * goed weg als een collega-architect.
 */
const GEEN_CONCURRENT_ARCHITECTUUR = [
  "overheid", "portaal", "vacature", "buitenland", "fabrikant", "geen-concurrent",
];

/**
 * Regularisatie zit daar tussenin. De architect is hier concurrent (hij dient
 * hetzelfde regularisatiedossier in), maar een aannemer níét: die bouwt, hij
 * regulariseert niet. Een advocaat omgevingsrecht valt onder "onbekend" en telt
 * dus mee -- terecht, want hij vecht op dezelfde zoekvragen om dezelfde eigenaar.
 */
const GEEN_CONCURRENT_REGULARISATIE = [
  "overheid", "portaal", "vacature", "buitenland", "fabrikant", "aannemer", "geen-concurrent",
];

export function geenConcurrentVoor(markt: Markt): string[] {
  if (markt === "architectuur") return GEEN_CONCURRENT_ARCHITECTUUR;
  if (markt === "regularisatie") return GEEN_CONCURRENT_REGULARISATIE;
  return GEEN_CONCURRENT;
}

/**
 * Het menselijk oordeel gaat voor op de automatische indeling.
 *
 * De regex kan een bureau niet van een fabrikant onderscheiden en weet niet dat
 * arcadegroep.be ingenieurs detacheert. Wie de markt kent zet dat recht met de
 * knopjes in de tabel; dat oordeel staat in `beoordelingen` en overleeft elke
 * herclassificatie. Zonder oordeel blijft de automatische categorie staan.
 */
const OORDEEL_JOIN = "LEFT JOIN beoordelingen b ON b.soort = 'domein' AND b.sleutel = c.domein";

function categorieExpr(alias = "c"): string {
  return `CASE
    WHEN b.oordeel = 'geen-prospect' THEN 'geen-concurrent'
    WHEN b.oordeel IS NOT NULL AND b.oordeel <> '' THEN b.oordeel
    ELSE COALESCE(${alias}.categorie,'onbekend') END`;
}

/**
 * Overheid, portalen, jobsites en buitenlandse bureaus bezetten posities maar zijn
 * geen bedrijven waar we klanten aan verliezen. Ze horen in het overzicht van
 * zoekresultaten, niet in een ranglijst van concurrenten.
 */
function echteConcurrent(markt: Markt, alias = "c"): string {
  const lijst = geenConcurrentVoor(markt).map((x) => `'${x}'`).join(",");
  return `(${categorieExpr(alias)}) NOT IN (${lijst})`;
}

/**
 * Onze eigen sites per markt. unabo.be draagt beide afdelingen; het is dus geen
 * fout dat dat domein twee keer voorkomt.
 */
const ONZE_SITES: Record<Markt, string[]> = {
  energie: ["energie-efficient.be", "unabo.be"],
  engineering: ["unabo.be"],
  // h-architects.globaal.be is de proefomgeving. Die meten we mee, maar hij mag
  // nooit als "onze positie" in Google gelden -- daar staat hij niet in.
  architectuur: ["h-architects.be", "h-architects.globaal.be"],
  // Drie eigen sites in één markt: de specialist, de zelfcheck en het
  // moederbureau. Alle drie tellen als "wij" in het leaderboard -- de vraag is
  // niet welke van de drie wint, maar of de groep de eigenaar bereikt.
  regularisatie: ["regulariseren.be", "mijnregularisatie.be", "h-architects.be"],
};

export function concurrentieHeeftData(markt: Markt = "energie"): boolean {
  const db = getDb();
  if (markt === "energie") {
    return (db.prepare("SELECT COUNT(*) n FROM verslaggevers").get() as { n: number }).n > 0;
  }
  if (markt === "architectuur") {
    return (db.prepare("SELECT COUNT(*) n FROM architecten").get() as { n: number }).n > 0;
  }
  // Engineering en Regularisatie kennen geen register: de marktlijst zelf is de bron.
  return (db.prepare(
    `SELECT COUNT(*) n FROM concurrent_markt WHERE markt = '${veiligeMarkt(markt)}'`
  ).get() as { n: number }).n > 0;
}

/**
 * Het register achter een markt. Energie steunt op het VEKA-register,
 * architectuur op het ledenregister van de Orde; engineering heeft er geen en
 * krijgt daarom nullen in plaats van cijfers uit een vreemde tabel.
 */
const REGISTERTABEL: Partial<Record<Markt, string>> = {
  energie: "verslaggevers",
  architectuur: "architecten",
};

export function getMarktKpis(markt: Markt = "energie", regio: RegioFilter = {}) {
  const db = getDb();
  const tabel = REGISTERTABEL[markt];
  const r = regioWaar(regio);
  // Het register-deel van de KPI's volgt hetzelfde regiofilter als de rest van
  // de pagina: anders staat er "3.100 inschrijvingen" boven een lijst van Leuven.
  const regReg = regioWaar(regio, "r");
  const registerSql = tabel
    ? `(SELECT COUNT(*) FROM ${tabel} r WHERE 1=1 ${regReg.sql})                AS erkenningen,
       (SELECT COUNT(DISTINCT r.naam) FROM ${tabel} r WHERE 1=1 ${regReg.sql})  AS personen,
       (SELECT COUNT(*) FROM ${tabel} r WHERE r.domein='' ${regReg.sql})        AS zonder_domein,`
    : "0 AS erkenningen, 0 AS personen, 0 AS zonder_domein,";

  const k = db.prepare(`
    SELECT
      ${registerSql}
      (SELECT COUNT(*) FROM concurrenten c ${OORDEEL_JOIN}
        WHERE c.categorie<>'eigen' AND ${inMarkt(markt)} AND ${echteConcurrent(markt)} ${r.sql})       AS bedrijven,
      (SELECT COUNT(*) FROM concurrenten c ${OORDEEL_JOIN}
        WHERE c.categorie<>'eigen' AND ${inMarkt(markt)} AND NOT (${echteConcurrent(markt)}) ${r.sql}) AS geen_concurrent,
      (SELECT COUNT(*) FROM concurrenten c WHERE categorie='concurrent' AND ${inMarkt(markt)} ${r.sql}) AS concurrenten,
      (SELECT COUNT(*) FROM concurrenten c WHERE categorie='prospect' AND ${inMarkt(markt)} ${r.sql})   AS prospects
  `).get(
    // Drie subquery's over het register (alleen als er een register is), daarna
    // vier over de gevolgde domeinen. De volgorde moet die van de SQL volgen.
    ...(tabel ? [...regReg.params, ...regReg.params, ...regReg.params] : []),
    ...r.params, ...r.params, ...r.params, ...r.params
  ) as Record<string, number>;

  const web = db.prepare(`
    SELECT
      COUNT(*)                                              AS gemeten,
      SUM(CASE WHEN s.bereikbaar=1 THEN 1 ELSE 0 END)       AS online,
      SUM(CASE WHEN s.blog_artikels > 0 THEN 1 ELSE 0 END)  AS met_blog,
      SUM(CASE WHEN s.laatste_blog >= date('now','-90 days') THEN 1 ELSE 0 END) AS actief_bloggend,
      SUM(CASE WHEN s.spam_verdacht > 0 THEN 1 ELSE 0 END)  AS gehackt,
      AVG(NULLIF(s.paginas,0))                              AS gem_paginas,
      AVG(NULLIF(s.${omvangKolom(markt)},0))                AS gem_omvang
    FROM (${LAATSTE_SNAPSHOT}) s
    JOIN concurrenten c ON c.domein = s.domein
    WHERE ${inMarkt(markt, "s")} ${r.sql}
  `).get(...r.params) as Record<string, number>;

  return { ...k, ...web };
}

export function getConcurrenten(categorie?: string, markt: Markt = "energie"): ConcurrentRij[] {
  const db = getDb();
  const omvang = omvangKolom(markt);
  const waar = categorie ? "WHERE c.categorie = ?" : "";
  const sql = `
    SELECT c.domein, c.naam, c.categorie, c.verslaggevers, c.architecten,
           c.provincie, c.gemeente, c.laatste_check,
           s.bereikbaar, s.paginas, s.blog_paginas, s.laatste_blog, s.blog_per_maand,
           s.diensten, s.cms, s.titel, s.ttfb_ms, s.heeft_localbiz, s.heeft_sitemap,
           s.blog_artikels, s.laatste_blog_url, s.epb_paginas, s.eng_paginas, s.arch_paginas, s.reg_paginas,
           s.${omvang} AS omvang, s.spam_verdacht, s.fout
    FROM concurrenten c
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    ${waar}
    ORDER BY COALESCE(s.${omvang},0) DESC, c.verslaggevers DESC, c.domein
  `;
  return (categorie ? db.prepare(sql).all(categorie) : db.prepare(sql).all()) as ConcurrentRij[];
}

/**
 * De bedrijven die in deze markt meespelen. `soort` bepaalt welke kant:
 *   "concurrent" -- wie ons werk kan afnemen (standaard)
 *   "rest"       -- overheid, portalen, jobsites en buitenland: geen concurrenten,
 *                   maar ze bezetten wel posities en horen nagekeken te worden
 *   "eigen"      -- onze eigen sites
 */
export function getConcurrentenInMarkt(
  markt: Markt,
  soort: "concurrent" | "rest" | "eigen" = "concurrent",
  regio: RegioFilter = {}
): ConcurrentRij[] {
  const db = getDb();
  const omvang = omvangKolom(markt);
  // Onze eigen sites blijven altijd zichtbaar: die horen niet in een provincie
  // thuis, en ze wegfilteren zou de vergelijking wegnemen waar de pagina om draait.
  const r = soort === "eigen" ? { sql: "", params: [] as string[] } : regioWaar(regio);
  const filter =
    soort === "eigen"
      ? "AND c.categorie = 'eigen'"
      : soort === "rest"
        ? `AND c.categorie <> 'eigen' AND NOT (${echteConcurrent(markt)})`
        : `AND c.categorie <> 'eigen' AND ${echteConcurrent(markt)}`;
  return db.prepare(`
    SELECT c.domein, c.naam, ${categorieExpr()} AS categorie, c.verslaggevers, c.architecten,
           c.provincie, c.gemeente, c.laatste_check,
           b.oordeel, b.door AS oordeel_door,
           s.bereikbaar, s.paginas, s.blog_paginas, s.laatste_blog, s.blog_per_maand,
           s.diensten, s.cms, s.titel, s.ttfb_ms, s.heeft_localbiz, s.heeft_sitemap,
           s.blog_artikels, s.laatste_blog_url, s.epb_paginas, s.eng_paginas, s.arch_paginas, s.reg_paginas,
           s.${omvang} AS omvang, s.spam_verdacht, s.fout
    FROM concurrenten c
    ${OORDEEL_JOIN}
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE ${inMarkt(markt)} ${filter} ${r.sql}
    ORDER BY COALESCE(s.${omvang},0) DESC, COALESCE(s.blog_artikels,0) DESC, c.domein
  `).all(...r.params) as ConcurrentRij[];
}

export type BureauRij = {
  naam: string; domein: string; verslaggevers: number; architecten: number;
  provincie: string; gemeente: string;
  paginas: number | null; epb_paginas: number | null; omvang: number | null; blog_artikels: number | null;
  laatste_blog: string | null; laatste_blog_url: string | null;
  bereikbaar: number | null; heeft_sitemap: number | null; spam_verdacht: number | null;
};

const bureauKolommen = (markt: Markt) => `
  c.naam, c.domein, c.verslaggevers, c.architecten, c.provincie, c.gemeente,
  s.paginas, s.epb_paginas, s.${omvangKolom(markt)} AS omvang,
  s.blog_artikels, s.laatste_blog, s.laatste_blog_url,
  s.bereikbaar, s.heeft_sitemap, s.spam_verdacht
`;

/**
 * Sterkst online in ONZE markt. Bewust op epb_paginas en niet op het totale
 * aantal pagina's: Arcadis en Sweco hebben duizenden pagina's maar zijn geen
 * EPB-bureau, en mijnEPB heeft maar drie verslaggevers maar staat overal.
 */
export function getSterksteOnline(limiet = 15, markt: Markt = "energie", regio: RegioFilter = {}): BureauRij[] {
  const db = getDb();
  const r = regioWaar(regio);
  return db.prepare(`
    SELECT ${bureauKolommen(markt)}
    FROM concurrenten c
    ${OORDEEL_JOIN}
    JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE c.categorie <> 'eigen' AND ${inMarkt(markt)} AND ${echteConcurrent(markt)} ${r.sql}
    ORDER BY COALESCE(s.${omvangKolom(markt)},0) DESC, COALESCE(s.blog_artikels,0) DESC
    LIMIT ?
  `).all(...r.params, limiet) as BureauRij[];
}

/** De andere lens: wie heeft de meeste mensen in dienst. */
export function getGrootsteBureaus(limiet = 10): BureauRij[] {
  const db = getDb();
  return db.prepare(`
    SELECT ${bureauKolommen("energie")}
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
export function getDienstenDekking(markt: Markt = "energie", regio: RegioFilter = {}) {
  const db = getDb();
  const r = regioWaar(regio);
  const rijen = db.prepare(
    `SELECT s.diensten FROM (${LAATSTE_SNAPSHOT}) s
      JOIN concurrenten c ON c.domein = s.domein
      WHERE s.diensten IS NOT NULL AND ${inMarkt(markt, "s")} ${r.sql}`
  ).all(...r.params) as { diensten: string }[];
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

export function getSignalen(limiet = 50, markt?: Markt) {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.domein, s.datum, s.soort, s.omschrijving, s.url, s.gezien,
           COALESCE(NULLIF(c.naam,''), s.domein) naam
    FROM signalen s LEFT JOIN concurrenten c ON c.domein = s.domein
    ${markt ? `WHERE ${inMarkt(markt, "s")}` : ""}
    ORDER BY s.datum DESC, s.id DESC LIMIT ?
  `).all(limiet) as {
    id: number; domein: string; datum: string; soort: string;
    omschrijving: string; url: string; gezien: number; naam: string;
  }[];
}

/** Erkend, maar nauwelijks online: geen concurrent maar een kandidaat voor onderaanneming. */
/**
 * Erkend maar nauwelijks online: kandidaten voor onderaanneming.
 *
 * De automatische selectie zit er soms naast — iemand zonder eigen website kan
 * de zaakvoerder van een groot bureau zijn. Daarom draagt elke rij een
 * beoordeling die iemand met marktkennis kan zetten; wie op "geen" staat
 * verdwijnt uit de lijst.
 */
export function getOnderaannemingProspects(limiet = 40, toonAfgekeurd = false) {
  const db = getDb();
  return db.prepare(`
    SELECT v.ep_code, v.naam, v.bedrijf, v.gemeente, v.provincie, v.domein,
           s.paginas, s.bereikbaar, b.oordeel, b.door
    FROM verslaggevers v
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = v.domein
    LEFT JOIN beoordelingen b ON b.soort = 'verslaggever' AND b.sleutel = v.ep_code
    WHERE (v.domein = '' OR s.bereikbaar = 0 OR COALESCE(s.paginas,0) <= 5)
      ${toonAfgekeurd ? "" : "AND COALESCE(b.oordeel,'') <> 'geen-prospect'"}
    ORDER BY CASE b.oordeel WHEN 'prospect' THEN 0 ELSE 1 END,
             v.provincie, v.gemeente, v.naam
    LIMIT ?
  `).all(limiet) as {
    ep_code: string; naam: string; bedrijf: string; gemeente: string; provincie: string;
    domein: string; paginas: number | null; bereikbaar: number | null;
    oordeel: string | null; door: string | null;
  }[];
}

export function telAfgekeurdeProspects(): number {
  const db = getDb();
  return (db.prepare(
    "SELECT COUNT(*) n FROM beoordelingen WHERE soort='verslaggever' AND oordeel='geen-prospect'"
  ).get() as { n: number }).n;
}

/**
 * Waar komt deze marktlijst vandaan? De energiemarkt begint bij het VEKA-register;
 * de Engineering-markt heeft dat niet en wordt opgebouwd uit de zoekresultaten en
 * uit wat de crawl op de sites zelf vindt. Dat verschil hoort zichtbaar te zijn,
 * anders lijken beide lijsten even hard.
 */
export function getMarktBronnen(markt: Markt) {
  const db = getDb();
  return db.prepare(
    `SELECT bron, COUNT(*) n FROM concurrent_markt
      WHERE markt = '${veiligeMarkt(markt)}' GROUP BY bron ORDER BY n DESC`
  ).all() as { bron: string; n: number }[];
}

/**
 * De bureaus die het meest over deze markt publiceren. Omvang zegt hoe groot
 * iemand is, dit zegt of hij nog beweegt -- en dat is wat een inhaalslag duur maakt.
 */
export function getActiefstePubliceerders(limiet = 10, markt: Markt = "energie", regio: RegioFilter = {}): BureauRij[] {
  const db = getDb();
  const r = regioWaar(regio);
  return db.prepare(`
    SELECT ${bureauKolommen(markt)}
    FROM concurrenten c
    ${OORDEEL_JOIN}
    JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = c.domein
    WHERE c.categorie <> 'eigen' AND ${inMarkt(markt)} AND ${echteConcurrent(markt)} ${r.sql}
      AND COALESCE(s.spam_verdacht,0) < 3
      AND s.laatste_blog >= date('now','-365 days')
    ORDER BY COALESCE(s.blog_per_maand,0) DESC, COALESCE(s.blog_artikels,0) DESC
    LIMIT ?
  `).all(...r.params, limiet) as BureauRij[];
}

export function getCrawlStatus(markt?: Markt) {
  const db = getDb();
  const beperk = markt ? `AND ${inMarkt(markt)}` : "";
  return db.prepare(`
    SELECT (SELECT MAX(datum) FROM site_snapshots)                        AS laatste_crawl,
           (SELECT COUNT(*) FROM concurrenten c WHERE laatste_check IS NULL ${beperk}) AS nooit_gecrawld,
           (SELECT COUNT(*) FROM concurrenten c WHERE substr(COALESCE(laatste_check,''),1,10) < date('now','-7 days') ${beperk}) AS ouder_dan_week,
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

const ONZE_DOMEINEN = ONZE_SITES.energie;

/** Laatste positiemeting binnen één markt -- markten worden op eigen dagen gemeten. */
function laatstePositieDatum(markt?: Markt): string | null {
  const db = getDb();
  const sql = markt
    ? `SELECT MAX(p.datum) d FROM posities p JOIN zoekwoorden z ON z.term = p.term WHERE ${termInMarkt(markt)}`
    : "SELECT MAX(datum) d FROM posities";
  return (db.prepare(sql).get() as { d: string | null }).d;
}

export function getZoekwoorden(markt: Markt = "energie"): ZoekwoordRij[] {
  const db = getDb();
  const laatste = laatstePositieDatum(markt);
  const onze = ONZE_SITES[markt];
  const params = onze.map(() => "?").join(",");

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
    WHERE ${termInMarkt(markt)}
    ORDER BY COALESCE(z.volume, -1) DESC, z.thema, z.term
  `).all(laatste, ...onze, laatste, ...onze, laatste, ...onze, laatste) as ZoekwoordRij[];
}

export function getZoekwoordStatus(markt: Markt = "energie") {
  const db = getDb();
  const inLijst = `p.term IN (SELECT z.term FROM zoekwoorden z WHERE ${termInMarkt(markt)})`;
  return db.prepare(`
    SELECT (SELECT COUNT(*) FROM zoekwoorden z WHERE ${termInMarkt(markt)})                          AS termen,
           (SELECT COUNT(*) FROM zoekwoorden z WHERE volume IS NOT NULL AND ${termInMarkt(markt)})   AS met_volume,
           (SELECT MAX(volume_datum) FROM zoekwoorden z WHERE ${termInMarkt(markt)})                 AS volume_datum,
           (SELECT MAX(p.datum) FROM posities p WHERE ${inLijst})                                    AS positie_datum,
           (SELECT COUNT(*) FROM posities p WHERE ${inLijst})                                        AS metingen
  `).get() as {
    termen: number; met_volume: number; volume_datum: string | null;
    positie_datum: string | null; metingen: number;
  };
}

/** Wie adverteert er op onze termen. Alleen betrouwbaar zodra een SERP-bron gekoppeld is. */
export function getAdverteerders(limiet = 15, markt: Markt = "energie") {
  const db = getDb();
  const laatste = laatstePositieDatum(markt);
  if (!laatste) return [];
  return db.prepare(`
    SELECT p.domein, COUNT(DISTINCT p.term) termen, MIN(p.positie) beste,
           COALESCE(NULLIF(c.naam,''), p.domein) naam
    FROM posities p
    LEFT JOIN concurrenten c ON c.domein = p.domein
    JOIN zoekwoorden z ON z.term = p.term
    WHERE p.datum = ? AND p.soort = 'advertentie' AND ${termInMarkt(markt)}
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

/**
 * De top per zoekterm. `alles = false` laat overheid en portalen weg — je gaat
 * vlaanderen.be niet verslaan en Batibouw is geen concurrent.
 *
 * De positienummers blijven wél de echte Google-posities. Staat vlaanderen.be
 * op 1 en mijnEPB op 2, dan blijft mijnEPB #2. Anders lieg je tegen jezelf over
 * hoe hoog je moet klimmen.
 */
export function getLeaderboard(aantalTermen = 8, diepte = 5, alles = false, markt: Markt = "energie"): LeaderboardRij[] {
  const db = getDb();
  const laatste = laatstePositieDatum(markt);
  if (!laatste) return [];
  const onze = ONZE_SITES[markt];
  const params = onze.map(() => "?").join(",");

  // Het filter hoort vóór de rangschikking: anders levert "top 5" er drie op
  // zodra er twee portalen tussen staan. De getoonde positie blijft de echte
  // Google-positie, dus het gat naar plek 1 blijft eerlijk zichtbaar.
  const geenConcurrent = alles ? "" : `AND ${echteConcurrent(markt)}`;

  return db.prepare(`
    WITH gefilterd AS (
      SELECT p.term, p.domein, p.positie
      FROM posities p
      LEFT JOIN concurrenten c ON c.domein = p.domein
      ${OORDEEL_JOIN}
      WHERE p.datum = ? AND p.soort = 'organisch' ${geenConcurrent}
    ),
    top AS (
      SELECT term, domein, positie,
             ROW_NUMBER() OVER (PARTITION BY term ORDER BY positie) AS rang
      FROM gefilterd
    ),
    termen AS (
      SELECT z.term, z.thema, z.volume FROM zoekwoorden z
      WHERE z.term IN (SELECT DISTINCT term FROM top) AND ${termInMarkt(markt)}
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
  `).all(laatste, aantalTermen, ...onze, diepte) as LeaderboardRij[];
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
const gscEigen = (markt: Markt = "energie") => `
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
    WHERE n.domein IN (${ONZE_SITES[markt].map((d) => `'${d}'`).join(",")})
  )
`;

/**
 * Search Console kent onze markten niet: unabo.be levert EPB-termen én
 * stabiliteitstermen door elkaar. Op de Engineering-pagina horen alleen die
 * laatste thuis, anders vult de lijst zich met EPB-termen die daar niets
 * verklaren. Een term telt mee als hij in de engineering-zoekwoordenlijst
 * staat, of als het woord zelf de markt al aanwijst.
 */
const ENG_TERMWOORDEN = [
  "stabilit", "beton", "staal", "stalen", "draag", "dragende", "muurdoorbraak",
  "ingenieur", "funder", "scheur", "ligger", "structur", "meetstaat",
];

/**
 * Hetzelfde voor regularisatie: h-architects.be staat in Search Console en levert
 * ontwerp- én regularisatietermen. Op de Regularisatie-pagina horen alleen die
 * laatste. regulariseren.be en mijnregularisatie.be zijn per definitie
 * regularisatie, maar het filter kwaad kan daar niet.
 */
const REG_TERMWOORDEN = [
  "regularis", "bouwovertreding", "bouwmisdrijf", "onvergund", "zonder vergunning",
  "maatregelenregister", "vermoeden van vergunning", "herstelvordering", "dwangsom",
];

function termFilter(markt: Markt, kolom = "e.term"): string {
  const lijst = markt === "engineering" ? ENG_TERMWOORDEN : markt === "regularisatie" ? REG_TERMWOORDEN : null;
  if (!lijst) return "1=1";
  const woorden = lijst.map((w) => `lower(${kolom}) LIKE '%${w}%'`).join(" OR ");
  return `(${woorden} OR ${kolom} IN (SELECT term FROM zoekwoorden WHERE markt = '${veiligeMarkt(markt)}'))`;
}

export function getOnzeGscPosities(limiet = 50, markt: Markt = "energie"): GscRij[] {
  const db = getDb();
  const laatste = (db.prepare("SELECT MAX(datum) d FROM gsc_metingen").get() as { d: string | null }).d;
  if (!laatste) return [];
  return db.prepare(`
    ${gscEigen(markt)}
    SELECT e.term, z.thema, e.site, e.positie, e.vertoningen, e.klikken, e.url,
           CASE WHEN z.term IS NULL THEN 0 ELSE 1 END AS in_lijst
    FROM eigen e
    LEFT JOIN zoekwoorden z ON lower(z.term) = lower(e.term)
    WHERE e.datum = ? AND ${termFilter(markt)}
    ORDER BY e.vertoningen DESC, e.positie
    LIMIT ?
  `).all(laatste, limiet) as GscRij[];
}

/** Voor welke van onze domeinen ontbreekt er een Search Console-property? */
export function gscOntbrekendeSites(markt: Markt = "energie"): string[] {
  const db = getDb();
  const rijen = db.prepare("SELECT DISTINCT site FROM gsc_metingen").all() as { site: string }[];
  return ONZE_SITES[markt].filter((d) => !rijen.some((r) => r.site.includes(d)));
}

export function gscStatus(markt: Markt = "energie") {
  const db = getDb();
  return db.prepare(`
    ${gscEigen(markt)}
    SELECT COUNT(*)               AS metingen,
           MAX(datum)             AS datum,
           COUNT(DISTINCT domein) AS sites,
           SUM(CASE WHEN datum = (SELECT MAX(datum) FROM eigen) THEN vertoningen ELSE 0 END) AS vertoningen,
           SUM(CASE WHEN datum = (SELECT MAX(datum) FROM eigen) THEN klikken     ELSE 0 END) AS klikken
    FROM eigen e
    WHERE ${termFilter(markt)}
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
export function getHerschrijfKansen(limiet = 20, markt: Markt = "energie"): HerschrijfKans[] {
  const db = getDb();
  const laatste = laatstePositieDatum(markt);
  if (!laatste) return [];
  return db.prepare(`
    SELECT p.term, z.volume, p.positie, p.domein, p.url, ${categorieExpr()} AS categorie
    FROM posities p
    JOIN concurrenten c ON c.domein = p.domein
    ${OORDEEL_JOIN}
    JOIN zoekwoorden z ON z.term = p.term
    WHERE p.datum = ? AND p.soort = 'organisch' AND p.positie <= 5
      AND ${termInMarkt(markt)}
      AND (${categorieExpr()}) IN (${geenConcurrentVoor(markt).map((x) => `'${x}'`).join(",")})
    ORDER BY COALESCE(z.volume,0) DESC, p.positie
    LIMIT ?
  `).all(laatste, limiet) as HerschrijfKans[];
}

// ---------------------------------------------------------------------------
// Het volledige register
// ---------------------------------------------------------------------------

export type RegisterRij = {
  ep_code: string;
  naam: string;
  bedrijf: string;
  gemeente: string;
  provincie: string;
  domein: string;
  email: string;
  telefoon: string;
  collegas: number;      // aantal erkenningen op hetzelfde domein
  paginas: number | null;
  epb_paginas: number | null;
  beoordeling: string | null;
};

export type RegisterFilter = {
  zoek?: string;
  provincie?: string;
  soort?: string;        // alles / bureau / eenmanszaak / zonder-website
};

/**
 * Alle erkenningen, doorzoekbaar. Dit is de bron waar de rest op steunt:
 * wie is erkend, bij welk bureau, en hoe zichtbaar is dat bureau online.
 *
 * Let op het onderscheid: 792 erkenningen voor 613 personen. Wie een oude en
 * een nieuwe EP-code heeft staat twee keer in het register.
 */
export function getRegister(f: RegisterFilter = {}, limiet = 300): RegisterRij[] {
  const db = getDb();
  const waar: string[] = [];
  const args: unknown[] = [];

  if (f.zoek?.trim()) {
    waar.push("(lower(v.naam) LIKE ? OR lower(v.bedrijf) LIKE ? OR lower(v.gemeente) LIKE ? OR lower(v.domein) LIKE ? OR lower(v.ep_code) LIKE ?)");
    const q = `%${f.zoek.trim().toLowerCase()}%`;
    args.push(q, q, q, q, q);
  }
  if (f.provincie && f.provincie !== "alles") {
    waar.push("COALESCE(NULLIF(v.provincie,''),'onbekend') = ?");
    args.push(f.provincie);
  }
  if (f.soort === "zonder-website") waar.push("v.domein = ''");
  if (f.soort === "bureau") waar.push("v.domein <> '' AND c.verslaggevers >= 2");
  if (f.soort === "eenmanszaak") waar.push("(v.domein = '' OR c.verslaggevers <= 1)");

  const sql = `
    SELECT v.ep_code, v.naam, v.bedrijf, v.gemeente, v.provincie, v.domein, v.email, v.telefoon,
           COALESCE(c.verslaggevers, 1) AS collegas,
           s.paginas, s.epb_paginas, c.notitie AS beoordeling
    FROM verslaggevers v
    LEFT JOIN concurrenten c ON c.domein = v.domein AND v.domein <> ''
    LEFT JOIN (${LAATSTE_SNAPSHOT}) s ON s.domein = v.domein
    ${waar.length ? "WHERE " + waar.join(" AND ") : ""}
    ORDER BY COALESCE(c.verslaggevers,1) DESC, v.bedrijf, v.naam
    LIMIT ?
  `;
  return db.prepare(sql).all(...args, limiet) as RegisterRij[];
}

export function getRegisterTotalen(f: RegisterFilter = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT COUNT(*) erkenningen,
           COUNT(DISTINCT naam) personen,
           COUNT(DISTINCT NULLIF(domein,'')) domeinen,
           SUM(CASE WHEN domein = '' THEN 1 ELSE 0 END) zonder_website
    FROM verslaggevers
  `).get() as { erkenningen: number; personen: number; domeinen: number; zonder_website: number };
}

export function getProvincieKeuzes(): string[] {
  const db = getDb();
  return (db.prepare(`
    SELECT DISTINCT COALESCE(NULLIF(provincie,''),'onbekend') p
    FROM verslaggevers ORDER BY p
  `).all() as { p: string }[]).map((r) => r.p);
}

// ---------------------------------------------------------------------------
// Het architectenregister (Orde van Architecten, Vlaamse Raad)
// ---------------------------------------------------------------------------

/**
 * De keuzelijsten voor het regiofilter, en meteen de reden waarom dat filter er
 * is: dit register telt duizenden inschrijvingen over heel Vlaanderen, terwijl
 * een bouwheer zijn architect in zijn eigen streek zoekt. Een ranglijst zonder
 * regio meet dus iets wat niemand koopt.
 *
 * De gemeentelijst hangt aan de gekozen provincie. Zonder die beperking staan er
 * driehonderd gemeenten in één keuzelijst.
 */
export function getArchitectRegios(provincie?: string) {
  const db = getDb();
  const provincies = (db.prepare(
    `SELECT provincie p, COUNT(*) n FROM architecten
      WHERE provincie <> '' GROUP BY provincie ORDER BY n DESC`
  ).all() as { p: string; n: number }[]);

  const gemeenten = provincie
    ? (db.prepare(
        `SELECT gemeente g, COUNT(*) n FROM architecten
          WHERE gemeente <> '' AND provincie = ?
          GROUP BY gemeente ORDER BY n DESC, gemeente`
      ).all(provincie) as { g: string; n: number }[])
    : [];

  return { provincies, gemeenten };
}

/**
 * Hoe de markt over de provincies verdeeld ligt. Twee kolommen die niet
 * hetzelfde zeggen: het aantal inschrijvingen (hoeveel architecten er zijn) en
 * het aantal domeinen (hoeveel bureaus er online zichtbaar zijn). Waar die twee
 * ver uit elkaar liggen, staat een provincie vol architecten die niet op internet
 * te vinden zijn -- dat is open terrein, geen drukke markt.
 */
export function getArchitectenPerProvincie() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(NULLIF(provincie,''),'onbekend') provincie,
           COUNT(*)                                  inschrijvingen,
           SUM(CASE WHEN soort='vennootschap' THEN 1 ELSE 0 END) vennootschappen,
           COUNT(DISTINCT NULLIF(domein,''))         domeinen,
           SUM(CASE WHEN website <> '' THEN 1 ELSE 0 END) met_website
    FROM architecten GROUP BY 1 ORDER BY inschrijvingen DESC
  `).all() as {
    provincie: string; inschrijvingen: number; vennootschappen: number;
    domeinen: number; met_website: number;
  }[];
}

/**
 * De gemeenten waar de meeste architecten zitten binnen het gekozen gebied.
 * Dit is de lens waar H-Architects om vroeg: Leuven en Antwerpen zijn het
 * zwaartepunt, en dan wil je weten hoe druk het daar precies is.
 */
export function getArchitectenPerGemeente(provincie?: string, limiet = 25) {
  const db = getDb();
  const waar = provincie ? "WHERE provincie = ? AND gemeente <> ''" : "WHERE gemeente <> ''";
  const params: (string | number)[] = provincie ? [provincie, limiet] : [limiet];
  const rijen = db.prepare(`
    SELECT gemeente, postcode,
           COUNT(*) inschrijvingen,
           COUNT(DISTINCT NULLIF(domein,'')) domeinen
    FROM architecten ${waar}
    GROUP BY gemeente
    ORDER BY domeinen DESC, inschrijvingen DESC, gemeente
    LIMIT ?
  `).all(...params) as {
    gemeente: string; postcode: string; inschrijvingen: number; domeinen: number;
  }[];

  // De Orde publiceert het adres van een vennootschap meestal wel en dat van een
  // natuurlijke persoon meestal niet: 8.923 personen, waarvan 294 met adres. Deze
  // tabel telt dus alleen wie een adres publiceerde, en dat cijfer hoort erbij --
  // anders lijkt een gemeente leeg terwijl er alleen niets van bekend is.
  const zonderAdres = (db.prepare(
    `SELECT COUNT(*) n FROM architecten
      WHERE gemeente = '' ${provincie ? "AND provincie = ?" : ""}`
  ).get(...(provincie ? [provincie] : [])) as { n: number }).n;

  return { rijen, zonderAdres };
}

/**
 * Wat het register over zichzelf zegt: hoeveel inschrijvingen, hoeveel daarvan
 * een eigen website opgaven, en wanneer het opgehaald is. Zonder dat laatste
 * cijfer lijkt een lijst van vandaag even hard als een lijst van vorig jaar.
 */
export function getArchitectRegisterStatus() {
  const db = getDb();
  return db.prepare(`
    SELECT COUNT(*)                                            AS inschrijvingen,
           SUM(CASE WHEN soort='vennootschap' THEN 1 ELSE 0 END) AS vennootschappen,
           SUM(CASE WHEN soort='persoon' THEN 1 ELSE 0 END)      AS personen,
           SUM(CASE WHEN website <> '' THEN 1 ELSE 0 END)        AS met_website,
           SUM(CASE WHEN domein = '' THEN 1 ELSE 0 END)          AS zonder_domein,
           COUNT(DISTINCT NULLIF(domein,''))                     AS domeinen,
           MAX(bron_datum)                                       AS bron_datum
    FROM architecten
  `).get() as {
    inschrijvingen: number; vennootschappen: number; personen: number;
    met_website: number; zonder_domein: number; domeinen: number; bron_datum: string | null;
  };
}

/**
 * Bureaus uit het register die we (nog) niet crawlen: wel ingeschreven, maar
 * zonder gepubliceerde website en met één inschrijving op het domein. Ze staan
 * in de markt, niet in de meting. Zichtbaar maken hoort erbij -- anders lijkt de
 * gemeten markt de hele markt.
 */
export function telNietGevolgdeArchitecten(regio: RegioFilter = {}) {
  const db = getDb();
  const r = regioWaar(regio);
  return (db.prepare(`
    SELECT COUNT(*) n FROM concurrenten c
     WHERE c.volgen = 0 AND ${inMarkt("architectuur")} ${r.sql}
  `).get(...r.params) as { n: number }).n;
}
