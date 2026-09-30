import { ACCOUNTS, Account } from "./accounts";
import { getDb } from "./db";
import {
  fetchAllDeals,
  fetchLookups,
  DealRow,
  fetchDealProducts,
  dealIdsWithProducts,
  ProductRow,
  fetchAllOrganizations,
  fetchDealOfferteTime,
  fetchPersonGenders,
} from "./pipedrive";
import { POSTCODE_COORDS } from "./postcodeCoords";
import { postcodeToProvince } from "./regio";
import { isOfferteStage } from "./engineeringConfig";
import { syncGoogleAds } from "./adsSync";

// haal een BE-postcode uit een adres-string (voor accounts zonder los postcode-veld)
function postcodeFromAddress(addr: string | null): string | null {
  if (!addr) return null;
  const m = addr.match(/(?:^|[\s,])(?:B-)?([1-9]\d{3})(?=[\s,]|$)/);
  return m && postcodeToProvince(m[1]) ? m[1] : null;
}

async function syncOrganizations(account: Account): Promise<number> {
  const db = getDb();
  const orgs = await fetchAllOrganizations(account);
  const insert = db.prepare(`
    INSERT OR REPLACE INTO organizations (account_key, id, name, address, postal, city, province, lat, lng)
    VALUES (@account_key, @id, @name, @address, @postal, @city, @province, @lat, @lng)
  `);
  const tx = db.transaction((items: typeof orgs) => {
    db.prepare("DELETE FROM organizations WHERE account_key = ?").run(account.key);
    for (const o of items) {
      const postal = o.postal || postcodeFromAddress(o.address);
      const province = postcodeToProvince(postal);
      const coord = postal ? POSTCODE_COORDS[postal] : undefined;
      insert.run({
        account_key: o.account_key,
        id: o.id,
        name: o.name,
        address: o.address,
        postal: postal || null,
        city: o.city,
        province: province || null,
        lat: coord ? coord[0] : null,
        lng: coord ? coord[1] : null,
      });
    }
  });
  tx(orgs);
  return orgs.length;
}

// Contactpersonen (geslacht) — enkel lezen, volledige vervanging per account.
// Eén keer per dag volstaat: het veld verandert zelden en elke pagina kost een oproep.
const PERSONEN_NA_MS = 20 * 3600 * 1000;

async function syncPersons(account: Account): Promise<number> {
  const db = getDb();
  const metaKey = `personen:${account.key}`;
  const laatste = (db.prepare("SELECT last_sync FROM sync_meta WHERE account_key = ?").get(metaKey) as any)?.last_sync;
  if (laatste && Date.now() - Date.parse(laatste) < PERSONEN_NA_MS) return 0;
  const rows = await fetchPersonGenders(account);
  const insert = db.prepare("INSERT OR REPLACE INTO persons (account_key, id, gender) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM persons WHERE account_key = ?").run(account.key);
    for (const r of rows) insert.run(account.key, r.id, r.gender);
  });
  tx();
  db.prepare("INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message) VALUES (?, ?, ?, 'ok', ?)")
    .run(metaKey, nowIso(), rows.length, `${rows.length} contactpersonen gesynchroniseerd`);
  return rows.length;
}

function nowIso(): string {
  return new Date().toISOString();
}

// Voert taken uit met maximaal `limit` tegelijk
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Productregels: enkel opnieuw ophalen voor deals die nieuw of gewijzigd zijn.
// Eén oproep per deal; alles telkens opnieuw ophalen kostte bij UNABO ~740 oproepen
// per sync en blies op 29/09/2026 het dagbudget van Pipedrive op (429 "daily request
// budget exceeded"), waardoor ook de aanvraagketen en de Zoom-koppeling stillagen.
// Eén keer per week toch alles, als vangnet voor een wijziging die update_time niet raakt.
const VOLLEDIG_NA_MS = 7 * 24 * 3600 * 1000;

