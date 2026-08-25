#!/usr/bin/env node
/**
 * Haalt eenmalig een refresh-token op voor Google Search Console.
 *
 * Search Console vraagt een andere scope dan Google Ads, dus het bestaande
 * GOOGLE_ADS_REFRESH_TOKEN werkt hier niet. De OAuth-client mag wel dezelfde zijn.
 *
 * Gebruik:
 *   node scripts/gsc-auth.mjs
 *
 * Het script toont een link, jij logt in bij Google en plakt de code terug.
 * Het token dat eruit komt zet je zelf in .env.local als GSC_REFRESH_TOKEN --
 * geef het aan niemand door, ook niet in een chat.
 *
 * Voorwaarde in Google Cloud: bij de OAuth-client moet
 * "http://localhost" als toegestane redirect-URI staan, en de
 * Search Console API moet aan staan voor het project.
 */

import { createInterface } from "node:readline/promises";
import { readFileSync, existsSync } from "node:fs";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const REDIRECT = "urn:ietf:wg:oauth:2.0:oob";

function envUit(bestand) {
  if (!existsSync(bestand)) return {};
  const uit = {};
  for (const regel of readFileSync(bestand, "utf8").split("\n")) {
    const m = regel.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) uit[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return uit;
}

const env = { ...envUit(".env.local"), ...envUit(".env"), ...process.env };
const clientId = env.GSC_CLIENT_ID || env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = env.GSC_CLIENT_SECRET || env.GOOGLE_ADS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Geen OAuth-client gevonden. Zet GOOGLE_ADS_CLIENT_ID en _SECRET in .env.local,");
  console.error("of GSC_CLIENT_ID en GSC_CLIENT_SECRET als je een aparte client gebruikt.");
  process.exit(1);
}

const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.searchParams.set("client_id", clientId);
auth.searchParams.set("redirect_uri", REDIRECT);
auth.searchParams.set("response_type", "code");
auth.searchParams.set("scope", SCOPE);
auth.searchParams.set("access_type", "offline");
auth.searchParams.set("prompt", "consent");

console.log("\n1. Open deze link en log in met het Google-account dat toegang heeft");
console.log("   tot de Search Console van energie-efficient.be en unabo.be:\n");
console.log(auth.toString());
console.log("\n2. Google toont een code. Plak die hieronder.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question("Code: ")).trim();
rl.close();

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const json = await res.json();

if (!json.refresh_token) {
  console.error("\nGeen refresh-token gekregen:", JSON.stringify(json, null, 2));
  console.error("\nMeestal betekent dit dat de code verlopen is, of dat je eerder al");
  console.error("toestemming gaf. Probeer opnieuw; het script vraagt expliciet om");
  console.error("hernieuwde toestemming, dus dan hoort er wel een token te komen.");
  process.exit(1);
}

console.log("\nGelukt. Zet deze regel in .env.local (en op de server in ~/appportal/.env):\n");
console.log(`GSC_REFRESH_TOKEN=${json.refresh_token}`);
console.log("\nControleer daarna met: curl 'http://localhost:3000/api/searchconsole?check=1'\n");
