/**
 * Concurrentiemonitor. Bedient vier markten met dezelfde crawl:
 *   - energie        EPB en ventilatie
 *   - engineering    stabiliteitsstudies
 *   - architectuur   bouwontwerp voor particuliere bouwheren (H-Architects)
 *   - regularisatie  bouwovertredingen regulariseren (regulariseren.be)
 *
 * Bronnen:
 *  1. twee openbare registers: het VEKA-register van erkende verslaggevers
 *     (energiemarkt) en het ledenregister van de Orde van Architecten
 *     (architectuurmarkt). Engineering en regularisatie hebben er geen.
 *  2. de zoekresultaten op onze zoektermen (alle markten, zie lib/zoekwoorden.ts)
 *  3. een eigen crawl van hun websites (wie is er zichtbaar, en wat verandert er)
 *  4. voor regularisatie: het handmatige concurrentieonderzoek van augustus 2026
 *     (REGULARISATIE_ONDERZOEK hieronder), als startlijst waar de rest op voortbouwt
 *
 * Eén domein kan in meerdere markten meespelen; welke markten dat zijn staat in
 * `concurrent_markt`. De crawl zelf is marktloos: die meet elk domein één keer
 * en telt de omvang apart per markt (`epb_paginas`, `eng_paginas`, `arch_paginas`,
 * `reg_paginas`).
 *
 * Alles wat we ophalen is publiek: sitemap, robots.txt en de homepage.
 * We lezen alleen; er wordt nergens naar buiten geschreven.
 */

import fs from "fs";
import path from "path";
import { getDb } from "./db";

const UA =
  "Mozilla/5.0 (compatible; UnaboConcurrentieMonitor/1.0; +https://unabo.be)";
const TIMEOUT_MS = 20_000;
const MAX_URLS = 3000;
const PARALLEL = 6;

export const vandaag = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Diensten die in deze markt voorkomen. Sleutel = wat we tonen.
// ---------------------------------------------------------------------------
const DIENSTEN: { key: string; patronen: RegExp }[] = [
  { key: "EPB-verslaggeving", patronen: /\bepb[- ]?(verslaggev|aangifte|studie|rapport)/i },
  { key: "Ventilatieverslaggeving", patronen: /ventilatie[- ]?(verslag|rapport|meting)|ventilatiedocument/i },
  { key: "EPC", patronen: /\bepc\b|energieprestatiecertificaat/i },
  { key: "Luchtdichtheid", patronen: /luchtdicht|blower ?door/i },
  { key: "Asbest", patronen: /asbest/i },
  { key: "Veiligheidscoördinatie", patronen: /veiligheidsco[oö]rdinat/i },
  { key: "Stabiliteit", patronen: /stabiliteit|stabiliteitsstud|ingenieursstud/i },
  { key: "Landmeting", patronen: /landmeter|opmeting|opmeten van/i },
  { key: "Plaatsbeschrijving", patronen: /plaatsbeschrijving/i },
  { key: "3D-scanning", patronen: /3d[- ]?scan|laserscan|pointcloud/i },
  { key: "Energieaudit", patronen: /energieaudit|energiestud|energiedeskundige/i },
  { key: "Premies & subsidies", patronen: /premie|subsidie|mijn ?verbouwpremie/i },
  { key: "Onderaanneming", patronen: /onderaannem|uitbested/i },
  // Engineering-markt: waar een studiebureau stabiliteit zijn geld mee verdient.
  { key: "Betonstudie & staalbouw", patronen: /betonstud|betonberek|betonconstruct|gewapend[- ]?beton|staalconstruct|staalbouw|stalen[- ]?(ligger|balk|profiel)/i },
  { key: "Funderingen", patronen: /funderin|paalfunder|onderschoei/i },
  { key: "Structurele diagnose", patronen: /scheurvorming|scheuren in|structurele (diagnose|schade)|schade[- ]?expertise|instabiliteit/i },
  { key: "Meetstaten", patronen: /meetstaat|meetstaten|hoeveelheidsstaat/i },
  { key: "Omgevingsvergunning", patronen: /omgevingsvergunning|bouwaanvraag|vergunningsdossier/i },
  { key: "BIM & tekenwerk", patronen: /\bbim\b|revit|uitvoeringsplan|tekenwerk/i },
  // "Architect, aannemer of projectontwikkelaar" is een doelgroep, geen dienst.
  // Daarom een bureau- of studiewoord eisen in plaats van het kale "architect".
  { key: "Architectuur", patronen: /architect(en|uur)[- ]?bureau|architectuurstudie|\/architectuur/i },
  // Architectuur-markt: waar een architectenbureau voor particulieren zijn geld
  // mee verdient. "Renovatie" en "nieuwbouw" alleen zijn te breed -- die staan op
  // elke aannemerssite -- dus koppelen we ze aan ontwerp, plan of architect.
  { key: "Nieuwbouw", patronen: /nieuwbouw(woning|project|ontwerp|plannen)?|nieuw te bouwen woning|bouwen van een woning/i },
  { key: "Renovatie & verbouwing", patronen: /(verbouwing|renovatie|verbouwen)[a-z]*[- ]?(project|ontwerp|plan|advies|begeleiding)|totaalrenovatie|renovatiearchitect|verbouwingsarchitect/i },
  { key: "Regularisatie", patronen: /regularisat|bouwovertreding|regulariser|planologisch attest/i },
  { key: "Interieurarchitectuur", patronen: /interieurarchitect|interieurontwerp|binnenhuisarchitect/i },
  { key: "Aankoopbegeleiding", patronen: /aankoopbegeleid|bouwtechnisch(e)? (keuring|advies)|woningcheck|aankoopkeuring/i },
  // Regularisatie-markt: wat een specialist rond bouwovertredingen aanbiedt naast
  // het dossier zelf. Het maatregelenregister is de hefboom uit het onderzoek van
  // augustus 2026 -- geen enkele concurrent noemde het toen. Dat is precies wat
  // deze dienstenlijst moet blijven meten.
  { key: "Maatregelenregister", patronen: /maatregelenregister/i },
  { key: "Haalbaarheidsstudie", patronen: /haalbaarheidsstud|haalbaarheidsonderzoek|haalbaarheidsanalyse/i },
  { key: "Prijscalculator", patronen: /prijscalculator|kostencalculator|bereken (je|uw|de) (kost|prijs)|calculator/i },
  { key: "Juridisch advies bouwrecht", patronen: /omgevingsrecht|bouwrecht|advoca(a)?t(en)?kantoor|juridisch advies/i },
  { key: "Vermoeden van vergunning", patronen: /vermoeden van vergunning/i },
];

// Een categorie- of paginatie-archief is geen artikel. Zonder deze filter telt
// /nieuws/regelgeving/ mee als publicatie, en dan lijkt een site actiever dan hij is.
const ARCHIEF =
  /\/(page|pagina|tag|categorie|category|author|auteur|archief|archive|feed)\/|\/page\/\d+/i;

// Waar deze markt over gaat. Bepaalt de omvang van een concurrent in ONZE markt,
// in plaats van zijn totale omvang: Arcadis heeft 3000 pagina's maar nauwelijks EPB.
const EPB_RELEVANT =
  /(epb|epc|energie|energy|ventilatie|luchtdicht|blower|isolat|s-?peil|e-?peil|k-?peil|verslaggev|premie|renovat|epw|ben-?woning|energieprestatie)/i;

