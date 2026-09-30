// Monday-projectborden inlezen (enkel lezen: queries, nooit mutations).
//
// Waarom: Energie Efficiënt verkoopt twee keer. Eerst via het salesteam (dat staat in
// het EE-Pipedrive-account), daarna rechtstreeks: een EPB-bureau dat één keer
// getekend heeft, stuurt volgende dossiers zelf naar de uitvoering. Die projecten
// komen nooit meer in Pipedrive, wel op het bord Projects-EE. Zonder dit bord zou de
// Energy-tab die omzet volledig missen (spec §17).

import { getDb } from "./db";

type BordConfig = { bord: string; kolommen: Record<"soort" | "klantOa" | "goedgekeurd" | "bedrag" | "meerwerk", string> };

// Kolom-id's van Projects-EE (opgehaald 30/09/2026). Hernoemt iemand een kolom in
// Monday, dan blijft het id gelijk; verwijdert iemand er één, dan blijft het veld leeg.
export const MONDAY_BORDEN: BordConfig[] = [
  {
    bord: "7326219382",
    kolommen: {
      soort: "project_type",
      klantOa: "dropdown_mkvdr511",
      goedgekeurd: "date8__1",
      bedrag: "numbers9",
      meerwerk: "numeric_mm592zbn",
    },
  },
];

const API = "https://api.monday.com/v2";

async function query(token: string, q: string): Promise<any> {
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
    body: JSON.stringify({ query: q }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(`Monday gaf ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 200)}`);
  return j.data;
}

const getal = (t: string | null | undefined) => {
  const n = parseFloat(String(t ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function mondayGeconfigureerd(): boolean {
  return !!process.env.MONDAY_API_TOKEN;
}

export async function syncMonday() {
  const token = process.env.MONDAY_API_TOKEN || "";
  const db = getDb();
  const meta = db.prepare(
    "INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message) VALUES (?, ?, ?, ?, ?)"
  );
  if (!token) return { bron: "monday", status: "niet ingesteld" };
  const uit = [];
  for (const b of MONDAY_BORDEN) {
    const sleutel = `monday:${b.bord}`;
    try {
      const ids = JSON.stringify(Object.values(b.kolommen));
      const velden = `cursor items { id name created_at group { title } column_values(ids: ${ids}) { id text } }`;
      const items: any[] = [];
      let data = await query(token, `query { boards(ids: [${b.bord}]) { items_page(limit: 500) { ${velden} } } }`);
      let pagina = data.boards[0].items_page;
      items.push(...pagina.items);
      while (pagina.cursor) {
        data = await query(token, `query { next_items_page(limit: 500, cursor: "${pagina.cursor}") { ${velden} } }`);
        pagina = data.next_items_page;
        items.push(...pagina.items);
      }
      const k = b.kolommen;
      const ins = db.prepare(`INSERT INTO monday_projecten
        (bord, id, naam, groep, soort, klant_oa, goedgekeurd, bedrag, meerwerk, aangemaakt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      db.transaction(() => {
        db.prepare("DELETE FROM monday_projecten WHERE bord = ?").run(b.bord);
        for (const it of items) {
          const c: Record<string, string | null> = {};
          for (const v of it.column_values) c[v.id] = v.text;
          ins.run(
            b.bord, String(it.id), it.name, it.group?.title ?? null, c[k.soort] || null, c[k.klantOa] || null,
            (c[k.goedgekeurd] || "").slice(0, 10) || null, getal(c[k.bedrag]), getal(c[k.meerwerk]),
            String(it.created_at || "").slice(0, 10) || null,
          );
        }
      })();
      meta.run(sleutel, new Date().toISOString(), items.length, "ok", `${items.length} projecten gelezen`);
      uit.push({ bron: sleutel, count: items.length, status: "ok" });
    } catch (e: any) {
      meta.run(sleutel, new Date().toISOString(), 0, "error", String(e?.message || e).slice(0, 300));
      uit.push({ bron: sleutel, status: "error", message: String(e?.message || e) });
    }
  }
  return uit;
}
