// Agenda-koppeling (spec §17): had de aanvrager een meeting met ons?
//
// Bron 1: de Google-agenda's uit config/agenda.json (Calendly/Zoom-afspraken van Mehdi,
// de H-Architects-agenda). Een afspraak hoort bij een deal als een genodigde met zijn
// e-mailadres als contactpersoon in Pipedrive staat, of (zonder e-mail) als de naam in
// de titel uniek overeenkomt met een contactpersoon van die firma. De firma volgt uit de
// code in de titel ([UNABO-PO] -> UNABO). Bron 2: het Pipedrive-veld "Meeting gehad".
// Elke koppeling bewaart in gewone taal waarom ze gemaakt is, zodat je ze kan nakijken.
// Alleen lezen: er wordt niets naar de agenda of naar Pipedrive geschreven.

import cfg from "@/config/agenda.json";
import { getDb } from "./db";
import type { Dataset, Lead } from "./afdelingen";

type Afspraak = { id: string; agenda: string; start: string; titel: string; prefix: string | null; genodigden: string[] };

function tabellen() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS agenda_afspraken (
      event_id TEXT NOT NULL, agenda TEXT NOT NULL, start TEXT, titel TEXT, prefix TEXT, genodigden TEXT,
      PRIMARY KEY (agenda, event_id)
    );
    CREATE TABLE IF NOT EXISTS afspraak_deal (
      agenda TEXT NOT NULL, event_id TEXT NOT NULL, account_key TEXT NOT NULL, deal_id INTEGER NOT NULL,
      start TEXT, titel TEXT, reden TEXT,
      PRIMARY KEY (agenda, event_id, account_key, deal_id)
    );
  `);
}

async function token(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GOOGLE_AGENDA_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_AGENDA_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_AGENDA_REFRESH_TOKEN || "",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`Google-token: ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  return j.access_token;
}

const prefixVan = (titel: string) => /\[([A-Za-z0-9]+)(?:-([A-Za-z0-9]+))?\]/.exec(titel);