/**
 * Hetzelfde, maar voor de Engineering-markt: stabiliteit, beton en staal.
 * Bewust strak gehouden. "verbouwing" en "bouwkundig" staan er niet in: die
 * komen op elke aannemerssite voor en zouden half Vlaanderen tot studiebureau
 * maken. Het losse woord "structureel" staat er evenmin in: "structurele
 * maatregelen" en "structural insulated panel" zijn geen stabiliteitswerk, en dat
 * zette een politieke partij en een isolatiefabrikant in deze markt. Een
 * sloopopvolgingsplan telt evenmin: dat gaat over afval, niet over draagkracht.
 * Meetstaten wél -- die verkoopt TKN-Buro, en TKN valt onder Engineering.
 */
const ENG_RELEVANT =
  /(stabilit|draagstructuur|draagkracht|draagvermogen|dragende[- ]?muur|muurdoorbraak|funderin|betonstud|betonberek|betonconstruct|gewapend[- ]?beton|staalconstruct|staalbouw|stalen[- ]?(ligger|balk|profiel)|balkberekening|ingenieursbureau|ingenieursstud|studiebureau|structurele[- ](schade|diagnose|analyse|studie|berekening|stabiliteit)|structuurberekening|scheurvorming|meetstaat|meetstaten|eurocode)/i;

/**
 * Hetzelfde, maar voor de Architectuur-markt: het ontwerpwerk van een
 * architectenbureau voor particuliere bouwheren.
 *
 * Bewust géén kaal "renovatie", "verbouwing" of "nieuwbouw": die woorden staan
 * op elke aannemers-, keuken- en isolatiesite in Vlaanderen, en dan telt de
 * omvang van deze markt in duizenden pagina's die niets met ontwerp te maken
 * hebben. Wat er wél in staat is ofwel het vak zelf (architect, ontwerp,
 * omgevingsvergunning), ofwel een projectsoort die een bouwheer bij een
 * architect brengt en niet bij een aannemer: een regularisatie, een uitbouw,
 * een dakkapel, aankoopbegeleiding. "renovatieproject" en "nieuwbouwwoning"
 * mogen wel: dat zijn projectpagina's, geen dienstenlijstjes.
 */
const ARCH_RELEVANT =
  /(architect|architectuur|ontwerpbureau|bouwontwerp|woningontwerp|interieurontwerp|binnenhuis|regularisat|bouwovertreding|omgevingsvergunning|bouwaanvraag|stedenbouwkundig|bouwheer|aankoopbegeleid|nieuwbouw(woning|project|ontwerp)|renovatie(project|ontwerp|advies)|verbouwings?(project|ontwerp|plan|advies)|totaalrenovatie|uitbouw|aanbouw|dakkapel|gevelrenovatie|maquette|3d[- ]?visualisat)/i;

/**
 * Hetzelfde, maar voor de Regularisatie-markt: bouwovertredingen rechtzetten.
 *
 * Strakker dan de architectuurlijst, met opzet. "omgevingsvergunning" en
 * "bouwaanvraag" staan er níét in: die woorden staan op elke architecten- en
 * verslaggeverssite en zeggen niets over regularisatie. Wat er wél in staat is
 * het probleem zelf (bouwovertreding, bouwmisdrijf, onvergund, zonder vergunning),
 * het traject (regulariseren, regularisatievergunning, vermoeden van vergunning,
 * planologisch attest) en het juridische gevolg (maatregelenregister,
 * herstelvordering, dwangsom, meerwaardeheffing). Een architect met één
 * dienstenpagina "regularisatie" haalt zo één pagina; een specialist haalt er
 * tien -- en dat verschil is precies de omvang die we willen meten.
 */
const REG_RELEVANT =
  /(regularis|bouwovertreding|bouwmisdrijf|bouwinbreuk|onvergund|niet[- ]vergund|zonder[- ]vergunning|maatregelenregister|vermoeden[- ]van[- ]vergunning|planologisch[- ]attest|stedenbouwkundige?[- ]overtreding|herstelvordering|dwangsom|meerwaardeheffing|as[- ]?built[- ]?attest)/i;

/**
 * Een specialistensite draagt het onderwerp in zijn domeinnaam en niet in zijn
 * paden: regulariseren.be/tarieven/ gaat over regularisatie, ook al staat het
 * woord niet in het pad. Zonder deze regel scoort regulariseren.be nul in zijn
 * eigen markt, en vergund.be of onvergund.be net zo. Op zo'n domein telt elke
 * pagina mee. "vergund" is hier bewust wél opgenomen (vergund.be is een
 * regularisatiemerk), terwijl het in REG_RELEVANT ontbreekt omdat het daar op
 * elke vergunningspagina zou afgaan.
 */
const REG_DOMEIN = /(regularis|bouwovertreding|bouwmisdrijf|(^|\.)(on)?vergund\.)/i;

// Wijst op een gehackte site: gok- en adultspam. Dat is geen concurrentie maar een
// waarschuwing dat de meting van die site niets voorstelt.
//
// Losse deelwoorden zijn hier gevaarlijk: "spe-CIALIS-t" en "amit-KUMAR" zijn geen spam,
// en het casino van Middelkerke is een echt architectuurproject van Sweco en B2Ai.
// Daarom matchen we op hele woorden binnen een URL-segment, en vraagt "casino" een
// tweede gokaanwijzing.
const SPAM_WOORDEN =
  /(^|[^a-z])(onlyfans|mostbet|1xbet|parimatch|marsbahis|bahis|bettilt|pinup|porn|xxx|escort|viagra|cialis|tadalafil|betting|gambling)([^a-z]|$)/i;
// "bonus" en "slot" zijn gewone Nederlandse woorden — totaalrenovatiebonus, slotverklaring.
// Ze mogen dus geen context zijn, alleen bevestiging, en nooit zichzelf bevestigen.
const GOK_CONTEXT = /(casino|jackpot|gokkast|slot-?machine|betting-?site)/i;
const GOK_BEVESTIGING =
  /(online|siteleri|giris|guncel|deneme|no-?deposit|gokken|gokkast|cruks|wedden|weddenschap|bonus|games)/i;

function isSpam(pad: string): boolean {
  if (SPAM_WOORDEN.test(pad)) return true;
  return GOK_CONTEXT.test(pad) && GOK_BEVESTIGING.test(pad);
}

const BLOG_PAD =
  /\/(blog|nieuws|actua|actualiteit|artikel|artikels|kennis|kennisbank|tips|inzicht|publicatie|post|weetjes|updates?)(\/|$)/i;
const BLOG_DATUM = /\/(19|20)\d{2}\/\d{1,2}\//;

const CMS_SIGNALEN: { key: string; patroon: RegExp }[] = [
  { key: "WordPress", patroon: /wp-content|wp-includes|wp-json/i },
  { key: "Wix", patroon: /static\.wixstatic|wix\.com/i },
  { key: "Squarespace", patroon: /squarespace/i },
  { key: "Webflow", patroon: /webflow/i },
  { key: "Drupal", patroon: /drupal/i },
  { key: "Joomla", patroon: /joomla/i },
  { key: "Shopify", patroon: /cdn\.shopify/i },
  { key: "Next.js", patroon: /\/_next\/static/i },
  { key: "Combell Sitebuilder", patroon: /sitebuilder|combell/i },
];

