// Websitemeting: opslag en inname (spec §15).
//
// Eigen, lichte meting in plaats van Matomo/PostHog/Umami: die vragen een eigen
// database of container, en de server heeft daar geen ruimte voor. Alles leeft in
// een apart SQLite-bestand (data/websites.db), los van dashboard.db, zodat een
// drukke site de Pipedrive-sync nooit op een schrijfslot laat wachten.
//
// Privacy: geen cookies, geen opslag op het toestel van de bezoeker. Een bezoeker
// wordt herkend via een hash van (maandzout + site + IP + browser). Het zout wordt na
// de maand weggegooid, dus de hash is daarna niet meer terug te rekenen. Het IP-adres
// zelf wordt nergens bewaard; het dient enkel om de locatie op te zoeken.

import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import websitesConfig from "@/config/websites.json";
import { zoekGeo } from "@/lib/geoip";
import { POSTCODE_COORDS } from "@/lib/postcodeCoords";
import { postcodeToProvince } from "@/lib/regio";

export type Site = {
  sleutel: string;
  naam: string;
  url: string;
  domeinen: string[];
  firma: string;
  kleur: string;
  live: boolean;
};

export const SITES: Site[] = websitesConfig.sites;
export const siteVan = (sleutel: string) => SITES.find((s) => s.sleutel === sleutel);

// Lokaal testen: in ontwikkeling telt localhost als domein van elke site.
const LOKAAL = process.env.NODE_ENV !== "production" ? ["localhost", "127.0.0.1"] : [];
const eigenDomein = (site: Site, host: string) => site.domeinen.includes(host) || LOKAAL.includes(host);

const SESSIE_PAUZE_MS = 30 * 60 * 1000;
const BEWAARTERMIJN_DAGEN = 400;

let _db: Database.Database | null = null;

