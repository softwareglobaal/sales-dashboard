// Kanalen per dienst (spec §17): websites en Google Ads, als korte stand.
// De volledige analyse blijft op /websites en /seo-sea; dit is de samenvatting
// die op elke dienstpagina staat, met een doorklik die al gefilterd is.

import { getDb } from "./db";
import { meetDb, siteVan } from "./websitesMeting";
import type { Afdeling } from "./afdelingen";

// ---------- websites ----------

export type SeoPunt = { naam: string; ok: boolean };
export type WebsiteStand = {
  sleutel: string;
  naam: string;
  url: string;
  live: boolean;
  paden: string[];
  aangepast: string | null; // JJJJ-MM-DD
  aangepastBron: "server" | "sitemap" | null;
  seo: SeoPunt[] | null; // null = nog niet gecrawld
  seoGemeten: string | null;
  bezoekers30: number | null; // null = geen meting op deze site
  contact30: number | null;
};

const HEAD_CACHE = new Map<string, { t: number; waarde: string | null }>();
const ZES_UUR = 6 * 3600 * 1000;

/**
 * Wanneer is de site laatst gewijzigd? Onze statische sites geven in de
 * Last-Modified-kop de tijd van de laatste publicatie; dat is exacter dan de
 * sitemap (daar staat bij de meeste pagina's geen lastmod).
 */
async function laatstGewijzigd(url: string): Promise<string | null> {
  const c = HEAD_CACHE.get(url);
  if (c && Date.now() - c.t < ZES_UUR) return c.waarde;
  let waarde: string | null = null;
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
    const lm = r.headers.get("last-modified");
    if (lm && !isNaN(Date.parse(lm))) waarde = new Date(lm).toISOString().slice(0, 10);
  } catch {
    waarde = null;
  }
  HEAD_CACHE.set(url, { t: Date.now(), waarde });
  return waarde;
}

