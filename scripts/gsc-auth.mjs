#!/usr/bin/env node
/**
 * Haalt eenmalig een refresh-token op voor Google Search Console.
 *
 * Search Console vraagt een andere scope dan Google Ads, dus het bestaande
 * GOOGLE_ADS_REFRESH_TOKEN werkt hier niet. De OAuth-client mag dezelfde zijn.
 *
 * Gebruik:
 *   node scripts/gsc-auth.mjs
 *
 * Het script start kort een webserver op localhost, toont een Google-link, en
 * vangt de code automatisch op zodra je bent ingelogd. Daarna schrijft het het
 * token zelf in .env.local. Het token komt dus niet op je scherm en je hoeft
 * niets over te nemen -- knippen en plakken van een lang token gaat te vaak mis.
 *
 * Wil je het toch zien in plaats van laten wegschrijven:
 *   node scripts/gsc-auth.mjs --toon
 *
 * Google heeft de oude "out-of-band"-methode (code overtypen) op 31 januari 2023
 * uitgeschakeld; die geeft nu altijd "Error 400: invalid_request". Vandaar deze
 * loopback-variant, die Google wél ondersteunt.
 *
 * Voorwaarde in Google Cloud (APIs & Services -> Credentials -> jouw OAuth-client):
 *   - is de client van het type "Desktop app", dan werkt elke localhost-poort meteen;
 *   - is het een "Web application", voeg dan deze exacte redirect-URI toe:
 *         http://localhost:53682/oauth2callback
 * Zet daarnaast de Search Console API aan voor hetzelfde project.
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Werk altijd vanuit de repo, ongeacht waar het script gestart wordt. Anders
// zoekt het .env.local in de map waar je toevallig stond.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const POORT = Number(process.env.GSC_OAUTH_PORT || 53682);
const REDIRECT = `http://localhost:${POORT}/oauth2callback`;

function envUit(bestand) {
  if (!existsSync(bestand)) return {};
  const uit = {};
  for (const regel of readFileSync(bestand, "utf8").split("\n")) {
    const m = regel.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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

function pagina(titel, tekst) {
  return `<!doctype html><meta charset="utf-8"><title>${titel}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;line-height:1.5;color:#18181b">
<h1 style="font-size:1.25rem">${titel}</h1><p>${tekst}</p></body>`;
}

async function haalCode() {
 return await new Promise((klaar, mislukt) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${POORT}`);
    if (url.pathname !== "/oauth2callback") {
      res.writeHead(404).end();
      return;
    }
    const fout = url.searchParams.get("error");
    const c = url.searchParams.get("code");

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      fout
        ? pagina("Toegang geweigerd", `Google gaf terug: <code>${fout}</code>. Je kan dit tabblad sluiten.`)
        : pagina("Gelukt", "De toegang is verleend. Je kan dit tabblad sluiten en terug naar de terminal gaan.")
    );

    server.close();
    fout ? mislukt(new Error(fout)) : klaar(c);
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      mislukt(new Error(`Poort ${POORT} is bezet. Draai opnieuw met een andere poort:\n` +
        `  GSC_OAUTH_PORT=53683 node scripts/gsc-auth.mjs\n` +
        `(voeg die poort dan ook toe bij de redirect-URI's in Google Cloud)`));
    } else mislukt(e);
  });

  server.listen(POORT, "127.0.0.1", () => {
    console.log("\nOpen deze link en log in met het Google-account dat toegang heeft");
    console.log("tot de Search Console van energie-efficient.be en unabo.be:\n");
    console.log(auth.toString());
    console.log("\nZodra je bevestigt, vangt dit script de code zelf op. Wachten...\n");
  });
 });
}

let code;
try {
  code = await haalCode();
} catch (e) {
  console.error(`\nGestopt: ${e.message}`);
  if (e.message === "access_denied") {
    console.error("Je hebt de toegang geweigerd, of het account heeft geen rechten op");
    console.error("de Search Console-properties. Probeer opnieuw met het juiste account.");
  }
  process.exit(1);
}

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
  if (json.error === "redirect_uri_mismatch") {
    console.error(`\nVoeg in Google Cloud bij deze OAuth-client de redirect-URI toe:\n  ${REDIRECT}`);
  }
  process.exit(1);
}

if (process.argv.includes("--toon")) {
  console.log("\nGelukt. Zet deze regel zelf in .env.local:\n");
  console.log(`GSC_REFRESH_TOKEN=${json.refresh_token}`);
  console.log("\nDeel dit token met niemand.\n");
  process.exit(0);
}

// Standaard schrijven we het token weg, zodat het nergens hoeft te worden
// overgetypt. .env.local kan een symlink zijn (hier naar credentials.env);
// realpathSync zorgt dat we het echte bestand aanpassen en niet de link vervangen.
const doel = existsSync(".env.local") ? realpathSync(".env.local") : ".env.local";
const bestaand = existsSync(doel) ? readFileSync(doel, "utf8") : "";
const regel = `GSC_REFRESH_TOKEN=${json.refresh_token}`;

let nieuw;
if (/^GSC_REFRESH_TOKEN=.*$/m.test(bestaand)) {
  nieuw = bestaand.replace(/^GSC_REFRESH_TOKEN=.*$/m, regel);
  console.log(`\nGelukt. Bestaande GSC_REFRESH_TOKEN vervangen in ${doel}`);
} else {
  nieuw = bestaand.replace(/\n*$/, "\n") + `\n# Google Search Console (concurrentiemonitor)\n${regel}\n`;
  console.log(`\nGelukt. GSC_REFRESH_TOKEN toegevoegd aan ${doel}`);
}
writeFileSync(doel, nieuw);

console.log("Het token staat niet in dit venster en hoeft nergens overgetypt te worden.");
console.log("\nVergeet niet dezelfde regel naar de server te brengen (sync-credentials.sh).");
console.log("Controleer daarna met: curl 'http://localhost:3099/api/searchconsole?check=1'\n");
