import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database-bestand staat in /data (genegeerd door git)
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "dashboard.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      account_key   TEXT NOT NULL,
      id            INTEGER NOT NULL,
      title         TEXT,
      value         REAL,
      currency      TEXT,
      status        TEXT,            -- open / won / lost
      pipeline_id   INTEGER,
      pipeline_name TEXT,
      stage_id      INTEGER,
      stage_name    TEXT,
      stage_order   INTEGER,
      label_names   TEXT,
      owner_name    TEXT,
      add_time      TEXT,
      won_time      TEXT,
      lost_time     TEXT,
      close_time    TEXT,
      update_time   TEXT,
      expected_close_date TEXT,
      lost_reason   TEXT,
      source        TEXT,            -- herkomst/kanaal van de lead
      raw           TEXT,            -- volledige ruwe data (JSON) voor latere analyse
      PRIMARY KEY (account_key, id)
    );

    CREATE INDEX IF NOT EXISTS idx_deals_account ON deals(account_key);
    CREATE INDEX IF NOT EXISTS idx_deals_status  ON deals(status);
    CREATE INDEX IF NOT EXISTS idx_deals_add     ON deals(add_time);
    CREATE INDEX IF NOT EXISTS idx_deals_won     ON deals(won_time);

    CREATE TABLE IF NOT EXISTS deal_products (
      account_key TEXT NOT NULL,
      id          INTEGER NOT NULL,   -- id van de productregel
      deal_id     INTEGER NOT NULL,
      name        TEXT,
      department  TEXT,               -- afgeleid uit de productnaam (voor de dubbele punt)
      quantity    REAL,
      item_price  REAL,
      line_sum    REAL,               -- regeltotaal (quantity * item_price)
      PRIMARY KEY (account_key, id)
    );
    CREATE INDEX IF NOT EXISTS idx_dp_account ON deal_products(account_key);
    CREATE INDEX IF NOT EXISTS idx_dp_deal    ON deal_products(account_key, deal_id);
    CREATE INDEX IF NOT EXISTS idx_dp_dept    ON deal_products(department);

    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      content    TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      account_key TEXT PRIMARY KEY,
      last_sync   TEXT,
      deal_count  INTEGER,
      status      TEXT,
      message     TEXT
    );
  `);

  // migratie: voeg ontbrekende kolommen toe aan bestaande databases
  const cols = (db.prepare("PRAGMA table_info(deals)").all() as any[]).map((c) => c.name);
  if (!cols.includes("stage_order")) {
    db.exec("ALTER TABLE deals ADD COLUMN stage_order INTEGER");
  }
  if (!cols.includes("label_names")) {
    db.exec("ALTER TABLE deals ADD COLUMN label_names TEXT");
  }
  if (!cols.includes("custom_json")) {
    db.exec("ALTER TABLE deals ADD COLUMN custom_json TEXT");
  }
}
