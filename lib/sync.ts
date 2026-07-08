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
} from "./pipedrive";
import { POSTCODE_COORDS } from "./postcodeCoords";
import { postcodeToProvince } from "./regio";
import { isOfferteStage } from "./engineeringConfig";

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

async function syncProducts(account: Account, rows: DealRow[]): Promise<number> {
  const db = getDb();
  const ids = dealIdsWithProducts(rows);
  const lists = await mapLimit(ids, 6, (id) => fetchDealProducts(account, id).catch(() => [] as ProductRow[]));
  const products = lists.flat();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO deal_products
      (account_key, id, deal_id, name, department, quantity, item_price, line_sum)
    VALUES (@account_key, @id, @deal_id, @name, @department, @quantity, @item_price, @line_sum)
  `);
  const tx = db.transaction((items: ProductRow[]) => {
    db.prepare("DELETE FROM deal_products WHERE account_key = ?").run(account.key);
    for (const p of items) insert.run(p);
  });
  tx(products);
  return products.length;
}

// Deal-flow: exacte aanvraag->offerte-tijd. Alleen Engineering-scope deals, en alleen
// deals die nog niet in deal_flow zitten (incrementeel — snel na de eerste keer).
async function syncDealFlow(account: Account, stageMap: Map<number, string>) {
  const db = getDb();
  const offerteStageIds = new Set<number>();
  for (const [id, name] of stageMap) if (isOfferteStage(name)) offerteStageIds.add(id);
  if (offerteStageIds.size === 0) return;

  const idRows =
    account.key === "unabo"
      ? (db
          .prepare(
            `SELECT id FROM deals WHERE account_key='unabo'
             AND (id IN (SELECT deal_id FROM deal_products WHERE account_key='unabo' AND department='ENGINEERING') OR pipeline_name='UNABO-Engineering')`
          )
          .all() as any[])
      : (db.prepare("SELECT id FROM deals WHERE account_key=?").all(account.key) as any[]);
  const done = new Set((db.prepare("SELECT deal_id FROM deal_flow WHERE account_key=?").all(account.key) as any[]).map((r) => r.deal_id));
  const todo = idRows.map((r) => r.id).filter((id) => !done.has(id));
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

    const tx = db.transaction((items: DealRow[]) => {
      // oude deals van dit account wissen zodat verwijderde deals verdwijnen
      db.prepare("DELETE FROM deals WHERE account_key = ?").run(account.key);
      for (const r of items) insert.run(r);
    });
    tx(rows);

    let productCount = 0;
    if (account.syncProducts) {
      productCount = await syncProducts(account, rows);
    }

    // organisatie-adressen (voor de B2B-kaartlaag) — alleen lezen
    try {
      await syncOrganizations(account);
    } catch {
      // organisatie-sync mag de deal-sync niet blokkeren
    }

    // deal-flow (aanvraag -> offerte-tijd) — enkel Engineering-accounts, incrementeel
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
  return results;
}