// ---------------------------------------------------------------------------
// Ophalen
// ---------------------------------------------------------------------------
type Haal = { ok: boolean; status: number; tekst: string; eindUrl: string; ms: number; fout?: string };

async function haal(url: string, accepteerHtml = true): Promise<Haal> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accepteerHtml ? "text/html,application/xhtml+xml,application/xml" : "application/xml,text/xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const tekst = await res.text();
    return { ok: res.ok, status: res.status, tekst, eindUrl: res.url || url, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, tekst: "", eindUrl: url, ms: Date.now() - t0, fout: String((e as Error)?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Sitemaps
// ---------------------------------------------------------------------------
type SitemapUrl = { url: string; lastmod: string; bron: string };

function parseLocs(xml: string, bron = ""): SitemapUrl[] {
  const uit: SitemapUrl[] = [];
  const blokken = xml.match(/<(url|sitemap)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blokken) {
    const loc = b.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lm = b.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1]?.trim() || "";
    uit.push({ url: loc, lastmod: lm.slice(0, 10), bron });
  }
  return uit;
}

async function sitemapUrls(domein: string, robots: string): Promise<{ urls: SitemapUrl[]; gevonden: boolean }> {
  const kandidaten = [
    ...Array.from(robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map((m) => m[1]),
    `https://${domein}/sitemap_index.xml`,
    `https://${domein}/sitemap.xml`,
    `https://${domein}/wp-sitemap.xml`,
    `https://${domein}/sitemap-index.xml`,
  ];
  const gezien = new Set<string>();
  const uit: SitemapUrl[] = [];
  const wachtrij = [...new Set(kandidaten)];
  let opgehaald = 0;
  let gevonden = false;

  while (wachtrij.length && uit.length < MAX_URLS && opgehaald < 40) {
    const sm = wachtrij.shift()!;
    if (gezien.has(sm)) continue;
    gezien.add(sm);
    const r = await haal(sm, false);
    opgehaald++;
    if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.tekst)) continue;
    gevonden = true;
    const isIndex = /<sitemapindex/i.test(r.tekst);
    for (const item of parseLocs(r.tekst, sm)) {
      if (isIndex) wachtrij.push(item.url);
      else if (uit.length < MAX_URLS) uit.push(item);
    }
  }
  return { urls: uit, gevonden };
}

/** Eén URL indelen. Alle kennis zit in de URL zelf, dus dit kan ook achteraf
 *  opnieuw over reeds opgeslagen URL's draaien zonder een site te hercrawlen. */
export function classificeer(url: string, lastmod = "", bron = "") {
  const { pad, host } = (() => {
    try { const u = new URL(url); return { pad: u.pathname, host: u.hostname }; } catch { return { pad: url, host: "" }; }
  })();

  // WordPress/Yoast splitst de sitemap per inhoudstype. Dat is een veel hardere
  // aanwijzing dan het URL-pad: mijnepb.be publiceert artikels op /artikel-titel/
  // zonder /blog/ ervoor, en dan raadt een padregel er altijd naast.
  const isPost = /(^|[/_-])(post|posts|nieuws|blog|artikel)s?-?sitemap/i.test(bron);
  const isPage = /(^|[/_-])(page|pagina)s?-?sitemap/i.test(bron);

  const padZegtBlog = BLOG_PAD.test(pad) || BLOG_DATUM.test(pad);
  const isBlog = isPost ? true : isPage ? false : padZegtBlog;

  // Een categorie-, tag- of paginatiepagina is geen artikel. Alleen de RUBRIEK
  // zelf telt niet mee (/blog/, /kennisbank/): dat is één segment. Een artikel
  // staat er één niveau onder (/kennisbank/ben-ik-epb-plichtig/) en is echte
  // inhoud. Stond dit op <= 2, dan verdween elk artikel van een site zonder
  // aparte WordPress-artikelsitemap uit de telling.
  const kortPadOnderBlogroot =
    padZegtBlog && /\/$/.test(pad) && pad.split("/").filter(Boolean).length <= 1;

  return {
    url,
    lastmod,
    bron,
    soort: isBlog ? "blog" : "pagina",
    archief: ARCHIEF.test(pad) || (!isPost && kortPadOnderBlogroot),
    spam: isSpam(pad),
    epb: EPB_RELEVANT.test(pad),
    eng: ENG_RELEVANT.test(pad),
    arch: ARCH_RELEVANT.test(pad),
    reg: REG_RELEVANT.test(pad) || REG_DOMEIN.test(host),
  };
}

// ---------------------------------------------------------------------------
// Eén domein doormeten
// ---------------------------------------------------------------------------
export type Snapshot = {
  domein: string;
  datum: string;
  bereikbaar: number;
  http_status: number;
  ttfb_ms: number;
  eind_url: string;
  titel: string;
  meta_desc: string;
  cms: string;
  paginas: number;
  blog_paginas: number;
  laatste_blog: string;
  laatste_blog_url: string;
  blog_per_maand: number;
  diensten: string;
  heeft_schema: number;
  heeft_localbiz: number;
  woorden_home: number;
  heeft_sitemap: number;
  blog_artikels: number;
  epb_paginas: number;
  eng_paginas: number;
  arch_paginas: number;
  reg_paginas: number;
  spam_verdacht: number;
  fout: string;
  urls: { url: string; soort: string; lastmod: string; bron: string; archief: boolean; spam: boolean; epb: boolean; eng: boolean; arch: boolean; reg: boolean }[];
};

/**
 * Ontkenningen tellen niet als aangeboden dienst. Sites bakenen hun aanbod
 * juist af met een zin als "Geen EPC bij verkoop, geen asbestattest, geen
 * keuringen: alleen EPB en ventilatie" — dat betekende tot nu toe dat die site
 * EPC én asbest aanbood. Eén niet-ontkende vermelding volstaat om te tellen.
 */
const ONTKENNING = /\b(geen|niet|zonder|nooit)\b[^.!?;]{0,40}$/i;

export function biedtAan(patroon: RegExp, tekst: string): boolean {
  const vlaggen = patroon.flags.includes("g") ? patroon.flags : patroon.flags + "g";
  for (const m of tekst.matchAll(new RegExp(patroon.source, vlaggen))) {
    if (m.index === undefined) continue;
    if (!ONTKENNING.test(tekst.slice(Math.max(0, m.index - 60), m.index))) return true;
  }
  return false;
}

