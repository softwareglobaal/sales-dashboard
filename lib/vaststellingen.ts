// Vaststellingen bij het Bisson-overzicht (spec §18): wie naleest (Matthew, Mehdi, Siyan)
// zet per Bisson-project of per opdrachtgever "klopt", "fout gekoppeld" of "nakijken",
// met een vrije notitie. Bewaard in de dashboarddatabase; de enige plek waar dit
// overzicht schrijft. Pipedrive, Octopus en Monday blijven onaangeroerd.

import { getDb } from "./db";

export const STATUSSEN = ["klopt", "fout gekoppeld", "nakijken"] as const;
export type VaststellingStatus = (typeof STATUSSEN)[number];
export type Vaststelling = { sleutel: string; status: VaststellingStatus | null; notitie: string | null; door: string; op: string };

function tabel() {
  getDb().exec(
    `CREATE TABLE IF NOT EXISTS bisson_vaststelling (
       sleutel TEXT PRIMARY KEY, status TEXT, notitie TEXT, door TEXT NOT NULL, op TEXT NOT NULL)`,
  );
}

/** Alle vaststellingen, op sleutel ("project|240080" of "bureau|rove"). */
export function vaststellingen(): Record<string, Vaststelling> {
  tabel();
  const rijen = getDb().prepare("SELECT sleutel, status, notitie, door, op FROM bisson_vaststelling").all() as Vaststelling[];
  return Object.fromEntries(rijen.map((r) => [r.sleutel, r]));
}

export function bewaarVaststelling(sleutel: string, status: string | null, notitie: string | null, door: string) {
  tabel();
  if (!/^(project|bureau)\|[\w.-]{1,80}$/.test(sleutel)) throw new Error("ongeldige sleutel");
  const s = status && (STATUSSEN as readonly string[]).includes(status) ? status : null;
  const n = (notitie || "").trim().slice(0, 1000) || null;
  if (!s && !n) {
    getDb().prepare("DELETE FROM bisson_vaststelling WHERE sleutel = ?").run(sleutel);
    return;
  }
  getDb()
    .prepare("INSERT OR REPLACE INTO bisson_vaststelling (sleutel, status, notitie, door, op) VALUES (?, ?, ?, ?, ?)")
    .run(sleutel, s, n, door, new Date().toISOString());
}