function domeinVan(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** De SEO-basis uit de laatste crawl van de concurrentiemonitor (die meet ook onze eigen sites). */
function seoUitCrawl(domein: string, paden: string[]): { punten: SeoPunt[]; datum: string } | null {
  const db = getDb();
  const s = db
    .prepare("SELECT * FROM site_snapshots WHERE domein = ? AND bereikbaar = 1 ORDER BY datum DESC LIMIT 1")
    .get(domein) as any;
  if (!s) return null;
  const punten: SeoPunt[] = [
    { naam: "Titel", ok: !!s.titel },
    { naam: "Metabeschrijving", ok: !!s.meta_desc },
    { naam: "Schema", ok: !!s.heeft_schema },
    { naam: "LocalBusiness", ok: !!s.heeft_localbiz },
    { naam: "Sitemap", ok: !!s.heeft_sitemap },
  ];
  if (paden.length) {
    // Heeft de site pagina's voor deze dienst in de sitemap?
    const like = paden.map(() => "lower(url) LIKE ?").join(" OR ");
    const n = (db
      .prepare(`SELECT COUNT(*) n FROM site_urls WHERE domein = ? AND (${like})`)
      .get(domein, ...paden.map((p) => `%${p.toLowerCase()}%`)) as any)?.n || 0;
    punten.push({ naam: `Dienstpagina's (${n})`, ok: n > 0 });
  }
  return { punten, datum: s.datum };
}

function verkeer30(sleutel: string, paden: string[]): { bezoekers: number; contact: number } | null {
  try {
    const db = meetDb();
    if (!db.prepare("SELECT 1 FROM sessies WHERE site = ? LIMIT 1").get(sleutel)) return null;
    const van = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    // Met paden: sessies die minstens één pagina van deze dienst bekeken.
    const extra = paden.length
      ? ` AND id IN (SELECT sessie FROM weergaven WHERE site = ? AND dag >= ? AND (${paden.map(() => "lower(pad) LIKE ?").join(" OR ")}))`
      : "";
    const args: unknown[] = [sleutel, van];
    if (paden.length) args.push(sleutel, van, ...paden.map((p) => `%${p.toLowerCase()}%`));
    const r = db
      .prepare(`SELECT COUNT(DISTINCT bezoeker) b, SUM(CASE WHEN conversies > 0 THEN 1 ELSE 0 END) c FROM sessies WHERE site = ? AND dag >= ?${extra}`)
      .get(...args) as any;
    return { bezoekers: r?.b || 0, contact: r?.c || 0 };
  } catch {
    return null;
  }
}

export async function websites(a: Afdeling): Promise<WebsiteStand[]> {
  return Promise.all(
    a.kanalen.websites.map(async (w) => {
      const s = siteVan(w.site);
      const url = s?.url || `https://${w.site}`;
      const domein = domeinVan(url);
      const paden = w.paden || [];
      const seo = seoUitCrawl(domein, paden);
      let aangepast = await laatstGewijzigd(url);
      let bron: WebsiteStand["aangepastBron"] = aangepast ? "server" : null;
      if (!aangepast) {
        const r = getDb().prepare("SELECT MAX(lastmod) m FROM site_urls WHERE domein = ?").get(domein) as any;
        if (r?.m) {
          aangepast = String(r.m).slice(0, 10);
          bron = "sitemap";
        }
      }
      const v = verkeer30(w.site, paden);
      return {
        sleutel: w.site,
        naam: s?.naam || w.site,
        url,
        live: s?.live ?? false,
        paden,
        aangepast,
        aangepastBron: bron,
        seo: seo?.punten || null,
        seoGemeten: seo?.datum || null,
        bezoekers30: v?.bezoekers ?? null,
        contact30: v?.contact ?? null,
      };
    })
  );
}

/** Link naar de tab Websites, gefilterd op de sites van deze dienst. */
export function websitesLink(a: Afdeling, site?: string): string {
  const sites = site ? [site] : [...new Set(a.kanalen.websites.map((w) => w.site))];
  return `/websites?site=${encodeURIComponent(sites.join(","))}&dienst=${a.pad}`;
}

// ---------- Google Ads ----------

export type Campagne = {
  account: string;
  id: string;
  naam: string;
  status: string; // ENABLED / PAUSED / REMOVED
  kost: number; // dit jaar
  klikken: number;
  conversies: number;
  laatsteDag: string | null; // laatste dag met kosten
};

export function campagnes(a: Afdeling): Campagne[] {
  if (!a.kanalen.ads.length) return [];
  const db = getDb();
  const jaar = `${new Date().getFullYear()}-01-01`;
  const rijen = db
    .prepare(
      `SELECT c.account_key, c.campaign_id, c.name, c.status,
              COALESCE(SUM(CASE WHEN m.date >= ? THEN m.cost_micros END), 0) / 1e6 AS kost,
              COALESCE(SUM(CASE WHEN m.date >= ? THEN m.clicks END), 0) AS klikken,
              COALESCE(SUM(CASE WHEN m.date >= ? THEN m.conversions END), 0) AS conversies,
              MAX(CASE WHEN m.cost_micros > 0 THEN m.date END) AS laatste
       FROM ad_campaigns c
       LEFT JOIN ad_metrics_daily m ON m.account_key = c.account_key AND m.campaign_id = c.campaign_id
       WHERE c.service_key IN (${a.kanalen.ads.map(() => "?").join(",")}) AND c.status != 'REMOVED'
       GROUP BY c.account_key, c.campaign_id
       ORDER BY (c.status = 'ENABLED') DESC, kost DESC`
    )
    .all(jaar, jaar, jaar, ...a.kanalen.ads) as any[];
  return rijen.map((r) => ({
    account: r.account_key,
    id: r.campaign_id,
    naam: r.name,
    status: r.status,
    kost: Math.round(r.kost),
    klikken: r.klikken,
    conversies: Math.round(r.conversies),
    laatsteDag: r.laatste,
  }));
}

export const seoLink = (a: Afdeling) => `/seo-sea?dienst=${a.pad}`;