export async function meetDomein(domein: string): Promise<Snapshot> {
  const datum = vandaag();
  const leeg: Snapshot = {
    domein, datum, bereikbaar: 0, http_status: 0, ttfb_ms: 0, eind_url: "", titel: "",
    meta_desc: "", cms: "", paginas: 0, blog_paginas: 0, laatste_blog: "", laatste_blog_url: "", blog_per_maand: 0,
    diensten: "[]", heeft_schema: 0, heeft_localbiz: 0, woorden_home: 0, heeft_sitemap: 0, blog_artikels: 0, epb_paginas: 0, eng_paginas: 0, arch_paginas: 0, reg_paginas: 0, spam_verdacht: 0, fout: "", urls: [],
  };

  // Sommige bureaus draaien alleen op www, of alleen op http. Probeer die varianten
  // voor we besluiten dat een site onbereikbaar is.
  let home = await haal(`https://${domein}/`);
  let basis = domein;
  if (!home.ok && home.status !== 403) {
    const alternatieven = domein.startsWith("www.")
      ? [domein.slice(4), `http://${domein}/`]
      : [`https://www.${domein}/`, `http://${domein}/`];
    for (const alt of alternatieven) {
      const u = alt.startsWith("http") ? alt : `https://${alt}/`;
      const poging = await haal(u);
      if (poging.ok) {
        home = poging;
        try { basis = new URL(poging.eindUrl).hostname; } catch { /* laat basis staan */ }
        break;
      }
    }
  }
  if (!home.ok) {
    const reden = home.status === 403 ? "blokkeert crawlers (403)" : home.fout || `HTTP ${home.status}`;
    return { ...leeg, http_status: home.status, ttfb_ms: home.ms, fout: reden };
  }

  const html = home.tekst;
  const tekst = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const robots = (await haal(`https://${basis}/robots.txt`, false)).tekst || "";
  const { urls, gevonden: heeftSitemap } = await sitemapUrls(basis, robots);

  const gerangschikt = urls.map((u) => classificeer(u.url, u.lastmod, u.bron));

  const blogs = gerangschikt.filter((u) => u.soort === "blog");
  const artikels = blogs.filter((u) => !u.archief && !u.spam);
  const spam = gerangschikt.filter((u) => u.spam);
  const epbPaginas = gerangschikt.filter((u) => u.epb && !u.spam);
  const engPaginas = gerangschikt.filter((u) => u.eng && !u.spam);
  const archPaginas = gerangschikt.filter((u) => u.arch && !u.spam);
  const regPaginas = gerangschikt.filter((u) => u.reg && !u.spam);
  const metDatum = artikels.filter((a) => a.lastmod).sort((a, b) => a.lastmod.localeCompare(b.lastmod));
  const nieuwste = metDatum[metDatum.length - 1];
  const blogDatums = metDatum.map((b) => b.lastmod);
  const laatsteBlog = blogDatums.length ? blogDatums[blogDatums.length - 1] : "";
  const grens = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const recent = blogDatums.filter((d) => d >= grens).length;

  // Diensten herkennen uit de homepage én uit de URL-structuur van de site.
  const zoekbaar = tekst + " " + gerangschikt.map((u) => u.url).join(" ");
  const diensten = DIENSTEN.filter((d) => biedtAan(d.patronen, zoekbaar)).map((d) => d.key);

  return {
    domein,
    datum,
    bereikbaar: 1,
    http_status: home.status,
    ttfb_ms: home.ms,
    eind_url: home.eindUrl,
    titel: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 300),
    meta_desc: (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1] || "")
      .replace(/\s+/g, " ").trim().slice(0, 500),
    cms: CMS_SIGNALEN.find((c) => c.patroon.test(html))?.key || "",
    paginas: gerangschikt.length,
    blog_paginas: blogs.length,
    blog_artikels: artikels.length,
    epb_paginas: epbPaginas.length,
    eng_paginas: engPaginas.length,
    arch_paginas: archPaginas.length,
    reg_paginas: regPaginas.length,
    spam_verdacht: spam.length,
    laatste_blog: laatsteBlog,
    laatste_blog_url: nieuwste?.url || "",
    blog_per_maand: Math.round((recent / 12) * 10) / 10,
    diensten: JSON.stringify(diensten),
    heeft_schema: /application\/ld\+json/i.test(html) ? 1 : 0,
    heeft_localbiz: /"@type"\s*:\s*"(LocalBusiness|ProfessionalService|Organization)"/i.test(html) ? 1 : 0,
    woorden_home: tekst.trim().split(/\s+/).filter(Boolean).length,
    heeft_sitemap: heeftSitemap ? 1 : 0,
    fout: "",
    urls: gerangschikt,
  };
}

// ---------------------------------------------------------------------------
// Wegschrijven + signalen afleiden
// ---------------------------------------------------------------------------
function bewaarSnapshot(s: Snapshot) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO site_snapshots
     (domein,datum,bereikbaar,http_status,ttfb_ms,eind_url,titel,meta_desc,cms,paginas,
      blog_paginas,laatste_blog,laatste_blog_url,blog_per_maand,diensten,heeft_schema,heeft_localbiz,woorden_home,heeft_sitemap,
      blog_artikels,epb_paginas,eng_paginas,arch_paginas,reg_paginas,spam_verdacht,fout)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    s.domein, s.datum, s.bereikbaar, s.http_status, s.ttfb_ms, s.eind_url, s.titel, s.meta_desc,
    s.cms, s.paginas, s.blog_paginas, s.laatste_blog, s.laatste_blog_url, s.blog_per_maand, s.diensten,
    s.heeft_schema, s.heeft_localbiz, s.woorden_home, s.heeft_sitemap,
    s.blog_artikels, s.epb_paginas, s.eng_paginas, s.arch_paginas, s.reg_paginas, s.spam_verdacht, s.fout
  );

  // Nieuwe URL's = signaal. De eerste crawl van een domein levert géén signalen op,
  // anders krijg je bij de start honderden meldingen over bestaande pagina's.
  const eerdereCrawl = db
    .prepare("SELECT COUNT(*) n FROM site_urls WHERE domein = ?")
    .get(s.domein) as { n: number };
  const isEersteKeer = eerdereCrawl.n === 0;

  const bestaat = db.prepare("SELECT url FROM site_urls WHERE domein = ?").all(s.domein) as { url: string }[];
  const bekend = new Set(bestaat.map((r) => r.url));

  const upsert = db.prepare(
    `INSERT INTO site_urls (domein,url,soort,lastmod,sitemap_bron,artikel,markt_eng,markt_arch,markt_reg,eerste_zien,laatste_zien)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(domein,url) DO UPDATE SET
       lastmod=excluded.lastmod, soort=excluded.soort, artikel=excluded.artikel,
       markt_eng=excluded.markt_eng, markt_arch=excluded.markt_arch, markt_reg=excluded.markt_reg,
       sitemap_bron=excluded.sitemap_bron, laatste_zien=excluded.laatste_zien`
  );
  const signaal = db.prepare(
    "INSERT INTO signalen (domein,datum,soort,omschrijving,url) VALUES (?,?,?,?,?)"
  );

  db.transaction(() => {
    for (const u of s.urls) {
      const isArtikel = u.soort === "blog" && !u.archief && !u.spam ? 1 : 0;
      upsert.run(
        s.domein, u.url, u.soort, u.lastmod, u.bron || "", isArtikel,
        u.eng && !u.spam ? 1 : 0, u.arch && !u.spam ? 1 : 0, u.reg && !u.spam ? 1 : 0, s.datum, s.datum
      );
      if (!isEersteKeer && !bekend.has(u.url) && !u.spam) {
        signaal.run(
          s.domein,
          s.datum,
          u.soort === "blog" ? "nieuwe-blog" : "nieuwe-pagina",
          u.soort === "blog" ? "Nieuw blogartikel gepubliceerd" : "Nieuwe pagina online",
          u.url
        );
      }
    }
    // Volledig tijdstip, niet enkel de datum: anders draaien twee runs op dezelfde
    // dag allebei over exact dezelfde 90 domeinen en blijft de rest onaangeroerd.
    db.prepare("UPDATE concurrenten SET laatste_check = ? WHERE domein = ?")
      .run(new Date().toISOString(), s.domein);
  })();
}

