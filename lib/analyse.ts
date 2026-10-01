// Analyse per dienst (spec §17, subtab Analyse): de diepere blokken die vroeger enkel
// op de oude Engineering- en Energy-pagina stonden, nu generiek voor elke dienst en op
// dezelfde dataset als het Overzicht (lib/afdelingen.ts). Niets wordt hier opnieuw
// afgebakend: alles vertrekt van dataset(afdeling).

import { getDb } from "./db";
import { parseProjectLocation } from "./regio";
import { POSTCODE_COORDS } from "./postcodeCoords";
import type { Afdeling, Dataset, Lead } from "./afdelingen";
import type { RegionPoint } from "./queries";

const binnen = (d: string | null | undefined, van: string, tot: string) => !!d && d >= van && d < tot;
const aanvragenIn = (d: Dataset, van: string, tot: string) => d.leads.filter((l) => !l.campagne && binnen(l.add, van, tot));
const accountVan = (l: Lead) => l.uid.split(":")[0];

// ---------- per pipeline ----------

export type PipelineRij = { pipeline: string; aanvragen: number; gewonnen: number; verloren: number; open: number; omzet: number };

export function perPipeline(d: Dataset, van: string, tot: string): PipelineRij[] {
  const m = new Map<string, PipelineRij>();
  const omzetPerDeal = new Map<string, number>();
  for (const o of d.omzet) if (binnen(o.won, van, tot)) omzetPerDeal.set(o.bron + o.dealId, (omzetPerDeal.get(o.bron + o.dealId) || 0) + o.bedrag);
  for (const l of d.leads) {
    if (l.campagne) continue;
    const naam = l.pipeline || l.bronLabel;
    const r = m.get(naam) || { pipeline: naam, aanvragen: 0, gewonnen: 0, verloren: 0, open: 0, omzet: 0 };
    if (binnen(l.add, van, tot)) {
      r.aanvragen++;
      if (l.status === "open") r.open++;
    }
    if (l.status === "won" && binnen(l.won, van, tot)) {
      r.gewonnen++;
      r.omzet += omzetPerDeal.get(l.bron + l.id) || 0;
    }
    if (l.status === "lost" && binnen(l.lost, van, tot)) r.verloren++;
    m.set(naam, r);
  }
  return [...m.values()].filter((r) => r.aanvragen || r.gewonnen || r.verloren).map((r) => ({ ...r, omzet: Math.round(r.omzet) })).sort((a, b) => b.aanvragen - a.aanvragen);
}

// ---------- trechter per fase ----------

export type Fase = { fase: string; bereikt: number; open: number; verloren: number; pctVanAanvragen: number; gemDagenInFase: number | null };
export type Trechter = { pipeline: string; aanvragen: number; fases: Fase[] };

/** "Bereikt" is afgeleid uit de huidige fase (Pipedrive bewaart geen volledige historiek, spec §6b). */
export function trechters(d: Dataset, van: string, tot: string): Trechter[] {
  const db = getDb();
  const leads = aanvragenIn(d, van, tot).filter((l) => l.pipeline && l.stageOrder != null);
  const perPipe = new Map<string, Lead[]>();
  for (const l of leads) perPipe.set(`${accountVan(l)}|${l.pipeline}`, [...(perPipe.get(`${accountVan(l)}|${l.pipeline}`) || []), l]);
  const uit: Trechter[] = [];
  const nu = Date.now();
  for (const [sleutel, mine] of perPipe) {
    const [acc, pipeline] = sleutel.split("|");
    const fases = (db
      .prepare("SELECT DISTINCT stage_name, stage_order FROM deals WHERE account_key = ? AND pipeline_name = ? AND stage_order IS NOT NULL ORDER BY stage_order")
      .all(acc, pipeline) as any[]).filter((f, i, arr) => arr.findIndex((x) => x.stage_order === f.stage_order) === i);
    uit.push({
      pipeline,
      aanvragen: mine.length,
      fases: fases.map((f) => {
        let bereikt = 0, open = 0, verloren = 0, dagen = 0, n = 0;
        for (const l of mine) {
          if (l.status === "won" || (l.stageOrder ?? -1) >= f.stage_order) bereikt++;
          if (l.stageOrder === f.stage_order && l.status === "open") {
            open++;
            const t = Date.parse(String(l.stageChange || "").replace(" ", "T") + "Z");
            if (!isNaN(t)) {
              dagen += (nu - t) / 86400000;
              n++;
            }
          }
          if (l.stageOrder === f.stage_order && l.status === "lost") verloren++;
        }
        return { fase: String(f.stage_name).trim(), bereikt, open, verloren, pctVanAanvragen: Math.round((bereikt / mine.length) * 100), gemDagenInFase: n ? Math.round(dagen / n) : null };
      }),
    });
  }
  return uit.sort((a, b) => b.aanvragen - a.aanvragen);
}

// ---------- dag en uur ----------

export function timing(d: Dataset, van: string, tot: string) {
  const wk = new Array(7).fill(0);
  const hr = new Array(24).fill(0);
  const idx: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", hour12: false });
  let totaal = 0;
  for (const l of aanvragenIn(d, van, tot)) {
    if (l.add.length < 13) continue; // Monday-projecten hebben enkel een datum
    const t = new Date(l.add.replace(" ", "T") + "Z");
    if (isNaN(t.getTime())) continue;
    const p = fmt.formatToParts(t);
    const w = p.find((x) => x.type === "weekday")?.value || "";
    if (!(w in idx)) continue;
    wk[idx[w]]++;
    hr[Number(p.find((x) => x.type === "hour")?.value || 0) % 24]++;
    totaal++;
  }
  return {
    perDag: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((label, i) => ({ label, count: wk[i] })),
    perUur: Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, "0"), count: hr[i] })),
    totaal,
  };
}