async function leesAgenda(tok: string, id: string, naam: string): Promise<Afspraak[]> {
  const uit: Afspraak[] = [];
  let pageToken: string | undefined;
  const tot = new Date(Date.now() + 2 * 86400000).toISOString();
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ timeMin: `${cfg.vanaf}T00:00:00Z`, timeMax: tot, singleEvents: "true", maxResults: "2500" });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${q}`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`agenda ${naam}: ${r.status}`);
    const j = await r.json();
    for (const e of j.items || []) {
      if (e.status === "cancelled") continue;
      const titel = String(e.summary || "");
      const m = prefixVan(titel);
      uit.push({
        id: e.id,
        agenda: naam,
        start: String(e.start?.dateTime || e.start?.date || ""),
        titel,
        prefix: m ? `${m[1].toUpperCase()}${m[2] ? "-" + m[2].toUpperCase() : ""}` : null,
        genodigden: (e.attendees || []).filter((a: any) => !a.self && a.email).map((a: any) => String(a.email).toLowerCase()),
      });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return uit;
}

const isIntern = (email: string) =>
  cfg.interneAdressen.includes(email) || cfg.interneDomeinen.some((d) => email.endsWith("@" + d));

const normNaam = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+-\s+.*$/, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Haalt de afspraken op en koppelt ze opnieuw aan deals. Eén oproep per 2.500 afspraken. */
export async function syncAgenda() {
  const db = getDb();
  tabellen();
  const meta = db.prepare("INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message) VALUES ('agenda', ?, ?, ?, ?)");
  if (!process.env.GOOGLE_AGENDA_REFRESH_TOKEN) return { status: "niet ingesteld" };
  try {
    const tok = await token();
    const alle: Afspraak[] = [];
    for (const a of cfg.agendas) alle.push(...(await leesAgenda(tok, a.id, a.naam)));
    const ins = db.prepare("INSERT OR REPLACE INTO agenda_afspraken (event_id, agenda, start, titel, prefix, genodigden) VALUES (?, ?, ?, ?, ?, ?)");
    db.transaction(() => {
      db.prepare("DELETE FROM agenda_afspraken").run();
      for (const e of alle) ins.run(e.id, e.agenda, e.start, e.titel, e.prefix, e.genodigden.join(" "));
    })();
    const n = koppel(alle);
    meta.run(new Date().toISOString(), alle.length, "ok", `${alle.length} afspraken gelezen, ${n} koppelingen met een deal`);
    return { status: "ok", afspraken: alle.length, koppelingen: n };
  } catch (e: any) {
    meta.run(new Date().toISOString(), 0, "error", String(e?.message || e).slice(0, 300));
    return { status: "error", message: String(e?.message || e) };
  }
}

function koppel(alle: Afspraak[]): number {
  const db = getDb();
  // contactpersonen per e-mail en per naam, per account
  const perMail = new Map<string, { acc: string; id: number; naam: string }[]>();
  const perNaam = new Map<string, { acc: string; id: number; naam: string }[]>();
  for (const p of db.prepare("SELECT account_key acc, id, naam, emails FROM persons WHERE naam IS NOT NULL OR emails IS NOT NULL").all() as any[]) {
    for (const m of String(p.emails || "").split(" ").filter(Boolean)) perMail.set(m, [...(perMail.get(m) || []), p]);
    if (p.naam) {
      const k = `${p.acc}|${normNaam(p.naam)}`;
      perNaam.set(k, [...(perNaam.get(k) || []), p]);
    }
  }
  // deals per persoon
  const dealsVan = db.prepare(
    "SELECT id, title, add_time, status FROM deals WHERE account_key = ? AND json_extract(raw, '$.person_id.value') = ? ORDER BY add_time"
  );
  const prefixMap = cfg.prefixAccount as Record<string, string>;
  const ins = db.prepare("INSERT OR IGNORE INTO afspraak_deal (agenda, event_id, account_key, deal_id, start, titel, reden) VALUES (?, ?, ?, ?, ?, ?, ?)");
  let n = 0;
  db.transaction(() => {
    db.prepare("DELETE FROM afspraak_deal").run();
    for (const e of alle) {
      const [firmaCode, soort] = (e.prefix || "").split("-");
      if (soort && cfg.intern.includes(soort)) continue; // interne afspraak
      if (!e.prefix && e.genodigden.every(isIntern)) continue;
      const acc = firmaCode ? prefixMap[firmaCode] : undefined;
      const dag = e.start.slice(0, 10);
      const kandidaten: { p: { acc: string; id: number; naam: string }; reden: string }[] = [];
      for (const m of e.genodigden.filter((x) => !isIntern(x))) {
        for (const p of perMail.get(m) || []) {
          if (acc && p.acc !== acc) continue;
          kandidaten.push({ p, reden: `genodigde ${m} is contactpersoon "${p.naam}" in ${p.acc}` });
        }
      }
      if (!kandidaten.length && acc && e.prefix) {
        // Geen e-mail: de naam na de code in de titel, enkel als die uniek is bij die firma.
        const naam = normNaam(e.titel.slice(e.titel.indexOf("]") + 1).replace(/^[:\s-]+/, ""));
        const treffers = naam.split(" ").length >= 2 ? perNaam.get(`${acc}|${naam}`) || [] : [];
        if (treffers.length === 1) kandidaten.push({ p: treffers[0], reden: `naam "${treffers[0].naam}" in de titel, uniek bij ${acc} (geen e-mail in de afspraak)` });
      }
      for (const k of kandidaten) {
        const deals = dealsVan.all(k.p.acc, k.p.id) as any[];
        if (!deals.length) continue;
        // de deal die al bestond op de dag van de afspraak (de laatste ervoor), anders de eerste erna
        const ervoor = deals.filter((x) => String(x.add_time || "").slice(0, 10) <= dag);
        const deal = ervoor.length ? ervoor[ervoor.length - 1] : deals[0];
        ins.run(e.agenda, e.id, k.p.acc, deal.id, e.start, e.titel,
          `${k.reden}; deal "${deal.title}" (aangemaakt ${String(deal.add_time).slice(0, 10)})${ervoor.length ? "" : ", deal kwam pas na de afspraak"}`);
        n++;
      }
    }
  })();
  return n;
}

// ---------- uitlezen per dienst ----------

export type MeetingRij = {
  uid: string; titel: string; url: string; status: string;
  afspraak: string | null; datum: string | null; agenda: string | null; reden: string; eventId: string | null;
};

export function meetingStand(d: Dataset, van: string, tot: string) {
  const db = getDb();
  tabellen();
  const nu = new Date().toISOString();
  const perDeal = new Map<string, any[]>();
  for (const r of db.prepare("SELECT * FROM afspraak_deal WHERE start <= ? ORDER BY start").all(nu) as any[]) {
    const k = `${r.account_key}:${r.deal_id}`;
    perDeal.set(k, [...(perDeal.get(k) || []), r]);
  }
  const aanvr: Lead[] = d.leads.filter((l) => !l.campagne && l.add >= van && l.add < tot && !l.uid.startsWith("monday:"));
  let met = 0, wM = 0, lM = 0, wZ = 0, lZ = 0;
  const perBron = { agenda: 0, pipedrive: 0 };
  const lijst: MeetingRij[] = [];
  for (const l of aanvr) {
    const afs = perDeal.get(l.uid) || [];
    const veld = String(l.custom.meeting_gehad || "") === "Ja";
    const heeft = afs.length > 0 || veld;
    if (heeft) {
      met++;
      if (afs.length) perBron.agenda++;
      else perBron.pipedrive++;
      if (l.status === "won") wM++;
      if (l.status === "lost") lM++;
      const a = afs[afs.length - 1];
      lijst.push({
        uid: l.uid, titel: l.titel, url: l.url, status: l.status,
        afspraak: a?.titel || null,
        datum: a ? String(a.start).slice(0, 10) : l.custom.datum_meeting || null,
        agenda: a?.agenda || (veld ? "Pipedrive-veld" : null),
        reden: a ? `${a.reden}${afs.length > 1 ? ` (+${afs.length - 1} andere afspraken)` : ""}` : `veld "Meeting gehad" = Ja in Pipedrive${l.custom.datum_meeting ? ` op ${l.custom.datum_meeting}` : ""}`,
        eventId: a?.event_id || null,
      });
    } else {
      if (l.status === "won") wZ++;
      if (l.status === "lost") lZ++;
    }
  }
  const gelezen = (db.prepare("SELECT last_sync FROM sync_meta WHERE account_key = 'agenda'").get() as any)?.last_sync || null;
  return {
    aanvragen: aanvr.length,
    met,
    winMet: wM + lM ? wM / (wM + lM) : null,
    winZonder: wZ + lZ ? wZ / (wZ + lZ) : null,
    perBron,
    lijst: lijst.sort((x, y) => (y.datum || "").localeCompare(x.datum || "")),
    agendaGelezen: gelezen ? String(gelezen).slice(0, 16).replace("T", " ") : null,
  };
}
