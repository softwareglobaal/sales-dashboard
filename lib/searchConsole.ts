/**
 * Google Search Console — echte Google-cijfers voor onze eigen sites.
 *
 * Dit is de enige bron die geen schatting is: het is wat Google zelf registreert
 * over onze vertoningen, klikken en gemiddelde positie. Gratis, maar uitsluitend
 * voor domeinen waarvan we het eigenaarschap bevestigd hebben.
 *
 * Auth: dezelfde OAuth-client als de advertentiesync, maar met een eigen
 * refresh-token, omdat Search Console een andere scope vraagt
 * (webmasters.readonly). Zie scripts/gsc-auth.mjs om die eenmalig op te halen.
 */

import { getDb } from "./db";

const API = "https://searchconsole.googleapis.com/webmasters/v3";

export function gscBeschikbaar(): { klaar: boolean; reden?: string } {
  const client = process.env.GSC_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID;
  const secret = process.env.GSC_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!client || !secret) return { klaar: false, reden: "Geen Google OAuth-client ingesteld" };
  if (!process.env.GSC_REFRESH_TOKEN) {
    return {
      klaar: false,
      reden: "GSC_REFRESH_TOKEN ontbreekt — haal die eenmalig op met scripts/gsc-auth.mjs",
    };
  }
  return { klaar: true };
}

let _token: { value: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (_token && Date.now() < _token.expires - 60_000) return _token.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GSC_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GSC_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GSC_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Search Console OAuth: ${json.error || res.status} ${json.error_description || ""}`.trim());
  }
  _token = { value: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return _token.value;
}

/** Alle properties waar dit account toegang toe heeft. */
export async function lijstProperties(): Promise<{ site: string; rol: string }[]> {
  const t = await token();
  const res = await fetch(`${API}/sites`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
  const tekst = await res.text();
  if (!res.ok) throw new Error(`Search Console /sites: ${res.status} ${tekst.slice(0, 200)}`);
  const json = JSON.parse(tekst);
  return (json.siteEntry || []).map((s: { siteUrl: string; permissionLevel: string }) => ({
    site: s.siteUrl,
    rol: s.permissionLevel,
  }));
}

/**
 * Haalt per zoekterm de gemiddelde positie, vertoningen en klikken op.
 * Google levert de cijfers met ~2 dagen vertraging; we vragen daarom een
 * venster dat 3 dagen terug eindigt.
 */
export async function haalSearchConsole(dagen = 28) {
  const status = gscBeschikbaar();
  if (!status.klaar) return { ok: false, reden: status.reden };

  const t = await token();
  const properties = await lijstProperties();
  if (!properties.length) {
    return { ok: false, reden: "Geen enkele property gevonden — is het eigenaarschap bevestigd?" };
  }

  const eind = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (3 + dagen) * 864e5).toISOString().slice(0, 10);

  const db = getDb();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO gsc_metingen (site, term, datum, positie, vertoningen, klikken, ctr, url)
     VALUES (?,?,?,?,?,?,?,?)`
  );

  let opgeslagen = 0;
  const perProperty: { site: string; rijen: number }[] = [];

  for (const p of properties) {
    const res = await fetch(`${API}/sites/${encodeURIComponent(p.site)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: start,
        endDate: eind,
        dimensions: ["query", "page"],
        rowLimit: 5000,
        type: "web",
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      perProperty.push({ site: p.site, rijen: -1 });
      continue;
    }
    const json = await res.json();
    const rijen = json.rows || [];

    // Per zoekterm de best scorende pagina bewaren.
    const beste = new Map<string, { positie: number; imp: number; klik: number; ctr: number; url: string }>();
    for (const r of rijen) {
      const [term, pagina] = r.keys as [string, string];
      const huidig = beste.get(term);
      if (!huidig || r.position < huidig.positie) {
        beste.set(term, {
          positie: r.position,
          imp: (huidig?.imp || 0) + r.impressions,
          klik: (huidig?.klik || 0) + r.clicks,
          ctr: r.ctr,
          url: pagina,
        });
      } else {
        huidig.imp += r.impressions;
        huidig.klik += r.clicks;
      }
    }

    db.transaction(() => {
      for (const [term, m] of beste) {
        ins.run(p.site, term, eind, m.positie, m.imp, m.klik, m.ctr, m.url);
        opgeslagen++;
      }
    })();
    perProperty.push({ site: p.site, rijen: beste.size });
  }

  return { ok: true, periode: `${start} t/m ${eind}`, properties: perProperty, opgeslagen };
}
