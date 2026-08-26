/**
 * Zoekwoorden en posities voor de EPB-markt.
 *
 * Twee bronnen, bewust gescheiden:
 *  - Zoekvolume komt van Google Ads (Keyword Planner). Die koppeling bestaat al
 *    voor de advertentiesync, dus dit vraagt geen nieuwe credential.
 *  - Posities komen van een SERP-bron. Die is er nog niet: Google zelf uitlezen
 *    is geen optie (dat is precies wat hun blokkades tegenhouden), dus dit loopt
 *    via een betaalde API. Tot die gekoppeld is blijft de positiekolom leeg —
 *    liever leeg dan een geraden getal waarop iemand beslissingen neemt.
 */

import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { ADS_ACCOUNTS } from "./googleAdsConfig";

export type ZoekwoordBron = {
  locatie: { land: string; taal: string; geoTargetConstant: string };
  zoekwoorden: { term: string; thema: string; intentie: string }[];
};

export function leesZoekwoordenConfig(): ZoekwoordBron {
  const bestand = path.join(process.cwd(), "config", "zoekwoorden-energie.json");
  return JSON.parse(fs.readFileSync(bestand, "utf8")) as ZoekwoordBron;
}

/** Zet de zoekwoorden uit de config in de database. Volumes blijven staan. */
export function importeerZoekwoorden() {
  const cfg = leesZoekwoordenConfig();
  const db = getDb();
  const ins = db.prepare(
    `INSERT INTO zoekwoorden (term, thema, intentie)
     VALUES (?,?,?)
     ON CONFLICT(term) DO UPDATE SET thema = excluded.thema, intentie = excluded.intentie`
  );
  db.transaction(() => {
    for (const z of cfg.zoekwoorden) ins.run(z.term, z.thema, z.intentie);
  })();
  return { zoekwoorden: cfg.zoekwoorden.length };
}

// ---------------------------------------------------------------------------
// Zoekvolume via Google Ads Keyword Planner
// ---------------------------------------------------------------------------

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v23";

async function adsToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth: ${json.error || res.status} ${json.error_description || ""}`.trim());
  }
  return json.access_token as string;
}

/**
 * Welk Google Ads-account gebruiken we voor Keyword Planner?
 * GOOGLE_ADS_LOGIN_CUSTOMER_ID is leeg op de server -- de advertentiesync draait
 * op het klantnummer uit config/ads.json. Daar vallen we dus op terug, anders
 * lijkt de koppeling te ontbreken terwijl ze gewoon werkt.
 */
function keywordKlantnummer(): string {
  const uit =
    process.env.GOOGLE_ADS_KEYWORD_CUSTOMER_ID ||
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ||
    ADS_ACCOUNTS[0]?.customerId ||
    "";
  return uit.replace(/[^0-9]/g, "");
}

export function adsBeschikbaar(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      keywordKlantnummer()
  );
}

/**
 * Haalt het historische maandvolume op voor alle zoekwoorden in één call.
 * Keyword Planner geeft afgeronde gemiddelden — dat is de bedoeling, het gaat
 * om de verhouding tussen termen, niet om exacte bezoekersaantallen.
 */
export async function haalZoekvolumes() {
  if (!adsBeschikbaar()) {
    return { ok: false, reden: "Google Ads-credentials ontbreken" };
  }
  const cfg = leesZoekwoordenConfig();
  const klant = keywordKlantnummer();
  const token = await adsToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  };
  const login = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/[^0-9]/g, "");
  if (login) headers["login-customer-id"] = login;

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${klant}:generateKeywordHistoricalMetrics`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        keywords: cfg.zoekwoorden.map((z) => z.term),
        geoTargetConstants: [`geoTargetConstants/${cfg.locatie.geoTargetConstant}`],
        language: "languageConstants/1043", // Nederlands
        keywordPlanNetwork: "GOOGLE_SEARCH",
      }),
      cache: "no-store",
    }
  );

  const tekst = await res.text();
  if (!res.ok) {
    // Een ingetrokken API-versie geeft HTML in plaats van JSON. Zie de waarschuwing
    // in lib/googleAds.ts: dat heeft de advertentiesync al eens stil doen vallen.
    const kort = tekst.slice(0, 300).replace(/\s+/g, " ");
    return { ok: false, reden: `Google Ads antwoordde ${res.status}: ${kort}` };
  }

  const json = JSON.parse(tekst);
  const db = getDb();
  // Google geeft de term terug in kleine letters ("epb verslaggeving") terwijl
  // onze lijst hoofdletters gebruikt. Bij een exacte vergelijking werd daardoor
  // maar een kwart van de termen bijgewerkt.
  const upd = db.prepare(
    `UPDATE zoekwoorden SET volume = ?, concurrentie = ?, cpc_laag = ?, cpc_hoog = ?,
                            volume_bron = 'google-ads', volume_datum = ?
     WHERE lower(term) = lower(?)`
  );
  const datum = new Date().toISOString().slice(0, 10);
  let bijgewerkt = 0;
  db.transaction(() => {
    for (const r of json.results || []) {
      const m = r.keywordMetrics || {};
      const micro = (v: unknown) => (v ? Number(v) / 1_000_000 : null);
      const res2 = upd.run(
        m.avgMonthlySearches ? Number(m.avgMonthlySearches) : null,
        m.competition || null,
        micro(m.lowTopOfPageBidMicros),
        micro(m.highTopOfPageBidMicros),
        datum,
        r.text
      );
      if (res2.changes) bijgewerkt++;
    }
  })();
  return { ok: true, bijgewerkt, opgehaald: (json.results || []).length };
}

// ---------------------------------------------------------------------------
// Posities via een SERP-bron
// ---------------------------------------------------------------------------

