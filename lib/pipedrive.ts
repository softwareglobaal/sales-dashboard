import { Account } from "./accounts";
import { customFieldsFor } from "./customFields";

const BASE = "https://api.pipedrive.com/v1";

type CustomDef = { key: string; type: string; options: Map<string, string> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(
  account: Account,
  endpoint: string,
  params: Record<string, string | number> = {},
  retries = 4
) {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_token", account.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString());
      // bij rate limit (429) of serverfout (5xx): even wachten en opnieuw
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(2000 * (attempt + 1), 10000);
        await sleep(wait);
        lastErr = new Error(`Pipedrive ${endpoint} gaf status ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Pipedrive ${endpoint} gaf status ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(`Pipedrive ${endpoint}: ${json.error || "onbekende fout"}`);
      return json;
    } catch (err) {
      // netwerkfout ("fetch failed", reset, timeout) -> opnieuw met backoff
      lastErr = err;
      if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 8000));
    }
  }
  throw lastErr;
}

// id -> naam mappings voor pipelines, stages, gebruikers en labels
export async function fetchLookups(account: Account) {
  const [pipelines, stages, users, dealFields] = await Promise.all([
    api(account, "/pipelines"),
    api(account, "/stages"),
    api(account, "/users"),
    api(account, "/dealFields", { limit: 500 }),
  ]);
  const pipelineMap = new Map<number, string>();
  for (const p of pipelines.data || []) pipelineMap.set(p.id, p.name);
  const stageMap = new Map<number, string>();
  const stageOrderMap = new Map<number, number>();
  for (const s of stages.data || []) {
    stageMap.set(s.id, s.name);
    stageOrderMap.set(s.id, s.order_nr ?? 0);
  }
  const userMap = new Map<number, string>();
  for (const u of users.data || []) userMap.set(u.id, u.name);

  // label-opties (id -> naam) uit het 'label'-veld
  const labelMap = new Map<string, string>();
  const labelField = (dealFields.data || []).find((f: any) => f.key === "label");
  for (const o of (labelField && labelField.options) || []) labelMap.set(String(o.id), o.label);

  // custom velden (uit config) -> definitie (type + optie-labels)
  const customDefs = new Map<string, CustomDef>();
  const wanted = customFieldsFor(account.key);
  for (const [friendly, key] of Object.entries(wanted)) {
    const f = (dealFields.data || []).find((x: any) => x.key === key);
    if (!f) continue;
    const options = new Map<string, string>();
    for (const o of f.options || []) options.set(String(o.id), o.label);
    customDefs.set(friendly, { key, type: f.field_type, options });
  }

  return { pipelineMap, stageMap, stageOrderMap, userMap, labelMap, customDefs };
}

// Resolveert de geconfigureerde custom velden van een deal naar een {vriendelijk: label}-object
function resolveCustom(deal: any, customDefs: Map<string, CustomDef>): string | null {
  const out: Record<string, string> = {};
  for (const [friendly, def] of customDefs) {
    const raw = deal[def.key];
    if (raw == null || raw === "") continue;
    if (def.type === "enum") {
      out[friendly] = def.options.get(String(raw)) || String(raw);
    } else if (def.type === "set") {
      const labels = String(raw)
        .split(",")
        .map((id) => def.options.get(id.trim()) || id.trim())
        .filter(Boolean);
      if (labels.length) out[friendly] = labels.join(", ");
    } else {
      out[friendly] = String(raw);
    }
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

export type DealRow = {
  account_key: string;
  id: number;
  title: string | null;
  value: number | null;
  currency: string | null;
  status: string | null;
  pipeline_id: number | null;
  pipeline_name: string | null;
  stage_id: number | null;
  stage_name: string | null;
  stage_order: number | null;
  label_names: string | null;
  custom_json: string | null;
  owner_name: string | null;
  add_time: string | null;
  won_time: string | null;
  lost_time: string | null;
  close_time: string | null;
  update_time: string | null;
  expected_close_date: string | null;
  lost_reason: string | null;
  source: string | null;
  raw: string;
};

function ownerName(deal: any, userMap: Map<number, string>): string | null {
  if (deal.user_id && typeof deal.user_id === "object") return deal.user_id.name ?? null;
  if (typeof deal.user_id === "number") return userMap.get(deal.user_id) ?? null;
  if (deal.owner_name) return deal.owner_name;
  return null;
}

function sourceOf(deal: any): string | null {
  return deal.origin || deal.source_channel || deal.channel || deal.source || null;
}

// Zet het label-veld (kan meerdere komma-gescheiden id's bevatten) om naar namen
function labelNames(label: any, labelMap: Map<string, string>): string | null {
  if (label == null || label === "") return null;
  const names = String(label)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => labelMap.get(id) || `id${id}`);
  return names.length ? names.join(", ") : null;
}

// Afdeling afleiden uit de productnaam: deel vóór de eerste dubbele punt.
// Geen naam of geen dubbele punt -> "Niet toegewezen".
export function parseDepartment(name: string | null | undefined): string {
  if (!name) return "Niet toegewezen";
  const i = name.indexOf(":");
  if (i <= 0) return "Niet toegewezen";
  return name.slice(0, i).trim().toUpperCase();
}

export type ProductRow = {
  account_key: string;
  id: number;
  deal_id: number;
  name: string | null;
  department: string;
  quantity: number | null;
  item_price: number | null;
  line_sum: number;
};

// Haalt de productregels van één deal op
export async function fetchDealProducts(account: Account, dealId: number): Promise<ProductRow[]> {
  const json = await api(account, `/deals/${dealId}/products`);
  const data: any[] = json.data || [];
  return data.map((p, idx) => {
    const qty = p.quantity ?? null;
    const price = p.item_price ?? null;
    const sum = p.sum ?? (price != null && qty != null ? price * qty : 0);
    return {
      account_key: account.key,
      id: typeof p.id === "number" ? p.id : dealId * 100000 + idx,
      deal_id: dealId,
      name: p.name ?? null,
      department: parseDepartment(p.name),
      quantity: qty,
      item_price: price,
      line_sum: sum || 0,
    };
  });
}

// Welke deals hebben producten? (uit de ruwe data die we al ophaalden)
export function dealIdsWithProducts(rows: DealRow[]): number[] {
  const ids: number[] = [];
  for (const r of rows) {
    try {
      const d = JSON.parse(r.raw);
      if ((d.products_count || 0) > 0) ids.push(r.id);
    } catch {
      // negeren
    }
  }
  return ids;
}

// Haalt ALLE deals op (open + gewonnen + verloren), pagina per pagina
export async function fetchAllDeals(
  account: Account,
  lookups: {
    pipelineMap: Map<number, string>;
    stageMap: Map<number, string>;
    stageOrderMap: Map<number, number>;
    userMap: Map<number, string>;
    labelMap: Map<string, string>;
    customDefs: Map<string, CustomDef>;
  }
): Promise<DealRow[]> {
  const rows: DealRow[] = [];
  let start = 0;
  const limit = 500;
  for (let guard = 0; guard < 1000; guard++) {
    const json = await api(account, "/deals", {
      start,
      limit,
      status: "all_not_deleted",
      sort: "id ASC",
    });
    const data: any[] = json.data || [];
    for (const d of data) {
      rows.push({
        account_key: account.key,
        id: d.id,
        title: d.title ?? null,
        value: d.value ?? null,
        currency: d.currency ?? null,
        status: d.status ?? null,
        pipeline_id: d.pipeline_id ?? null,
        pipeline_name: d.pipeline_id ? lookups.pipelineMap.get(d.pipeline_id) ?? null : null,
        stage_id: d.stage_id ?? null,
        stage_name: d.stage_id ? lookups.stageMap.get(d.stage_id) ?? null : null,
        stage_order: d.stage_id ? lookups.stageOrderMap.get(d.stage_id) ?? null : null,
        label_names: labelNames(d.label, lookups.labelMap),
        custom_json: resolveCustom(d, lookups.customDefs),
        owner_name: ownerName(d, lookups.userMap),
        add_time: d.add_time ?? null,
        won_time: d.won_time ?? null,
        lost_time: d.lost_time ?? null,
        close_time: d.close_time ?? null,
        update_time: d.update_time ?? null,
        expected_close_date: d.expected_close_date ?? null,
        lost_reason: d.lost_reason ?? null,
        source: sourceOf(d),
        raw: JSON.stringify(d),
      });
    }
    const pag = json.additional_data?.pagination;
    if (!pag || !pag.more_items_in_collection) break;
    start = pag.next_start ?? start + limit;
  }
  return rows;
}