export async function crawlDomeinen(domeinen: string[]) {
  const resultaten: { domein: string; ok: boolean; paginas: number; fout?: string }[] = [];
  for (let i = 0; i < domeinen.length; i += PARALLEL) {
    const groep = domeinen.slice(i, i + PARALLEL);
    const snaps = await Promise.all(groep.map((d) => meetDomein(d).catch((e) => ({ ...({} as Snapshot), domein: d, fout: String(e) } as Snapshot))));
    for (const s of snaps) {
      try {
        bewaarSnapshot({ ...s, urls: s.urls || [] });
        resultaten.push({ domein: s.domein, ok: !!s.bereikbaar, paginas: s.paginas || 0, fout: s.fout || undefined });
      } catch (e) {
        resultaten.push({ domein: s.domein, ok: false, paginas: 0, fout: String(e) });
      }
    }
  }
  return resultaten;
}

// ---------------------------------------------------------------------------
// Register inlezen
// ---------------------------------------------------------------------------
/** Onze eigen sites. Staan niet in het register, maar moeten wél meegemeten worden. */
export const EIGEN_DOMEINEN = [
  { domein: "energie-efficient.be", naam: "Energie-Efficient (wij)", markten: ["energie"] },
  // unabo.be draagt beide afdelingen: EPB én de stabiliteitsstudies.
  { domein: "unabo.be", naam: "Unabo (wij)", markten: ["energie", "engineering"] },
  // h-architects.be draagt ook regularisatie: acht pagina's over bouwovertredingen,
  // en daarmee de sterkste interne concurrent van regulariseren.be.
  { domein: "h-architects.be", naam: "H-Architects (wij)", markten: ["architectuur", "regularisatie"] },
  // De proefomgeving meten we mee: daar staat wat nog niet live is, en het
  // verschil tussen die twee is precies wat er nog te publiceren valt.
  { domein: "h-architects.globaal.be", naam: "H-Architects proef (wij)", markten: ["architectuur"] },
  // De specialistensite voor regularisatie (uitgever UNABO, uitvoerder H-Architects)
  // en de zelfcheck-tool ernaast. Twee eigen merken in één markt, bewust zonder
  // link naar elkaar -- zie de contentstrategie regularisatie.
  { domein: "regulariseren.be", naam: "Regulariseren.be (wij)", markten: ["regularisatie"] },
  { domein: "mijnregularisatie.be", naam: "Mijnregularisatie.be (wij)", markten: ["regularisatie"] },
];

export type Markt = "energie" | "engineering" | "architectuur" | "regularisatie";
export const MARKTEN: Markt[] = ["energie", "engineering", "architectuur", "regularisatie"];

/**
 * Startlijst van de Regularisatie-markt: het concurrentieonderzoek van 11 augustus
 * 2026 (marketing/seo/firmas/Regulariseren/onderzoek/CONCURRENTIEONDERZOEK-
 * VLAANDEREN-2026-08.md). Voor regularisatie bestaat geen register, en de crawl
 * kent deze sites pas nadat iemand ze heeft aangedragen. Dit is die aandracht:
 * de zes gespecialiseerde merken, de architectenbureaus met een eigen
 * regularisatiepagina, en de spelers ernaast die om dezelfde zoekvragen vechten.
 *
 * De categorie is een startpunt. Wie de markt kent zet hem recht met de knopjes
 * op de pagina; dat oordeel gaat vóór en blijft staan. Bron in `concurrent_markt`
 * is `onderzoek`, zodat de pagina kan zeggen waar de lijst vandaan komt.
 */
export const REGULARISATIE_ONDERZOEK: { domein: string; naam: string; categorie: string }[] = [
  // A. gespecialiseerde regularisatiemerken -- de directe concurrenten
  { domein: "vergund.be", naam: "Vergund.be (stel architecten)", categorie: "concurrent" },
  { domein: "onvergund.be", naam: "Onvergund.be (M-Desk)", categorie: "concurrent" },
  { domein: "regularisatie.jpgarchitecten.be", naam: "JPG Architecten — regularisatie", categorie: "concurrent" },
  { domein: "regulant.be", naam: "Regulant", categorie: "concurrent" },
  { domein: "bouwovertreding-regulariseren.be", naam: "Ruimtestrateeg", categorie: "concurrent" },
  { domein: "regularisatie-architect.com", naam: "Regularisatie-architect (Antwerpen)", categorie: "concurrent" },
  // B. architectenbureaus met een eigen regularisatiepagina -- ranken op dezelfde termen
  { domein: "kvdarchitectuur.be", naam: "KVD Architectuur", categorie: "concurrent" },
  { domein: "fish-architect.be", naam: "FISH Architecten", categorie: "concurrent" },
  { domein: "wimjansenarchitect.be", naam: "Wim Jansen Architect", categorie: "concurrent" },
  { domein: "sito-architecten.be", naam: "SITO Architecten", categorie: "concurrent" },
  { domein: "imaginearchitects.be", naam: "Imagine Architects", categorie: "concurrent" },
  { domein: "nikuarchitecten.be", naam: "Niku Architecten", categorie: "concurrent" },
  { domein: "plam.be", naam: "PLAM Architectuur", categorie: "concurrent" },
  { domein: "bouwovertreding.be", naam: "Bouwovertreding.be (Stefan Cassiers)", categorie: "concurrent" },
  // C. geen architect, wél concurrent om de aandacht
  { domein: "confianz.be", naam: "Confianz (advocaten omgevingsrecht)", categorie: "concurrent" },
  { domein: "casius.be", naam: "Casius (offerteplatform)", categorie: "portaal" },
  { domein: "spotto.be", naam: "Spotto (vastgoeddata)", categorie: "portaal" },
];

/**
 * Zet de startlijst uit het onderzoek in de gevolgde domeinen en in de markt.
 * Bestaat een domein al (bv. via het architectenregister), dan wint de naam uit
 * het onderzoek: dat is de merknaam die iemand herkent, waar het register de
 * zaakvoerder of de vennootschap geeft. De categorie blijft staan -- een
 * menselijk oordeel zit sowieso in `beoordelingen` en gaat overal vóór.
 */
export function registreerRegularisatieOnderzoek() {
  const db = getDb();
  const nu = vandaag();
  const ins = db.prepare(
    `INSERT INTO concurrenten (domein,naam,bron,volgen,categorie,verslaggevers,eerste_zien)
     VALUES (?,?,'onderzoek',1,?,0,?)
     ON CONFLICT(domein) DO UPDATE SET volgen = 1, naam = excluded.naam`
  );
  let toegevoegd = 0;
  db.transaction(() => {
    for (const r of REGULARISATIE_ONDERZOEK) {
      if (ins.run(r.domein, r.naam, r.categorie, nu).changes) toegevoegd++;
      markeerMarkt(r.domein, "regularisatie", "onderzoek");
    }
  })();
  registreerEigenDomeinen();
  return { onderzoek: REGULARISATIE_ONDERZOEK.length, toegevoegd };
}

/** Zet een domein in een markt. Blijft staan zodra het er in zit. */
export function markeerMarkt(domein: string, markt: Markt, bron: string) {
  getDb()
    .prepare(
      `INSERT INTO concurrent_markt (domein, markt, bron, eerste_zien)
       VALUES (?,?,?,?) ON CONFLICT(domein, markt) DO NOTHING`
    )
    .run(domein, markt, bron, vandaag());
}