export function meetDb(): Database.Database {
  if (_db) return _db;
  const map = path.join(process.cwd(), "data");
  fs.mkdirSync(map, { recursive: true });
  _db = new Database(path.join(map, "websites.db"));
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS zout (maand TEXT PRIMARY KEY, waarde TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS sessies (
      id TEXT PRIMARY KEY,
      site TEXT NOT NULL,
      bezoeker TEXT NOT NULL,
      start INTEGER NOT NULL,        -- ms sinds epoch (UTC)
      laatst INTEGER NOT NULL,
      dag TEXT NOT NULL,             -- YYYY-MM-DD, Belgische tijd
      uur INTEGER, weekdag INTEGER,  -- Belgische tijd; weekdag 1 = maandag
      instap TEXT, uitstap TEXT,
      kanaal TEXT, bron TEXT, campagne TEXT, verwijzer TEXT,
      land TEXT, regio TEXT, provincie TEXT, stad TEXT, lat REAL, lon REAL,
      apparaat TEXT, browser TEXT, os TEXT, taal TEXT, scherm INTEGER,
      paginas INTEGER NOT NULL DEFAULT 0,
      actief_ms INTEGER NOT NULL DEFAULT 0,
      conversies INTEGER NOT NULL DEFAULT 0,
      terugkerend INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ses_site_dag ON sessies(site, dag);
    CREATE INDEX IF NOT EXISTS idx_ses_bezoeker ON sessies(site, bezoeker, laatst);

    CREATE TABLE IF NOT EXISTS weergaven (
      id TEXT PRIMARY KEY,
      sessie TEXT NOT NULL,
      site TEXT NOT NULL,
      ts INTEGER NOT NULL,
      dag TEXT NOT NULL,
      pad TEXT NOT NULL,
      titel TEXT,
      vorig TEXT,                    -- vorige pagina in dezelfde sessie
      volgnr INTEGER NOT NULL,
      actief_ms INTEGER NOT NULL DEFAULT 0,
      scroll INTEGER NOT NULL DEFAULT 0,
      doc_h INTEGER,
      vw INTEGER,
      lcp INTEGER, cls REAL, inp INTEGER, ttfb INTEGER, laad INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_wg_site_dag ON weergaven(site, dag);
    CREATE INDEX IF NOT EXISTS idx_wg_sessie ON weergaven(sessie);

    CREATE TABLE IF NOT EXISTS klikken (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weergave TEXT NOT NULL,
      site TEXT NOT NULL,
      dag TEXT NOT NULL,
      pad TEXT NOT NULL,
      soort TEXT NOT NULL,           -- link, uitgaand, tel, mail, whatsapp, download, knop, formulier, overig
      tekst TEXT, doel TEXT, element TEXT,
      x INTEGER, y INTEGER, doc_h INTEGER, vw INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_kl_site_dag ON klikken(site, dag);

    CREATE TABLE IF NOT EXISTS secties (
      weergave TEXT NOT NULL,
      site TEXT NOT NULL,
      dag TEXT NOT NULL,
      pad TEXT NOT NULL,
      naam TEXT NOT NULL,
      volgorde INTEGER,
      ms INTEGER NOT NULL DEFAULT 0,
      y INTEGER, h INTEGER, doc_h INTEGER,
      PRIMARY KEY (weergave, naam)
    );
    CREATE INDEX IF NOT EXISTS idx_sec_site_dag ON secties(site, dag);
  `);
  return _db;
}

// ---------- hulpfuncties ----------

const BELGISCH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false,
});
const WEEKDAG: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function belgischeTijd(ms: number) {
  const d: Record<string, string> = {};
  for (const p of BELGISCH.formatToParts(new Date(ms))) d[p.type] = p.value;
  return { dag: `${d.year}-${d.month}-${d.day}`, uur: Number(d.hour) % 24, weekdag: WEEKDAG[d.weekday] || 0 };
}

function zoutVoor(maand: string): string {
  const db = meetDb();
  const rij = db.prepare("SELECT waarde FROM zout WHERE maand = ?").get(maand) as { waarde: string } | undefined;
  if (rij) return rij.waarde;
  const waarde = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT OR IGNORE INTO zout (maand, waarde) VALUES (?, ?)").run(maand, waarde);
  // Oude zouten weg: daarmee zijn oude bezoekershashes niet meer terug te rekenen.
  db.prepare("DELETE FROM zout WHERE maand < ?").run(maand);
  return (db.prepare("SELECT waarde FROM zout WHERE maand = ?").get(maand) as { waarde: string }).waarde;
}

export function leesUA(ua: string) {
  const u = ua || "";
  const apparaat = /iPad|Tablet|(Android(?!.*Mobile))/i.test(u) ? "tablet" : /Mobi|iPhone|Android/i.test(u) ? "mobiel" : "desktop";
  const browser =
    /Edg\//.test(u) ? "Edge" :
    /SamsungBrowser/.test(u) ? "Samsung Internet" :
    /OPR\/|Opera/.test(u) ? "Opera" :
    /Firefox\/|FxiOS/.test(u) ? "Firefox" :
    /CriOS|Chrome\//.test(u) ? "Chrome" :
    /Safari\//.test(u) ? "Safari" : "Andere";
  const os =
    /iPhone|iPad|iPod/.test(u) ? "iOS" :
    /Android/.test(u) ? "Android" :
    /Windows/.test(u) ? "Windows" :
    /CrOS/.test(u) ? "ChromeOS" :
    /Mac OS X|Macintosh/.test(u) ? "macOS" :
    /Linux/.test(u) ? "Linux" : "Andere";
  return { apparaat, browser, os };
}

const ZOEKMACHINES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/ecosia\.org$/, "Ecosia"],
  [/qwant\.com$/, "Qwant"],
  [/(^|\.)yandex\./, "Yandex"],
];
const AI: [RegExp, string][] = [
  [/chatgpt\.com$|openai\.com$/, "ChatGPT"],
  [/perplexity\.ai$/, "Perplexity"],
  [/copilot\.microsoft\.com$/, "Copilot"],
  [/gemini\.google\.com$/, "Gemini"],
  [/claude\.ai$/, "Claude"],
];
const SOCIAAL: [RegExp, string][] = [
  [/facebook\.com$|fb\.me$/, "Facebook"],
  [/instagram\.com$/, "Instagram"],
  [/linkedin\.com$|lnkd\.in$/, "LinkedIn"],
  [/(^|\.)t\.co$|twitter\.com$|(^|\.)x\.com$/, "X"],
  [/youtube\.com$|youtu\.be$/, "YouTube"],
  [/tiktok\.com$/, "TikTok"],
  [/pinterest\./, "Pinterest"],
  [/whatsapp\.com$|wa\.me$/, "WhatsApp"],
];
const WEBMAIL = /mail\.google\.com$|outlook\.(live|office)\.com$|mail\.yahoo\.com$|telenet\.be$|proximus\.be$/;

/** Kanaal + bron van een sessie, uit UTM-parameters, advertentieklik-id's en de verwijzer. */
export function bepaalKanaal(adres: URL, verwijzer: string | null, eigenHost: string) {
  const p = adres.searchParams;
  const utmBron = p.get("utm_source");
  const utmMedium = (p.get("utm_medium") || "").toLowerCase();
  const campagne = p.get("utm_campaign");
  let host = "";
  try {
    if (verwijzer) host = new URL(verwijzer).hostname.replace(/^www\./, "");
  } catch {}

  if (p.has("gclid") || p.has("gbraid") || p.has("wbraid") || (/google/i.test(utmBron || "") && /cpc|ppc|paid/.test(utmMedium))) {
    return { kanaal: "Google Ads", bron: "google", campagne };
  }
  if (p.has("msclkid")) return { kanaal: "Microsoft Ads", bron: "bing", campagne };
  if (utmBron) {
    const kanaal = /cpc|ppc|paid|display/.test(utmMedium) ? "Betaalde advertentie" :
      /mail|nieuwsbrief|newsletter/.test(utmMedium) ? "E-mail" :
      /social/.test(utmMedium) ? "Sociale media" :
      /qr|print|flyer|offline/.test(utmMedium) ? "QR / drukwerk" : "Campagne";
    return { kanaal, bron: utmBron.toLowerCase(), campagne };
  }
  if (p.has("fbclid")) return { kanaal: "Sociale media", bron: "Facebook", campagne };
  if (!host || host === eigenHost.replace(/^www\./, "")) return { kanaal: "Direct", bron: "(direct)", campagne };
  // Volgorde telt: mail.google.com en gemini.google.com zijn geen zoekverkeer.
  if (WEBMAIL.test(host)) return { kanaal: "E-mail", bron: host, campagne };
  for (const [re, naam] of AI) if (re.test(host)) return { kanaal: "AI-assistent", bron: naam, campagne };
  for (const [re, naam] of ZOEKMACHINES) if (re.test(host)) return { kanaal: "Zoekmachine (organisch)", bron: naam, campagne };
  for (const [re, naam] of SOCIAAL) if (re.test(host)) return { kanaal: "Sociale media", bron: naam, campagne };
  const zus = SITES.find((s) => s.domeinen.some((d) => d.replace(/^www\./, "") === host));
  if (zus) return { kanaal: "Eigen zustersite", bron: zus.naam, campagne };
  return { kanaal: "Verwijzende site", bron: host, campagne };
}

const REGIO_NL: Record<string, string> = {
  Flanders: "Vlaanderen",
  Wallonia: "Wallonië",
  "Brussels Capital": "Brussel",
  "Paramaribo District": "Paramaribo",
  "Wanica District": "Wanica",
};

/** Locatie met Nederlandse regionaam en, voor België, de provincie via de dichtstbijzijnde postcode. */
function locatie(ip: string) {
  const g = zoekGeo(ip);
  if (!g) return null;
  const stad = g.stad ? g.stad.replace(/\s*\(.*\)\s*$/, "") : null;
  let provincie = g.provincie;
  if (g.land === "BE" && g.lat != null && g.lon != null) {
    if (g.regio === "Brussels Capital") provincie = "Brussel";
    else if (g.regio === "Flanders") {
      let beste: string | null = null, afstand = Infinity;
      for (const [pc, [la, lo]] of Object.entries(POSTCODE_COORDS)) {
        const d = (la - g.lat) ** 2 + ((lo - g.lon) * 0.63) ** 2;
        if (d < afstand) { afstand = d; beste = pc; }
      }
      provincie = beste ? postcodeToProvince(beste) : null;
    }
  }
  return { ...g, stad, provincie, regio: g.regio ? REGIO_NL[g.regio] || g.regio : null };
}

// ---------- inname ----------

type Paginaweergave = {
  t: "pv"; s: string; pv: string; u: string; r?: string; ti?: string; sw?: number; vw?: number; l?: string;
};
type Klik = { k: string; tx?: string; d?: string; el?: string; x?: number; y?: number; dh?: number; vw?: number };
type Sectie = { n: string; ms: number; o?: number; y?: number; h?: number; dh?: number };
type Stand = {
  t: "st"; s: string; pv: string; a?: number; sc?: number; dh?: number; c?: Klik[]; sec?: Sectie[];
  v?: { lcp?: number; cls?: number; inp?: number; ttfb?: number; laad?: number };
};

const CONVERSIE = new Set(["tel", "mail", "whatsapp", "formulier"]);
const tekst = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
const geheel = (v: unknown, max = 1e9) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : null);

export function verwerk(data: unknown, ip: string, ua: string, origin: string | null): boolean {
  if (!data || typeof data !== "object") return false;
  const m = data as Paginaweergave | Stand;
  const site = siteVan(String(m.s));
  if (!site || typeof m.pv !== "string" || m.pv.length > 40) return false;
  if (origin) {
    try {
      if (!eigenDomein(site, new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  const db = meetDb();
  const nu = Date.now();

  if (m.t === "pv") {
    let adres: URL;
    try {
      adres = new URL(m.u);
    } catch {
      return false;
    }
    if (!eigenDomein(site, adres.hostname)) return false;
    const { dag, uur, weekdag } = belgischeTijd(nu);
    const maand = dag.slice(0, 7);
    const bezoeker = crypto.createHash("sha256").update(`${zoutVoor(maand)}|${site.sleutel}|${ip}|${ua}`).digest("hex").slice(0, 24);
    let pad = adres.pathname;
    try {
      pad = decodeURI(pad);
    } catch {}
    pad = pad.slice(0, 300) || "/";

    const vorige = db
      .prepare("SELECT id, uitstap, paginas FROM sessies WHERE site = ? AND bezoeker = ? AND laatst > ? ORDER BY laatst DESC LIMIT 1")
      .get(site.sleutel, bezoeker, nu - SESSIE_PAUZE_MS) as { id: string; uitstap: string; paginas: number } | undefined;

    const tx = db.transaction(() => {
      let sessie: string;
      let vorigPad: string | null = null;
      let volgnr = 1;
      if (vorige) {
        sessie = vorige.id;
        vorigPad = vorige.uitstap;
        volgnr = vorige.paginas + 1;
        db.prepare("UPDATE sessies SET laatst = ?, uitstap = ?, paginas = paginas + 1 WHERE id = ?").run(nu, pad, sessie);
      } else {
        sessie = crypto.randomUUID();
        const { kanaal, bron, campagne } = bepaalKanaal(adres, m.r || null, adres.hostname);
        const loc = locatie(ip);
        const { apparaat, browser, os } = leesUA(ua);
        const eerder = db.prepare("SELECT 1 FROM sessies WHERE site = ? AND bezoeker = ? LIMIT 1").get(site.sleutel, bezoeker);
        let verwijzer: string | null = null;
        try {
          verwijzer = m.r ? new URL(m.r).hostname.replace(/^www\./, "") : null;
        } catch {}
        db.prepare(`INSERT INTO sessies (id, site, bezoeker, start, laatst, dag, uur, weekdag, instap, uitstap,
            kanaal, bron, campagne, verwijzer, land, regio, provincie, stad, lat, lon, apparaat, browser, os, taal, scherm,
            paginas, terugkerend)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
          sessie, site.sleutel, bezoeker, nu, nu, dag, uur, weekdag, pad, pad,
          kanaal, bron, tekst(campagne, 100), verwijzer,
          loc?.land ?? null, loc?.regio ?? null, loc?.provincie ?? null, loc?.stad ?? null, loc?.lat ?? null, loc?.lon ?? null,
          apparaat, browser, os, tekst(m.l, 20), geheel(m.sw, 10000), eerder ? 1 : 0,
        );
      }
      db.prepare(`INSERT OR IGNORE INTO weergaven (id, sessie, site, ts, dag, pad, titel, vorig, volgnr, vw)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        m.pv, sessie, site.sleutel, nu, dag, pad, tekst(m.ti, 150), vorigPad, volgnr, geheel(m.vw, 10000),
      );
    });
    tx();
    if (Math.random() < 0.002) opruimen();
    return true;
  }

  if (m.t === "st") {
    const wg = db.prepare("SELECT sessie, dag, pad, actief_ms FROM weergaven WHERE id = ? AND site = ?").get(m.pv, site.sleutel) as
      | { sessie: string; dag: string; pad: string; actief_ms: number }
      | undefined;
    if (!wg) return false;
    const tx = db.transaction(() => {
      const actief = geheel(m.a, 6 * 3600 * 1000) ?? 0;
      const v = m.v || {};
      db.prepare(`UPDATE weergaven SET
          actief_ms = MAX(actief_ms, ?), scroll = MAX(scroll, ?), doc_h = COALESCE(?, doc_h),
          lcp = COALESCE(?, lcp), cls = COALESCE(?, cls), inp = COALESCE(?, inp), ttfb = COALESCE(?, ttfb), laad = COALESCE(?, laad)
        WHERE id = ?`).run(
        actief, geheel(m.sc, 100) ?? 0, geheel(m.dh, 1e6),
        geheel(v.lcp, 120000), typeof v.cls === "number" && isFinite(v.cls) ? Math.min(v.cls, 10) : null,
        geheel(v.inp, 60000), geheel(v.ttfb, 120000), geheel(v.laad, 300000), m.pv,
      );
      const erbij = Math.max(0, actief - wg.actief_ms);
      let conversies = 0;
      const klik = db.prepare(`INSERT INTO klikken (weergave, site, dag, pad, soort, tekst, doel, element, x, y, doc_h, vw)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const c of (Array.isArray(m.c) ? m.c : []).slice(0, 50)) {
        const soort = /^(link|uitgaand|tel|mail|whatsapp|download|knop|formulier|overig)$/.test(c.k) ? c.k : "overig";
        if (CONVERSIE.has(soort)) conversies++;
        klik.run(
          m.pv, site.sleutel, wg.dag, wg.pad, soort, tekst(c.tx, 80), tekst(c.d, 200), tekst(c.el, 80),
          typeof c.x === "number" && c.x >= 0 ? geheel(c.x, 1000) : null,
          typeof c.y === "number" && c.y >= 0 ? geheel(c.y, 1e6) : null,
          geheel(c.dh, 1e6), geheel(c.vw, 10000),
        );
      }
      const sec = db.prepare(`INSERT INTO secties (weergave, site, dag, pad, naam, volgorde, ms, y, h, doc_h)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(weergave, naam) DO UPDATE SET ms = MAX(ms, excluded.ms)`);
      for (const s of (Array.isArray(m.sec) ? m.sec : []).slice(0, 40)) {
        if (typeof s.n !== "string" || !s.n) continue;
        sec.run(m.pv, site.sleutel, wg.dag, wg.pad, s.n.slice(0, 70), geheel(s.o, 100), geheel(s.ms, 6 * 3600 * 1000) ?? 0,
          geheel(s.y, 1e6), geheel(s.h, 1e6), geheel(s.dh, 1e6));
      }
      db.prepare("UPDATE sessies SET actief_ms = actief_ms + ?, conversies = conversies + ?, laatst = MAX(laatst, ?) WHERE id = ?")
        .run(erbij, conversies, nu, wg.sessie);
    });
    tx();
    return true;
  }
  return false;
}

function opruimen() {
  const db = meetDb();
  const grens = belgischeTijd(Date.now() - BEWAARTERMIJN_DAGEN * 86400000).dag;
  for (const t of ["klikken", "secties", "weergaven", "sessies"]) db.prepare(`DELETE FROM ${t} WHERE dag < ?`).run(grens);
}
