import { ACCOUNTS, Account } from "./accounts";
import { getDb } from "./db";
import {
  fetchAllDeals,
  fetchLookups,
  DealRow,
  fetchDealProducts,
  dealIdsWithProducts,
  ProductRow,
} from "./pipedrive";

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