/**
 * Deelt gevolgde domeinen in bij een markt op wat de crawl gevonden heeft.
 *
 * Het VEKA-register zegt wie EPB doet, maar voor stabiliteit bestaat zo'n
 * register niet. Wat een bureau doet, moet dus uit zijn eigen site komen:
 * genoeg pagina's over stabiliteit, of stabiliteit als herkende dienst.
 *
 * Twee grenzen tegelijk, en dat is met opzet: minstens drie pagina's, én
 * minstens 1% van de site. De absolute grens houdt losse vermeldingen buiten;
 * de verhouding houdt de reuzen buiten. Sweco heeft veertien stabiliteitspagina's
 * op 2.250 -- dat maakt er geen studiebureau van, net zoals Arcadis geen
 * EPB-bureau is. Zonder die tweede grens belandden een politieke partij en een
 * scoutsfederatie in deze lijst.
 *
 * Heeft een site geen bruikbare sitemap, dan is de verhouding onbekend en telt
 * alleen de absolute grens -- onbekend is niet hetzelfde als nul.
 *
 * Wie op onze zoektermen in de top 10 van Google staat, komt er sowieso in
 * (lib/zoekwoorden.ts). Die bron zegt harder wie in deze markt meespeelt dan
 * welke telling van pagina's ook.
 *
 * Een indeling die uit de crawl komt, herziet deze functie ook weer: dat is
 * niets meer dan de laatste meting. Wat uit het register, uit de zoekresultaten
 * of uit onze eigen lijst komt, blijft staan -- daar is de crawl geen bewijs tegen.
 */
/**
 * Wat zegt de site zelf te zijn?
 *
 * De indeling op domeinnaam komt niet ver: architectura.be, buildwise.be en
 * ctrl-f.be zien er alle drie uit als een bedrijf. Hun eigen titel is duidelijker
 * -- "Nieuwsplatform over en voor de bouwsector", "Het innovatiecentrum van de
 * Bouwsector", "Jobs voor experts in Engineering". Andersom net zo goed:
 * "Studiebureau stabiliteit" is geen twijfelgeval.
 *
 * Wordt alleen toegepast op domeinen die nog "onbekend" zijn. Een indeling uit het
 * register en elk menselijk oordeel blijven met rust.
 */
const UIT_TITEL: { patroon: RegExp; categorie: string }[] = [
  { patroon: /\b(jobs?|vacature|werken bij|rekruter|recruit|interim|detacher|talent en bedrijven)\b/i, categorie: "vacature" },
  // Wie zichzelf een studiebureau noemt, is er een -- ook als er "architecten en
  // ingenieurs" staat. Deze regel gaat daarom vóór de architectenregel.
  { patroon: /studiebureau|ingenieursbureau|raadgevend ingenieur|ingenieurs.{0,4}en adviesbureau|stabiliteitsstud/i, categorie: "concurrent" },
  { patroon: /nieuwsplatform|portaalsite|vakblad|vergelijk .{0,20}offertes|innovatiecentrum|kenniscentrum|beroepsfederatie|sectorfederatie|confederatie/i, categorie: "portaal" },
  // Een aannemer bouwt, een fabrikant levert. Allebei staan ze op onze zoektermen
  // en allebei kopen ze studies in plaats van ze te verkopen.
  { patroon: /sleutel[- ]op[- ]de[- ]deur|cl[ée] sur porte|bouwbedrijf|aannemer|woningbouw|maisons |totaalrenovatie|bouw met /i, categorie: "aannemer" },
  { patroon: /prefab|betonfabriek|welfsels|predallen|fabrikant|producent van|totaal bouwsysteem|op maat gemaakte? (beton|staal)/i, categorie: "fabrikant" },
  // Architecten zijn geen concurrent maar het tegenovergestelde: zij besteden
  // stabiliteitswerk uit. Dat is de doelgroep van de onderaannemingspagina.
  { patroon: /architect(en|uur)|interieurontwerp/i, categorie: "architect" },
];

export function categoriseerUitSite() {
  const db = getDb();
  const rijen = db.prepare(
    `SELECT c.domein, s.titel, s.meta_desc
       FROM concurrenten c
       JOIN (SELECT s.* FROM site_snapshots s
              JOIN (SELECT domein, MAX(datum) d FROM site_snapshots GROUP BY domein) m
                ON m.domein = s.domein AND m.d = s.datum) s ON s.domein = c.domein
      WHERE c.categorie = 'onbekend'
        AND NOT EXISTS (SELECT 1 FROM beoordelingen b WHERE b.soort='domein' AND b.sleutel=c.domein)`
  ).all() as { domein: string; titel: string | null; meta_desc: string | null }[];

  const upd = db.prepare("UPDATE concurrenten SET categorie = ? WHERE domein = ?");
  const telling: Record<string, number> = {};
  db.transaction(() => {
    for (const r of rijen) {
      const tekst = `${r.titel || ""} ${r.meta_desc || ""}`;
      const treffer = UIT_TITEL.find((u) => u.patroon.test(tekst));
      if (!treffer) continue;
      upd.run(treffer.categorie, r.domein);
      telling[treffer.categorie] = (telling[treffer.categorie] || 0) + 1;
    }
  })();
  return { bekeken: rijen.length, ...telling };
}

export function bepaalMarkten() {
  const db = getDb();
  const rijen = db
    .prepare(
      `SELECT s.domein, s.epb_paginas, s.eng_paginas, s.arch_paginas, s.reg_paginas, s.paginas, s.heeft_sitemap
         FROM site_snapshots s
         JOIN (SELECT domein, MAX(datum) d FROM site_snapshots GROUP BY domein) m
           ON m.domein = s.domein AND m.d = s.datum`
    )
    .all() as {
      domein: string; epb_paginas: number | null; eng_paginas: number | null;
      arch_paginas: number | null; reg_paginas: number | null; paginas: number | null; heeft_sitemap: number | null;
    }[];

  const MIN_PAGINAS = 3;
  const MIN_AANDEEL = 0.01;

  function hoortErbij(aantal: number | null, totaal: number | null): boolean {
    const n = aantal || 0;
    if (n < MIN_PAGINAS) return false;
    if (!totaal) return true;            // geen bruikbare sitemap: verhouding onbekend
    return n / totaal >= MIN_AANDEEL;
  }

  const verwijder = db.prepare(
    "DELETE FROM concurrent_markt WHERE domein = ? AND markt = ? AND bron = 'crawl'"
  );

  const geteld: Record<Markt, number> = { energie: 0, engineering: 0, architectuur: 0, regularisatie: 0 };
  let ingetrokken = 0;
  db.transaction(() => {
    for (const r of rijen) {
      // Architectuur staat hier bewust niet bij. Voor die markt bestaat een
      // volledig register -- niemand mag in België architect zijn zonder
      // inschrijving bij de Orde -- dus de crawl hoeft niet te raden wie er in
      // hoort. Zou hij dat wel doen, dan sleept hij de halve EPB-lijst mee:
      // "omgevingsvergunning" en "bouwaanvraag" staan op elke verslaggeverssite,
      // en drie zulke pagina's maken van een EPB-bureau geen architect. De
      // marktlijst komt daar dus uit het register en uit de zoekresultaten.
      //
      // Regularisatie staat er wél bij: geen register, dus de crawl mag hier net
      // als bij Engineering zelf indelen. De regex is strak genoeg (geen
      // "omgevingsvergunning") dat drie regularisatiepagina's ook echt over
      // regularisatie gaan -- een architect met zo'n dienstenpagina hoort in
      // deze markt, want hij vecht om dezelfde eigenaar met een bouwovertreding.
      for (const [markt, aantal] of [
        ["engineering", r.eng_paginas],
        ["energie", r.epb_paginas],
        ["regularisatie", r.reg_paginas],
      ] as const) {
        if (hoortErbij(aantal, r.paginas)) {
          markeerMarkt(r.domein, markt, "crawl");
          geteld[markt]++;
        } else {
          ingetrokken += verwijder.run(r.domein, markt).changes;
        }
      }
    }
  })();
  return { bekeken: rijen.length, ...geteld, ingetrokken, uitSite: categoriseerUitSite() };
}

