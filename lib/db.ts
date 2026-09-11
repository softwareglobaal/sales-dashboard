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

    CREATE TABLE IF NOT EXISTS organizations (
      account_key TEXT NOT NULL,
      id          INTEGER NOT NULL,
      name        TEXT,
      address     TEXT,
      postal      TEXT,
      city        TEXT,
      province    TEXT,
      lat         REAL,
      lng         REAL,
      PRIMARY KEY (account_key, id)
    );
    CREATE INDEX IF NOT EXISTS idx_org_account ON organizations(account_key);

    CREATE TABLE IF NOT EXISTS deal_flow (
      account_key  TEXT NOT NULL,
      deal_id      INTEGER NOT NULL,
      offerte_time TEXT,          -- eerste moment dat de deal in een offerte-fase kwam (uit deal-flow)
      fetched_at   TEXT,
      PRIMARY KEY (account_key, deal_id)
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      account_key TEXT PRIMARY KEY,
      last_sync   TEXT,
      deal_count  INTEGER,
      status      TEXT,
      message     TEXT
    );

    -- Google Ads: campagne-dimensies (per Pipedrive-account gekoppeld)
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      account_key   TEXT NOT NULL,   -- gekoppelde Pipedrive-account (bv. 'unabo')
      customer_id   TEXT NOT NULL,   -- Google Ads customer-id
      campaign_id   TEXT NOT NULL,
      name          TEXT,
      status        TEXT,            -- ENABLED / PAUSED / REMOVED
      channel_type  TEXT,            -- SEARCH / PERFORMANCE_MAX / ...
      final_url     TEXT,            -- representatieve landingspagina
      service_key   TEXT,            -- gekoppelde dienst (config/ads.json), of NULL
      PRIMARY KEY (account_key, campaign_id)
    );
    CREATE INDEX IF NOT EXISTS idx_adc_account ON ad_campaigns(account_key);
    CREATE INDEX IF NOT EXISTS idx_adc_service ON ad_campaigns(service_key);

    -- Google Ads: per-campagne, per-dag prestatiecijfers
    CREATE TABLE IF NOT EXISTS ad_metrics_daily (
      account_key TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      date        TEXT NOT NULL,     -- JJJJ-MM-DD
      cost_micros INTEGER,           -- kosten in micro's (÷ 1.000.000 = euro)
      clicks      INTEGER,
      impressions INTEGER,
      conversions REAL,
      conv_value  REAL,
      PRIMARY KEY (account_key, campaign_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_adm_account ON ad_metrics_daily(account_key);
    CREATE INDEX IF NOT EXISTS idx_adm_date    ON ad_metrics_daily(date);

    -- ---------------------------------------------------------------
    -- Concurrentiemonitor Energie (EPB / ventilatie)
    -- ---------------------------------------------------------------

    -- Erkende verslaggevers, bron: VEKA-register via energiesparen.be.
    -- Persoonsgegevens uit een openbaar register: enkel intern gebruik.
    CREATE TABLE IF NOT EXISTS verslaggevers (
      ep_code     TEXT PRIMARY KEY,
      naam        TEXT,
      bedrijf     TEXT,
      postcode    TEXT,
      gemeente    TEXT,
      provincie   TEXT,
      telefoon    TEXT,
      email       TEXT,
      domein      TEXT,             -- afgeleid uit het e-mailadres, leeg bij gratis provider
      bron_datum  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vsl_domein ON verslaggevers(domein);
    CREATE INDEX IF NOT EXISTS idx_vsl_prov   ON verslaggevers(provincie);

    -- ---------------------------------------------------------------
    -- Concurrentiemonitor Architectuur (H-Architects)
    -- ---------------------------------------------------------------

    -- Ingeschreven architecten, bron: het publieke ledenregister van de Orde van
    -- Architecten (Vlaamse Raad) op vind.architect.be. Twee soorten inschrijving
    -- in één tabel: een natuurlijke persoon (stamnummer A...) en een
    -- architectenvennootschap (stamnummer B...). De tabel waarop iemand
    -- ingeschreven staat is een provincie, en dat is hier de regio-indeling.
    --
    -- Net als bij het VEKA-register: openbaar, maar wél persoonsgegevens.
    -- Intern gebruik achter Authentik, niet exporteren, niet verrijken.
    CREATE TABLE IF NOT EXISTS architecten (
      stamnummer  TEXT PRIMARY KEY,   -- A123456 (persoon) of B123456 (vennootschap)
      naam        TEXT,
      soort       TEXT,               -- persoon / vennootschap
      rechtsvorm  TEXT,               -- BV, NV, ... (alleen bij vennootschappen)
      straat      TEXT,
      postcode    TEXT,
      gemeente    TEXT,
      provincie   TEXT,               -- de "tabel" waarop de inschrijving staat
      telefoon    TEXT,
      email       TEXT,
      website     TEXT,
      domein      TEXT,               -- uit de website, anders uit het e-maildomein
      profiel_url TEXT,               -- de publieke profielpagina bij de Orde
      bron_datum  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_arch_domein ON architecten(domein);
    CREATE INDEX IF NOT EXISTS idx_arch_prov   ON architecten(provincie);
    CREATE INDEX IF NOT EXISTS idx_arch_gem    ON architecten(gemeente);

    -- Eén rij per gevolgd domein.
    CREATE TABLE IF NOT EXISTS concurrenten (
      domein        TEXT PRIMARY KEY,
      naam          TEXT,
      bron          TEXT,            -- register / serp / handmatig
      volgen        INTEGER DEFAULT 1,
      categorie     TEXT,            -- concurrent / prospect / portaal / onbekend
      verslaggevers INTEGER DEFAULT 0,
      architecten   INTEGER DEFAULT 0,  -- ingeschreven architecten op dit domein
      provincie     TEXT,
      gemeente      TEXT,
      notitie       TEXT,
      eerste_zien   TEXT,
      laatste_check TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_conc_cat ON concurrenten(categorie);

    -- In welke markt(en) speelt dit domein mee. Een bureau kan in twee markten
    -- zitten: Egeon doet EPB en stabiliteit. Daarom een koppeltabel en geen
    -- kolom op de tabel concurrenten -- anders moet je kiezen, en dan verdwijnt zo'n
    -- bureau uit de ene lijst zodra het in de andere staat.
    CREATE TABLE IF NOT EXISTS concurrent_markt (
      domein      TEXT NOT NULL,
      markt       TEXT NOT NULL,    -- energie / engineering / architectuur / regularisatie
      bron        TEXT,             -- register / serp / crawl / handmatig
      eerste_zien TEXT,
      PRIMARY KEY (domein, markt)
    );
    CREATE INDEX IF NOT EXISTS idx_cm_markt ON concurrent_markt(markt);

    -- Momentopname per domein per crawl. Verschil tussen twee snapshots = signaal.
    CREATE TABLE IF NOT EXISTS site_snapshots (
      domein          TEXT NOT NULL,
      datum           TEXT NOT NULL,   -- JJJJ-MM-DD
      bereikbaar      INTEGER,
      http_status     INTEGER,
      ttfb_ms         INTEGER,
      eind_url        TEXT,
      titel           TEXT,
      meta_desc       TEXT,
      cms             TEXT,
      arch_paginas    INTEGER,         -- pagina's die over architectuur/bouwontwerp gaan
      paginas         INTEGER,         -- indexeerbare URL's in de sitemap
      blog_paginas    INTEGER,
      laatste_blog    TEXT,            -- lastmod van het nieuwste artikel
      laatste_blog_url TEXT,           -- en de bijbehorende link, om te kunnen doorklikken
      blog_per_maand  REAL,            -- publicatietempo laatste 12 maanden
      diensten        TEXT,            -- JSON-array van herkende diensten
      heeft_schema    INTEGER,
      heeft_localbiz  INTEGER,
      woorden_home    INTEGER,
      heeft_sitemap   INTEGER,        -- 0 = geen sitemap gevonden; paginas is dan onbekend, niet nul
      blog_artikels   INTEGER,        -- echte artikels, zonder categorie- en paginatie-archieven
      epb_paginas     INTEGER,        -- pagina's die over EPB/energie gaan: omvang in ONZE markt
      spam_verdacht   INTEGER,        -- URL's die op een gehackte site wijzen
      fout            TEXT,
      PRIMARY KEY (domein, datum)
    );
    CREATE INDEX IF NOT EXISTS idx_snap_datum ON site_snapshots(datum);

    -- URL-niveau, om nieuwe pagina's en nieuwe blogartikels te kunnen zien.
    CREATE TABLE IF NOT EXISTS site_urls (
      domein      TEXT NOT NULL,
      url         TEXT NOT NULL,
      soort       TEXT,              -- blog / pagina / overig
      lastmod     TEXT,
      sitemap_bron TEXT,             -- uit welke deel-sitemap de URL kwam
      artikel     INTEGER,           -- 1 = echt blogartikel (geen archief, geen spam)
      eerste_zien TEXT,
      laatste_zien TEXT,
      PRIMARY KEY (domein, url)
    );
    CREATE INDEX IF NOT EXISTS idx_surl_domein ON site_urls(domein);

    -- Wat er veranderd is. Dit voedt de meldingen.
    CREATE TABLE IF NOT EXISTS signalen (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      domein       TEXT NOT NULL,
      datum        TEXT NOT NULL,
      soort        TEXT NOT NULL,    -- nieuwe-blog / nieuwe-pagina / site-weg / dienst-erbij
      omschrijving TEXT,
      url          TEXT,
      gezien       INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sig_datum ON signalen(datum);

    -- Zoekwoorden die de markt afbakenen. Komen uit config/zoekwoorden-energie.json.
    CREATE TABLE IF NOT EXISTS zoekwoorden (
      term         TEXT PRIMARY KEY,
      thema        TEXT,
      intentie     TEXT,             -- dienst / probleem / kennis / lokaal
      volume       INTEGER,          -- gemiddeld maandelijks zoekvolume
      concurrentie TEXT,             -- LOW / MEDIUM / HIGH
      cpc_laag     REAL,
      cpc_hoog     REAL,
      volume_bron  TEXT,             -- google-ads / handmatig
      volume_datum TEXT,
      markt        TEXT DEFAULT 'energie'   -- welke markt deze term afbakent
    );

    -- Posities per zoekwoord per domein. Eén rij per meting.
    CREATE TABLE IF NOT EXISTS posities (
      term     TEXT NOT NULL,
      domein   TEXT NOT NULL,
      datum    TEXT NOT NULL,
      soort    TEXT NOT NULL,        -- organisch / advertentie
      positie  INTEGER,
      url      TEXT,
      bron     TEXT,                 -- welke SERP-bron de meting deed
      PRIMARY KEY (term, domein, datum, soort)
    );
    -- Menselijk oordeel over een verslaggever of bedrijf. De automatische
    -- indeling zit er soms naast: iemand zonder website kan de zaakvoerder van
    -- een groot bureau zijn. Wie de markt kent, corrigeert dat hier.
    CREATE TABLE IF NOT EXISTS beoordelingen (
      soort     TEXT NOT NULL,      -- verslaggever / domein
      sleutel   TEXT NOT NULL,      -- ep_code of domein
      oordeel   TEXT NOT NULL,      -- prospect / geen-prospect / concurrent / klant
      notitie   TEXT,
      door      TEXT,
      datum     TEXT,
      PRIMARY KEY (soort, sleutel)
    );

    CREATE INDEX IF NOT EXISTS idx_pos_datum ON posities(datum);
    CREATE INDEX IF NOT EXISTS idx_pos_term  ON posities(term);

    -- Echte Google-cijfers voor onze eigen sites, uit Search Console.
    -- Gratis, en nauwkeuriger dan welke externe schatting ook: dit is wat Google
    -- zelf registreert. Alleen voor domeinen waarvan we eigenaar zijn.
    CREATE TABLE IF NOT EXISTS gsc_metingen (
      site        TEXT NOT NULL,     -- de property in Search Console
      term        TEXT NOT NULL,
      datum       TEXT NOT NULL,     -- laatste dag van de gemeten periode
      positie     REAL,              -- gemiddelde positie
      vertoningen INTEGER,
      klikken     INTEGER,
      ctr         REAL,
      url         TEXT,              -- best scorende pagina voor die term
      PRIMARY KEY (site, term, datum)
    );
    CREATE INDEX IF NOT EXISTS idx_gsc_datum ON gsc_metingen(datum);
    CREATE INDEX IF NOT EXISTS idx_gsc_term  ON gsc_metingen(term);
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

  // idem voor de concurrentiemonitor: kolommen die later zijn toegevoegd
  const urlCols = (db.prepare("PRAGMA table_info(site_urls)").all() as any[]).map((c) => c.name);
  if (!urlCols.includes("sitemap_bron")) db.exec("ALTER TABLE site_urls ADD COLUMN sitemap_bron TEXT");
  if (!urlCols.includes("artikel")) db.exec("ALTER TABLE site_urls ADD COLUMN artikel INTEGER");

  const snapCols = (db.prepare("PRAGMA table_info(site_snapshots)").all() as any[]).map((c) => c.name);
  for (const [naam, type] of [
    ["heeft_sitemap", "INTEGER"],
    ["blog_artikels", "INTEGER"],
    ["epb_paginas", "INTEGER"],
    ["spam_verdacht", "INTEGER"],
    ["laatste_blog_url", "TEXT"],
    // Omvang in de Engineering-markt (stabiliteit), naast epb_paginas voor Energie.
    // Twee aparte kolommen omdat hetzelfde domein in beide markten kan meespelen.
    ["eng_paginas", "INTEGER"],
    // Idem voor de Architectuur-markt (H-Architects). Derde kolom, geen derde
    // tabel: dezelfde crawl meet elk domein één keer en telt per markt apart.
    ["arch_paginas", "INTEGER"],
    // En de Regularisatie-markt (regulariseren.be): pagina's over bouwovertredingen
    // en regularisatie. Vierde kolom, zelfde motor.
    ["reg_paginas", "INTEGER"],
  ] as const) {
    if (!snapCols.includes(naam)) db.exec(`ALTER TABLE site_snapshots ADD COLUMN ${naam} ${type}`);
  }

  const concCols = (db.prepare("PRAGMA table_info(concurrenten)").all() as any[]).map((c) => c.name);
  if (!concCols.includes("architecten")) {
    db.exec("ALTER TABLE concurrenten ADD COLUMN architecten INTEGER DEFAULT 0");
  }

  const zwCols = (db.prepare("PRAGMA table_info(zoekwoorden)").all() as any[]).map((c) => c.name);
  if (!zwCols.includes("markt")) {
    db.exec("ALTER TABLE zoekwoorden ADD COLUMN markt TEXT DEFAULT 'energie'");
    db.exec("UPDATE zoekwoorden SET markt = 'energie' WHERE markt IS NULL OR markt = ''");
  }

  const urlCols2 = (db.prepare("PRAGMA table_info(site_urls)").all() as any[]).map((c) => c.name);
  if (!urlCols2.includes("markt_eng")) db.exec("ALTER TABLE site_urls ADD COLUMN markt_eng INTEGER");
  if (!urlCols2.includes("markt_arch")) db.exec("ALTER TABLE site_urls ADD COLUMN markt_arch INTEGER");
  if (!urlCols2.includes("markt_reg")) db.exec("ALTER TABLE site_urls ADD COLUMN markt_reg INTEGER");

  // Eenmalig: alles wat al gevolgd werd, is via het VEKA-register of via de
  // energie-zoektermen binnengekomen. Dat is dus de energiemarkt.
  const nogGeenMarkt = (db.prepare("SELECT COUNT(*) n FROM concurrent_markt").get() as { n: number }).n;
  if (nogGeenMarkt === 0) {
    db.exec(
      `INSERT OR IGNORE INTO concurrent_markt (domein, markt, bron, eerste_zien)
       SELECT domein, 'energie', COALESCE(bron,'register'), COALESCE(eerste_zien, date('now'))
         FROM concurrenten`
    );
  }
}