export function serpBron(): { naam: string; klaar: boolean; reden?: string } {
  // SerpApi eerst: die heeft een gratis maandquotum dat voor onze lijst volstaat.
  if (process.env.SERPAPI_KEY) return { naam: "SerpApi", klaar: true };
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return { naam: "DataForSEO", klaar: true };
  }
  return {
    naam: "geen",
    klaar: false,
    reden:
      "Geen SERP-bron gekoppeld. Zet SERPAPI_KEY (gratis quotum volstaat voor deze lijst) " +
      "of DATAFORSEO_LOGIN en DATAFORSEO_PASSWORD in .env.",
  };
}

type SerpRij = { soort: "organisch" | "advertentie"; positie: number; domein: string; url: string };

/** Eén zoekopdracht bij SerpApi, Google België / Nederlands. */
async function serpSerpApi(term: string): Promise<SerpRij[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: term,
    google_domain: "google.be",
    gl: "be",
    hl: "nl",
    num: "20",
    api_key: process.env.SERPAPI_KEY || "",
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi: ${json.error}`);

  const uit: SerpRij[] = [];
  const domeinVan = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };

  for (const r of json.organic_results || []) {
    const d = domeinVan(r.link || "");
    if (d) uit.push({ soort: "organisch", positie: r.position, domein: d, url: r.link || "" });
  }
  // SerpApi geeft advertenties zonder eigen rangnummer; we tellen ze in volgorde.
  let advertentie = 0;
  for (const a of json.ads || []) {
    const d = domeinVan(a.link || a.tracking_link || "");
    if (d) uit.push({ soort: "advertentie", positie: ++advertentie, domein: d, url: a.link || "" });
  }
  return uit;
}

/** Eén zoekopdracht bij DataForSEO, Google BE / Nederlands, desktop. */
async function serpDataForSeo(term: string): Promise<SerpRij[]> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString("base64");

  const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        keyword: term,
        location_code: 2056, // België
        language_code: "nl",
        device: "desktop",
        depth: 30,
      },
    ]),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO: ${json.status_code} ${json.status_message}`);
  }
  const items = json.tasks?.[0]?.result?.[0]?.items || [];
  const uit: SerpRij[] = [];
  for (const it of items) {
    if (!it.domain) continue;
    if (it.type === "organic") {
      uit.push({ soort: "organisch", positie: it.rank_absolute, domein: it.domain, url: it.url || "" });
    } else if (it.type === "paid") {
      uit.push({ soort: "advertentie", positie: it.rank_absolute, domein: it.domain, url: it.url || "" });
    }
  }
  return uit;
}

/**
 * Meet de posities voor alle zoekwoorden en bewaart per domein dat we volgen.
 * We slaan alleen op wat over onze markt gaat; de rest van de SERP bewaren we niet.
 */
export async function meetPosities(limiet?: number) {
  const bron = serpBron();
  if (!bron.klaar) return { ok: false, reden: bron.reden };

  const db = getDb();
  const termen = db
    .prepare(`SELECT term FROM zoekwoorden ORDER BY COALESCE(volume,0) DESC ${limiet ? "LIMIT " + Number(limiet) : ""}`)
    .all() as { term: string }[];

  const gevolgd = new Set(
    (db.prepare("SELECT domein FROM concurrenten").all() as { domein: string }[]).map((r) => r.domein)
  );

  const datum = new Date().toISOString().slice(0, 10);
  const ins = db.prepare(
    `INSERT OR REPLACE INTO posities (term, domein, datum, soort, positie, url, bron)
     VALUES (?,?,?,?,?,?,?)`
  );

  let gemeten = 0;
  let opgeslagen = 0;
  const ontdekt = new Set<string>();
  const fouten: { term: string; fout: string }[] = [];

  for (const t of termen) {
    try {
      const rijen = bron.naam === "SerpApi" ? await serpSerpApi(t.term) : await serpDataForSeo(t.term);
      gemeten++;
      db.transaction(() => {
        for (const r of rijen) {
          const kaal = r.domein.replace(/^www\./, "");
          const volgenWij = gevolgd.has(kaal) || gevolgd.has(r.domein);
          // De hele top 10 bewaren we altijd — dat is het leaderboard, en het is
          // meteen de manier waarop we spelers vinden die niet in het register staan.
          // Daarbuiten alleen onze eigen sites en bekende concurrenten.
          if (r.positie > 10 && !volgenWij) continue;
          ins.run(t.term, kaal, datum, r.soort, r.positie, r.url, bron.naam);
          opgeslagen++;
          if (!volgenWij && r.soort === "organisch" && r.positie <= 10) ontdekt.add(kaal);
        }
      })();
    } catch (e) {
      fouten.push({ term: t.term, fout: String((e as Error)?.message || e) });
    }
  }
  // Nieuw ontdekte domeinen in de top 10 als concurrent registreren, zodat de
  // crawler ze vanaf de volgende ronde meeneemt.
  const nu = new Date().toISOString();
  const insDom = db.prepare(
    `INSERT INTO concurrenten (domein,naam,bron,volgen,categorie,verslaggevers,eerste_zien)
     VALUES (?,?,'serp',1,'concurrent',0,?)
     ON CONFLICT(domein) DO NOTHING`
  );
  let nieuw = 0;
  db.transaction(() => {
    for (const d of ontdekt) {
      if (gevolgd.has(d)) continue;
      insDom.run(d, d.replace(/\.(be|com|eu|nl)$/, ""), nu);
      nieuw++;
    }
  })();

  return { ok: true, bron: bron.naam, gemeten, opgeslagen, nieuweDomeinen: nieuw, fouten };
}