export function importeerVerslaggevers() {
  const bestand = path.join(process.cwd(), "data-bronnen", "verslaggevers-2026-08.json");
  if (!fs.existsSync(bestand)) throw new Error(`Bronbestand ontbreekt: ${bestand}`);
  const bron = JSON.parse(fs.readFileSync(bestand, "utf8")) as {
    bron: string; opgehaald: string;
    records: { ep_code: string; naam: string; bedrijf: string; postcode: string; gemeente: string; telefoon: string; email: string; domein: string; provincie: string }[];
  };
  const db = getDb();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO verslaggevers
     (ep_code,naam,bedrijf,postcode,gemeente,provincie,telefoon,email,domein,bron_datum)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  db.transaction(() => {
    for (const r of bron.records) {
      ins.run(r.ep_code, r.naam, r.bedrijf, r.postcode, r.gemeente, r.provincie, r.telefoon, r.email, r.domein, bron.opgehaald);
    }
  })();

  // Domeinen uit het register worden gevolgde bedrijven.
  // De bedrijfsnaam is de naam die het vaakst bij dat domein hoort. MAX() zou de
  // alfabetisch laatste nemen, en dat levert bij een bureau met meerdere vennootschappen
  // een naam op die niemand herkent.
  const perDomein = db.prepare(
    `SELECT v.domein,
            COUNT(*) n,
            COALESCE(
              (SELECT b.bedrijf FROM verslaggevers b
                WHERE b.domein = v.domein AND b.bedrijf <> ''
                GROUP BY b.bedrijf ORDER BY COUNT(*) DESC, b.bedrijf LIMIT 1),
              ''
            ) naam,
            (SELECT p.provincie FROM verslaggevers p
              WHERE p.domein = v.domein AND p.provincie <> ''
              GROUP BY p.provincie ORDER BY COUNT(*) DESC LIMIT 1) provincie,
            (SELECT g.gemeente FROM verslaggevers g
              WHERE g.domein = v.domein AND g.gemeente <> ''
              GROUP BY g.gemeente ORDER BY COUNT(*) DESC LIMIT 1) gemeente
     FROM verslaggevers v WHERE v.domein <> '' GROUP BY v.domein`
  ).all() as { domein: string; n: number; naam: string; provincie: string; gemeente: string }[];

  const upsert = db.prepare(
    `INSERT INTO concurrenten (domein,naam,bron,volgen,categorie,verslaggevers,provincie,gemeente,eerste_zien)
     VALUES (?,?,'register',1,?,?,?,?,?)
     ON CONFLICT(domein) DO UPDATE SET
       verslaggevers = excluded.verslaggevers,
       naam = excluded.naam,
       provincie = COALESCE(NULLIF(concurrenten.provincie,''), excluded.provincie),
       gemeente = COALESCE(NULLIF(concurrenten.gemeente,''), excluded.gemeente)`
  );
  const nu = vandaag();
  db.transaction(() => {
    for (const d of perDomein) {
      // Voorlopige indeling: meerdere verslaggevers op één domein = bureau met omvang.
      const categorie = d.n >= 2 ? "concurrent" : "prospect";
      const naam = d.naam || d.domein.replace(/^www\./, "").replace(/\.(be|com|eu|nl)$/, "");
      upsert.run(d.domein, naam, categorie, d.n, d.provincie || "", d.gemeente || "", nu);
    }
  })();

  const eigen = registreerEigenDomeinen();

  return { verslaggevers: bron.records.length, domeinen: perDomein.length, eigen, bron: bron.bron };
}

/** Onze eigen sites als gevolgd domein wegzetten. Wordt door elke register-import geroepen. */
export function registreerEigenDomeinen() {
  const db = getDb();
  const nu = vandaag();
  const eigen = db.prepare(
    `INSERT INTO concurrenten (domein,naam,bron,volgen,categorie,verslaggevers,eerste_zien)
     VALUES (?,?,'eigen',1,'eigen',0,?)
     ON CONFLICT(domein) DO UPDATE SET naam = excluded.naam, categorie = 'eigen'`
  );
  db.transaction(() => {
    for (const e of EIGEN_DOMEINEN) {
      eigen.run(e.domein, e.naam, nu);
      for (const m of e.markten) markeerMarkt(e.domein, m as Markt, "eigen");
    }
  })();
  return EIGEN_DOMEINEN.length;
}

/**
 * Leest het ledenregister van de Orde van Architecten in.
 *
 * Zelfde vorm als het VEKA-register, met twee verschillen die er toe doen:
 *
 *  1. Een inschrijving is een persoon (stamnummer A...) óf een vennootschap
 *     (B...). De vennootschap is het bureau; de persoon is de architect. Beide
 *     staan in dezelfde tabel, want ze delen vaak hetzelfde e-maildomein en het
 *     is dat domein dat wij crawlen.
 *  2. De Orde publiceert wél een website per lid. Bij VEKA moesten we het domein
 *     uit het e-mailadres afleiden; hier is de website de eerste bron en het
 *     e-maildomein pas de terugval. Dat gebeurt in het exportscript, zodat het
 *     bronbestand zelfstandig leesbaar blijft.
 *
 * Indeling: twee of meer inschrijvingen op één domein = een bureau met omvang
 * (`concurrent`); één inschrijving = `prospect`. Dezelfde vuistregel als bij
 * energie, en net zo goed handmatig te corrigeren.
 */
