// Introductie bij de eerste login (oktober 2026): per gebruiker één keer de vraag of hij
// de handleiding wil lezen. Bijgehouden op de server per Authentik-gebruiker, zodat de
// vraag niet terugkomt op een andere computer of browser.

import { getDb } from "./db";

function tabel() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS intro_gezien (gebruiker TEXT PRIMARY KEY, keuze TEXT, op TEXT NOT NULL)`);
}

export function introGezien(gebruiker: string): boolean {
  tabel();
  return !!getDb().prepare("SELECT 1 FROM intro_gezien WHERE gebruiker = ?").get(gebruiker);
}

export function bewaarIntro(gebruiker: string, keuze: "ja" | "nee") {
  tabel();
  getDb().prepare("INSERT OR REPLACE INTO intro_gezien (gebruiker, keuze, op) VALUES (?, ?, ?)").run(gebruiker, keuze, new Date().toISOString());
}

export const HANDLEIDING = "/handleiding.pdf";
