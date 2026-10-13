// Concurrentie voor eigen sites zonder dienst (bv. angela.sr, Suriname): getoond op de
// tab Websites als die ene site gekozen is. Config: config/concurrentie-sites.json.
//
// Hergebruikt de crawl van de concurrentiemonitor (sitemap + homepage, marktloos, in
// site_snapshots en site_urls), maar staat los van de vier Belgische markten: deze
// domeinen komen niet in de tabel `concurrenten`, dus ze tellen nergens anders mee.
// Posities in Google vragen zoektegoed; zonder tegoed toont de pagina de nulmeting uit
// het onderzoek, met de bron erbij.

import cfg from "@/config/concurrentie-sites.json";
import { getDb } from "./db";
import { crawlDomeinen } from "./concurrentie";

export type SiteConcurrent = { domein: string; naam: string; onderdelen: string[]; omschrijving: string; website?: boolean };
export type SiteConcurrentieCfg = {
  markt: string;
  eigenDomein: string;
  onderzoek: { datum: string; pad: string; noot: string };
  onderdelen: Record<string, string>;
  concurrenten: SiteConcurrent[];
  zoektermen: { bron: string; termen: { term: string; onderdeel: string; top5: string[] }[] };
  content?: { firma: string; woorden: string[]; maxBlogs: number };
};

const ALLE = cfg as unknown as Record<string, SiteConcurrentieCfg | string>;

export function siteConcurrentie(site: string): SiteConcurrentieCfg | null {
  const c = ALLE[site];
  return c && typeof c === "object" ? c : null;
}

export function sitesMetConcurrentie(): { site: string; cfg: SiteConcurrentieCfg }[] {
  return Object.entries(ALLE)
    .filter(([k, v]) => !k.startsWith("_") && typeof v === "object")
    .map(([site, v]) => ({ site, cfg: v as SiteConcurrentieCfg }));
}

/** Te crawlen domeinen: eigen site + alle concurrenten met een website. */
export function crawlbaar(c: SiteConcurrentieCfg): string[] {
  return [c.eigenDomein, ...c.concurrenten.filter((x) => x.website !== false).map((x) => x.domein)];
}

export async function crawlSite(site: string) {
  const c = siteConcurrentie(site);
  if (!c) throw new Error(`geen concurrentieconfig voor ${site}`);
  return crawlDomeinen(crawlbaar(c));
}

export type ConcurrentStand = SiteConcurrent & {
  eigen: boolean;
  gemeten: string | null; // datum laatste crawl
  bereikbaar: boolean | null;
  fout: string | null;
  sitemap: boolean;
  paginas: number | null; // null = geen sitemap: onbekend, niet nul
  afgekapt: boolean; // de crawl leest maximaal 3000 URL's
  artikels: number | null;
  laatsteArtikel: string | null;
  laatsteArtikelUrl: string | null;
  nieuw30: number | null; // nieuwe URL's in 30 dagen (null = nog geen tweede meting)
  groei: number | null; // pagina's t.o.v. de meting van ongeveer een maand eerder
};

const DERTIG_DAGEN = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export function stand(c: SiteConcurrentieCfg): ConcurrentStand[] {
  const db = getDb();
  const laatste = db.prepare("SELECT * FROM site_snapshots WHERE domein = ? ORDER BY datum DESC LIMIT 1");
  const eerste = db.prepare("SELECT MIN(datum) d FROM site_snapshots WHERE domein = ?");
  const maandTerug = db.prepare("SELECT paginas FROM site_snapshots WHERE domein = ? AND datum <= ? AND heeft_sitemap = 1 ORDER BY datum DESC LIMIT 1");
  const nieuw = db.prepare("SELECT COUNT(*) n FROM site_urls WHERE domein = ? AND eerste_zien >= ? AND eerste_zien > ?");
  const vanaf = DERTIG_DAGEN();
  const eigen: SiteConcurrent = { domein: c.eigenDomein, naam: c.eigenDomein, onderdelen: Object.keys(c.onderdelen), omschrijving: "Onze site" };
  return [eigen, ...c.concurrenten].map((x) => {
    const isEigen = x.domein === c.eigenDomein;
    if (x.website === false) {
      return { ...x, eigen: false, gemeten: null, bereikbaar: null, fout: null, sitemap: false, paginas: null, afgekapt: false, artikels: null, laatsteArtikel: null, laatsteArtikelUrl: null, nieuw30: null, groei: null };
    }
    const s = laatste.get(x.domein) as any;
    const start = (eerste.get(x.domein) as any)?.d as string | null;
    const oud = s ? (maandTerug.get(x.domein, vanaf) as any) : null;
    // De eerste crawl ziet alles als "nieuw"; tel pas wat erna verscheen.
    const n = s && start && start < s.datum ? ((nieuw.get(x.domein, vanaf, start) as any)?.n ?? 0) : null;
    const paginas = s?.heeft_sitemap ? s.paginas : null;
    return {
      ...x,
      eigen: isEigen,
      gemeten: s?.datum ?? null,
      bereikbaar: s ? !!s.bereikbaar : null,
      fout: s?.fout || null,
      sitemap: !!s?.heeft_sitemap,
      paginas,
      afgekapt: (paginas ?? 0) >= 3000,
      artikels: s?.heeft_sitemap ? s.blog_artikels ?? null : null,
      laatsteArtikel: s?.laatste_blog || null,
      laatsteArtikelUrl: s?.laatste_blog_url || null,
      nieuw30: n,
      groei: paginas != null && oud?.paginas != null ? paginas - oud.paginas : null,
    };
  });
}

/** Nieuwe artikels van concurrenten (laatste 21 dagen) die over ons terrein gaan: voeding voor de SEO-agents. */
export function nieuweArtikels(c: SiteConcurrentieCfg, dagen = 21): { domein: string; naam: string; url: string; datum: string }[] {
  if (!c.content) return [];
  const db = getDb();
  const domeinen = c.concurrenten.filter((x) => x.website !== false).map((x) => x.domein);
  if (!domeinen.length) return [];
  const vanaf = new Date(Date.now() - dagen * 86400000).toISOString().slice(0, 10);
  const like = c.content.woorden.map(() => "lower(url) LIKE ?").join(" OR ");
  const rijen = db
    .prepare(
      `SELECT domein, url, datum FROM signalen
       WHERE soort = 'nieuwe-blog' AND datum >= ? AND domein IN (${domeinen.map(() => "?").join(",")}) AND (${like})
       ORDER BY datum DESC, id DESC LIMIT ?`
    )
    .all(vanaf, ...domeinen, ...c.content.woorden.map((w) => `%${w}%`), c.content.maxBlogs) as any[];
  const naam = new Map(c.concurrenten.map((x) => [x.domein, x.naam]));
  return rijen.map((r) => ({ domein: r.domein, naam: naam.get(r.domein) || r.domein, url: r.url, datum: r.datum }));
}