export function importeerArchitecten() {
  const bestand = path.join(process.cwd(), "data-bronnen", "architecten-orde-2026-09.json");
  if (!fs.existsSync(bestand)) throw new Error(`Bronbestand ontbreekt: ${bestand}`);
  const bron = JSON.parse(fs.readFileSync(bestand, "utf8")) as {
    bron: string; opgehaald: string;
    records: {
      stamnummer: string; naam: string; soort: string; rechtsvorm: string;
      straat: string; postcode: string; gemeente: string; provincie: string;
      telefoon: string; email: string; website: string; domein: string; profiel_url: string;
    }[];
  };
  const db = getDb();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO architecten
     (stamnummer,naam,soort,rechtsvorm,straat,postcode,gemeente,provincie,telefoon,email,website,domein,profiel_url,bron_datum)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  db.transaction(() => {
    for (const r of bron.records) {
      ins.run(
        r.stamnummer, r.naam, r.soort, r.rechtsvorm, r.straat, r.postcode, r.gemeente,
        r.provincie, r.telefoon, r.email, r.website, r.domein, r.profiel_url, bron.opgehaald
      );
    }
  })();

  // De bureaunaam is de naam die het vaakst bij dat domein hoort, en bij gelijk
  // spel die van een vennootschap: op info@bureau.be staan vaak drie vennoten en
  // één vennootschap, en dan is de vennootschap de naam die iemand herkent.
  const perDomein = db.prepare(
    `SELECT a.domein,
            COUNT(*) n,
            SUM(CASE WHEN a.website <> '' THEN 1 ELSE 0 END) met_site,
            SUM(CASE WHEN a.soort = 'vennootschap' THEN 1 ELSE 0 END) vennootschappen,
            COALESCE(
              (SELECT b.naam FROM architecten b
                WHERE b.domein = a.domein AND b.naam <> ''
                ORDER BY CASE WHEN b.soort = 'vennootschap' THEN 0 ELSE 1 END, b.naam LIMIT 1),
              ''
            ) naam,
            (SELECT p.provincie FROM architecten p
              WHERE p.domein = a.domein AND p.provincie <> ''
              GROUP BY p.provincie ORDER BY COUNT(*) DESC LIMIT 1) provincie,
            (SELECT g.gemeente FROM architecten g
              WHERE g.domein = a.domein AND g.gemeente <> ''
              GROUP BY g.gemeente ORDER BY COUNT(*) DESC LIMIT 1) gemeente
     FROM architecten a WHERE a.domein <> '' GROUP BY a.domein`
  ).all() as {
    domein: string; n: number; met_site: number; vennootschappen: number;
    naam: string; provincie: string; gemeente: string;
  }[];

  // Onze eigen domeinen mogen nooit als concurrent binnenkomen; H-Architects
  // staat zelf in dit register.
  const onze = new Set(EIGEN_DOMEINEN.map((e) => e.domein));

  const upsert = db.prepare(
    `INSERT INTO concurrenten (domein,naam,bron,volgen,categorie,architecten,provincie,gemeente,eerste_zien)
     VALUES (?,?,'register',?,?,?,?,?,?)
     ON CONFLICT(domein) DO UPDATE SET
       architecten = excluded.architecten,
       volgen = MAX(concurrenten.volgen, excluded.volgen),
       naam = COALESCE(NULLIF(concurrenten.naam,''), excluded.naam),
       provincie = COALESCE(NULLIF(concurrenten.provincie,''), excluded.provincie),
       gemeente = COALESCE(NULLIF(concurrenten.gemeente,''), excluded.gemeente)`
  );
  const nu = vandaag();
  let gevolgd = 0;
  let alleen_register = 0;
  db.transaction(() => {
    for (const d of perDomein) {
      if (onze.has(d.domein)) continue;
      const categorie = d.n >= 2 ? "concurrent" : "prospect";
      const naam = d.naam || d.domein.replace(/^www\./, "").replace(/\.(be|com|eu|nl)$/, "");
      // Dit register is vijf keer zo groot als dat van VEKA. Alles dagelijks
      // meten zou de hele crawl vertragen zonder dat het iets oplevert, dus we
      // volgen wat een zichtbare speler is: wie zelf een website opgeeft, of
      // wie met meerdere inschrijvingen op één domein zit. De rest is een
      // domein dat we uit een e-mailadres afleidden en waarvan we niet weten of
      // er een site achter zit; die staat wél in het register en in de
      // marktlijst, maar wordt niet gecrawld tot iemand hem aanzet.
      const volgen = d.met_site > 0 || d.n >= 2 ? 1 : 0;
      upsert.run(d.domein, naam, volgen, categorie, d.n, d.provincie || "", d.gemeente || "", nu);
      markeerMarkt(d.domein, "architectuur", "register");
      if (volgen) gevolgd++; else alleen_register++;
    }
  })();

  const eigen = registreerEigenDomeinen();

  return {
    inschrijvingen: bron.records.length,
    zonderDomein: bron.records.filter((r) => !r.domein).length,
    domeinen: perDomein.length,
    gevolgd,
    alleen_register,
    eigen,
    bron: bron.bron,
  };
}

/**
 * Leidt blog_artikels, epb_paginas en spam_verdacht opnieuw af uit de al opgeslagen
 * URL's. Nodig na een aanscherping van de classificatie: geen enkele site hoeft
 * daarvoor opnieuw bezocht te worden.
 */
export function herberekenAfleidingen() {
  const db = getDb();
  const domeinen = db.prepare("SELECT DISTINCT domein FROM site_urls").all() as { domein: string }[];
  const upd = db.prepare(
    `UPDATE site_snapshots
        SET blog_artikels = ?, epb_paginas = ?, eng_paginas = ?, arch_paginas = ?, reg_paginas = ?, spam_verdacht = ?,
            laatste_blog = ?, laatste_blog_url = ?
      WHERE domein = ? AND datum = (SELECT MAX(datum) FROM site_snapshots WHERE domein = ?)`
  );
  const updUrl = db.prepare(
    "UPDATE site_urls SET artikel = ?, markt_eng = ?, markt_arch = ?, markt_reg = ? WHERE domein = ? AND url = ?"
  );
  let n = 0;
  db.transaction(() => {
    for (const d of domeinen) {
      const urls = db.prepare("SELECT url, lastmod, sitemap_bron FROM site_urls WHERE domein = ?").all(d.domein) as
        { url: string; lastmod: string; sitemap_bron: string }[];
      const ingedeeld = urls.map((u) => classificeer(u.url, u.lastmod || "", u.sitemap_bron || ""));
      const artikels = ingedeeld.filter((u) => u.soort === "blog" && !u.archief && !u.spam);
      for (const u of ingedeeld) {
        updUrl.run(
          u.soort === "blog" && !u.archief && !u.spam ? 1 : 0,
          u.eng && !u.spam ? 1 : 0,
          u.arch && !u.spam ? 1 : 0,
          u.reg && !u.spam ? 1 : 0,
          d.domein, u.url
        );
      }
      const metDatum = artikels.filter((a) => a.lastmod).sort((a, b) => a.lastmod.localeCompare(b.lastmod));
      const nieuwste = metDatum[metDatum.length - 1];
      upd.run(
        artikels.length,
        ingedeeld.filter((u) => u.epb && !u.spam).length,
        ingedeeld.filter((u) => u.eng && !u.spam).length,
        ingedeeld.filter((u) => u.arch && !u.spam).length,
        ingedeeld.filter((u) => u.reg && !u.spam).length,
        ingedeeld.filter((u) => u.spam).length,
        nieuwste?.lastmod || "",
        nieuwste?.url || "",
        d.domein, d.domein
      );
      n++;
    }
  })();
  // De marktindeling hangt aan deze cijfers, dus meteen mee bijwerken.
  const markten = bepaalMarkten();
  return { herberekend: n, markten };
}

export function teCrawlenDomeinen(limiet?: number): string[] {
  const db = getDb();
  const rijen = db.prepare(
    `SELECT domein FROM concurrenten
     WHERE volgen = 1
     ORDER BY COALESCE(laatste_check,'') ASC, verslaggevers DESC
     ${limiet ? "LIMIT " + Number(limiet) : ""}`
  ).all() as { domein: string }[];
  return rijen.map((r) => r.domein);
}