// ---------- regio ----------

export type ProvincieRij = { provincie: string; aanvragen: number; gewonnen: number; verloren: number; open: number };

export function regio(d: Dataset, van: string, tot: string) {
  const prov = new Map<string, ProvincieRij>();
  const punten: RegionPoint[] = [];
  let geplaatst = 0, onbekend = 0;
  for (const l of aanvragenIn(d, van, tot)) {
    const loc = parseProjectLocation(l.titel, l.postcode);
    if (!loc) {
      onbekend++;
      continue;
    }
    geplaatst++;
    const r = prov.get(loc.province) || { provincie: loc.province, aanvragen: 0, gewonnen: 0, verloren: 0, open: 0 };
    r.aanvragen++;
    if (l.status === "won") r.gewonnen++;
    else if (l.status === "lost") r.verloren++;
    else r.open++;
    prov.set(loc.province, r);
    const c = (POSTCODE_COORDS as Record<string, [number, number]>)[loc.postcode];
    if (c) {
      punten.push({
        id: Number(l.id) || 0,
        lat: c[0],
        lng: c[1],
        status: l.status === "won" ? "won" : l.status === "lost" ? "lost" : "open",
        client: l.klant,
        address: l.titel,
        city: loc.city,
        pipeline: l.pipeline || l.bronLabel,
        value: Math.round(l.waarde),
        currency: "EUR",
        url: l.url,
        products: [],
      });
    }
  }
  return { provincies: [...prov.values()].sort((a, b) => b.aanvragen - a.aanvragen), punten, geplaatst, onbekend };
}

// ---------- bundel tegenover los (enkel bronnen met productregels) ----------

export function bundel(a: Afdeling, d: Dataset, van: string, tot: string) {
  const productBronnen = new Set(a.bronnen.filter((b) => b.soort === "pipedrive" && b.omzet === "product").map((b) => b.sleutel));
  if (!productBronnen.size) return null;
  const db = getDb();
  const omzetPerDeal = new Map<string, number>();
  for (const o of d.omzet) omzetPerDeal.set(o.bron + o.dealId, (omzetPerDeal.get(o.bron + o.dealId) || 0) + o.bedrag);
  const uit = { losAantal: 0, losOmzet: 0, bundelAantal: 0, bundelDealwaarde: 0, bundelDienstOmzet: 0 };
  const afd = db.prepare("SELECT COUNT(DISTINCT COALESCE(department, '')) n FROM deal_products WHERE account_key = ? AND deal_id = ?");
  for (const l of d.leads) {
    if (!productBronnen.has(l.bron) || l.status !== "won" || !binnen(l.won, van, tot)) continue;
    const n = (afd.get(accountVan(l), Number(l.id)) as any)?.n || 0;
    const eigen = omzetPerDeal.get(l.bron + l.id) || 0;
    if (n > 1) {
      uit.bundelAantal++;
      uit.bundelDealwaarde += l.waarde;
      uit.bundelDienstOmzet += eigen;
    } else {
      uit.losAantal++;
      uit.losOmzet += eigen;
    }
  }
  return { ...uit, losOmzet: Math.round(uit.losOmzet), bundelDealwaarde: Math.round(uit.bundelDealwaarde), bundelDienstOmzet: Math.round(uit.bundelDienstOmzet) };
}

// ---------- velden: motivatie, projecttype ----------

export type Telling = { label: string; aantal: number };
const tel = (waarden: (string | undefined | null)[]): Telling[] => {
  const m = new Map<string, number>();
  for (const w of waarden) if (w) m.set(w, (m.get(w) || 0) + 1);
  return [...m.entries()].map(([label, aantal]) => ({ label, aantal })).sort((x, y) => y.aantal - x.aantal);
};

export function velden(d: Dataset, van: string, tot: string) {
  const aanvr = aanvragenIn(d, van, tot);
  const verloren = d.leads.filter((l) => !l.campagne && l.status === "lost" && binnen(l.lost, van, tot));
  const gewonnen = d.leads.filter((l) => !l.campagne && l.status === "won" && binnen(l.won, van, tot));
  return {
    aanvragen: aanvr.length,
    gebouwtype: tel(aanvr.map((l) => l.custom.gebouwtype)),
    typeAanvraag: tel(aanvr.map((l) => l.custom.type_aanvraag)),
    verloren: verloren.length,
    invloedbaar: tel(verloren.map((l) => l.custom.lost_influenceable)),
    oorzaak: tel(verloren.map((l) => l.custom.lost_cause)),
    gewonnen: gewonnen.length,
    redenGewonnen: tel(gewonnen.map((l) => l.custom.reden_gewonnen)),
  };
}

// ---------- geslacht ----------

export function geslacht(d: Dataset, van: string, tot: string) {
  const db = getDb();
  const q = db.prepare("SELECT gender FROM persons WHERE account_key = ? AND id = ?");
  const rijen = { Man: { aanvragen: 0, gewonnen: 0 }, Vrouw: { aanvragen: 0, gewonnen: 0 }, Onbekend: { aanvragen: 0, gewonnen: 0 } };
  for (const l of aanvragenIn(d, van, tot)) {
    const g = l.personId ? ((q.get(accountVan(l), l.personId) as any)?.gender as string | undefined) : undefined;
    const k = g === "Man" || g === "Vrouw" ? g : "Onbekend";
    rijen[k].aanvragen++;
    if (l.status === "won") rijen[k].gewonnen++;
  }
  const totaal = rijen.Man.aanvragen + rijen.Vrouw.aanvragen + rijen.Onbekend.aanvragen;
  return { rijen, totaal, ingevuld: totaal - rijen.Onbekend.aanvragen };
}