async function syncProducts(account: Account, rows: DealRow[], vorige: Map<number, string | null>): Promise<number> {
  const db = getDb();
  const metaKey = `producten-volledig:${account.key}`;
  const laatsteVolledig = (db.prepare("SELECT last_sync FROM sync_meta WHERE account_key = ?").get(metaKey) as any)?.last_sync;
  const bestaand = new Set(
    (db.prepare("SELECT DISTINCT deal_id FROM deal_products WHERE account_key = ?").all(account.key) as any[]).map((r) => r.deal_id)
  );
  // Zonder vorige volledige herlading maar mét regels (eerste sync na deze wijziging):
  // de bestaande regels zijn vers genoeg, de klok start nu.
  const start = laatsteVolledig ?? (bestaand.size > 0 ? nowIso() : null);
  const volledig = !start || Date.now() - Date.parse(start) > VOLLEDIG_NA_MS;

  const metProducten = dealIdsWithProducts(rows);
  const nieuw = new Map(rows.map((r) => [r.id, r.update_time]));
  const ids = volledig
    ? metProducten
    : metProducten.filter((id) => !bestaand.has(id) || !vorige.has(id) || vorige.get(id) !== nieuw.get(id));
  const lists = await mapLimit(ids, 6, (id) => fetchDealProducts(account, id).catch(() => null));

  const insert = db.prepare(`
    INSERT OR REPLACE INTO deal_products
      (account_key, id, deal_id, name, department, quantity, item_price, line_sum)
    VALUES (@account_key, @id, @deal_id, @name, @department, @quantity, @item_price, @line_sum)
  `);
  const houden = new Set(metProducten);
  const del = db.prepare("DELETE FROM deal_products WHERE account_key = ? AND deal_id = ?");
  const tx = db.transaction(() => {
    // regels van deals die weg zijn of geen producten meer hebben
    for (const id of bestaand) if (!houden.has(id)) del.run(account.key, id);
    ids.forEach((id, i) => {
      const list = lists[i];
      if (list === null) return; // ophalen mislukt: oude regels laten staan
      del.run(account.key, id);
      for (const p of list) insert.run(p);
    });
  });
  tx();
  if (volledig || !laatsteVolledig) {
    db.prepare("INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message) VALUES (?, ?, ?, 'ok', ?)")
      .run(metaKey, nowIso(), ids.length, volledig ? `${ids.length} deals volledig herladen` : "klok gestart");
  }
  return (db.prepare("SELECT COUNT(*) AS n FROM deal_products WHERE account_key = ?").get(account.key) as any).n;
}

async function syncDealFlow(account: Account, stageMap: Map<number, string>) {
  const db = getDb();
  const offerteStageIds = new Set<number>();
  for (const [id, name] of stageMap) if (isOfferteStage(name)) offerteStageIds.add(id);
  if (offerteStageIds.size === 0) return;

  const cols = "id, status, pipeline_name, stage_name, stage_order";
  const idRows =
    account.key === "unabo"
      ? (db
          .prepare(
            `SELECT ${cols} FROM deals WHERE account_key='unabo'
             AND (id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department IN ('ENGINEERING','ENERGY'))
                  OR REPLACE(pipeline_name, ' ', '') IN ('UNABO-Engineering','UNABO-Energy'))`
          )
          .all() as any[])
      : (db.prepare(`SELECT ${cols} FROM deals WHERE account_key=?`).all(account.key) as any[]);

  // Offerte-drempel per pipeline: de laagste fase-volgorde van een offerte-fase.
  const threshold = new Map<string, number>();
  for (const r of idRows) {
    if (r.stage_order != null && isOfferteStage(r.stage_name)) {
      const cur = threshold.get(r.pipeline_name);
      if (cur == null || r.stage_order < cur) threshold.set(r.pipeline_name, r.stage_order);
    }
  }
  // Een deal die nu in of voorbij een offerte-fase staat (of gewonnen is) hoort een
  // offerte-tijd te hebben. Staat er toch NULL, dan is de fase destijds niet herkend
  // (UNABO kortte "Offerte gestuurd" in juli 2026 in tot "Off. gestuurd", waardoor de
  // sync twee maanden lang niets meer vond) — die halen we opnieuw op. Deals die nooit
  // tot een offerte kwamen blijven NULL en worden niet telkens opnieuw bevraagd.
  const shouldHaveTime = (r: any) => {
    const thr = threshold.get(r.pipeline_name);
    return r.status === "won" || isOfferteStage(r.stage_name) || (thr != null && r.stage_order != null && r.stage_order >= thr);
  };
  const done = new Map<number, string | null>();
  for (const r of db.prepare("SELECT deal_id, offerte_time FROM deal_flow WHERE account_key=?").all(account.key) as any[]) {
    done.set(r.deal_id, r.offerte_time);
  }
  const todo = idRows.filter((r) => !done.has(r.id) || (done.get(r.id) == null && shouldHaveTime(r))).map((r) => r.id);
  if (todo.length === 0) return;

  const times = await mapLimit(todo, 6, (id) => fetchDealOfferteTime(account, id, offerteStageIds).catch(() => null));
  const insert = db.prepare("INSERT OR REPLACE INTO deal_flow (account_key, deal_id, offerte_time, fetched_at) VALUES (?, ?, ?, ?)");
  const now = nowIso();
  const tx = db.transaction(() => {
    todo.forEach((id, i) => insert.run(account.key, id, times[i] || null, now));
  });
  tx();
}

export async function syncAccount(account: Account) {
  const db = getDb();
  try {
    const lookups = await fetchLookups(account);
    const rows = await fetchAllDeals(account, lookups);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO deals (
        account_key, id, title, value, currency, status,
        pipeline_id, pipeline_name, stage_id, stage_name, stage_order, label_names, custom_json, owner_name,
        add_time, won_time, lost_time, close_time, update_time,
        expected_close_date, lost_reason, source, raw
      ) VALUES (
        @account_key, @id, @title, @value, @currency, @status,
        @pipeline_id, @pipeline_name, @stage_id, @stage_name, @stage_order, @label_names, @custom_json, @owner_name,
        @add_time, @won_time, @lost_time, @close_time, @update_time,
        @expected_close_date, @lost_reason, @source, @raw
      )
    `);

    // update_time van vóór deze sync: bepaalt welke deals hun producten opnieuw moeten ophalen
    const vorige = new Map<number, string | null>(
      (db.prepare("SELECT id, update_time FROM deals WHERE account_key = ?").all(account.key) as any[]).map((r) => [r.id, r.update_time])
    );

    const tx = db.transaction((items: DealRow[]) => {
      // oude deals van dit account wissen zodat verwijderde deals verdwijnen
      db.prepare("DELETE FROM deals WHERE account_key = ?").run(account.key);
      for (const r of items) insert.run(r);
    });
    tx(rows);

    let productCount = 0;
    if (account.syncProducts) {
      productCount = await syncProducts(account, rows, vorige);
    }

    // organisatie-adressen (voor de B2B-kaartlaag) — alleen lezen
    try {
      await syncOrganizations(account);
    } catch {
      // organisatie-sync mag de deal-sync niet blokkeren
    }

    // geslacht van de contactpersonen — enkel accounts met afdelings-tabs
    if (account.syncProducts) {
      try {
        await syncPersons(account);
      } catch {
        // persoon-sync mag de deal-sync niet blokkeren
      }
    }

    // deal-flow (aanvraag -> offerte-tijd) — enkel accounts met afdelings-tabs, incrementeel
    if (account.syncProducts) {
      try {
        await syncDealFlow(account, lookups.stageMap);
      } catch {
        // deal-flow-sync mag de deal-sync niet blokkeren
      }
    }

    db.prepare(`
      INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message)
      VALUES (?, ?, ?, 'ok', ?)
    `).run(
      account.key,
      nowIso(),
      rows.length,
      `${rows.length} deals${account.syncProducts ? ` + ${productCount} productregels` : ""} gesynchroniseerd`
    );

    return { account: account.key, count: rows.length, products: productCount, status: "ok" as const };
  } catch (err: any) {
    const message = err?.message || String(err);
    db.prepare(`
      INSERT OR REPLACE INTO sync_meta (account_key, last_sync, deal_count, status, message)
      VALUES (?, ?, COALESCE((SELECT deal_count FROM sync_meta WHERE account_key = ?), 0), 'error', ?)
    `).run(account.key, nowIso(), account.key, message);
    return { account: account.key, count: 0, status: "error" as const, message };
  }
}

export async function syncAll() {
  const results = [];
  for (const account of ACCOUNTS) {
    results.push(await syncAccount(account));
  }
  // Google Ads meesyncen als side-effect (mag de Pipedrive-sync nooit blokkeren,
  // en de terugvorm blijft de bestaande array zodat de SyncButton blijft werken).
  try {
    await syncGoogleAds();
  } catch {
    // negeren — Google Ads is optioneel
  }
  return results;
}
