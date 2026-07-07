import cfg from "@/config/engineering.json";

// Pipelines die niet meetellen in de Engineering-tab
export const ENG_IGNORE_PIPELINES: string[] = cfg.ignorePipelines || [];

// Labels die genegeerd worden (kleine letters, getrimd)
const ignoreLabels = new Set((cfg.ignoreLabels || []).map((s) => s.trim().toLowerCase()));

// label (kleine letters) -> kanaal
const labelMap: Record<string, string> = {};
for (const [k, v] of Object.entries(cfg.labelToChannel || {})) {
  labelMap[k.trim().toLowerCase()] = v as string;
}

export const NO_LABEL_CHANNEL: string = cfg.noLabelChannel || "Geen label";

// Fasen die 'offerte verstuurd' betekenen (kleine letters, gedeeltelijke match)
export const OFFERTE_STAGES: string[] = ((cfg as any).offerteStages || []).map((s: string) => s.trim().toLowerCase());
export function isOfferteStage(stageName: string | null | undefined): boolean {
  const n = (stageName || "").toLowerCase();
  return OFFERTE_STAGES.some((s) => n.includes(s));
}

// Tweelaags kanaal: hoofdkanaal (main) + subkanaal (sub)
type Group = { main: string; sub?: string };
const channelGroups: Record<string, Group> = {};
for (const [k, v] of Object.entries((cfg as any).channelGroups || {})) {
  channelGroups[k.trim().toLowerCase()] = v as Group;
}

// Bepaalt hoofd- en subkanaal voor één label.
export function channelInfo(label: string | null | undefined): { main: string; sub: string | null } | null {
  const raw = (label || "").trim();
  const norm = raw.toLowerCase();
  if (!norm) return { main: NO_LABEL_CHANNEL, sub: null };
  if (ignoreLabels.has(norm)) return null;

  // toekomstig formaat "Categorie, Naam"
  if (raw.includes(",")) {
    const [head, ...rest] = raw.split(",");
    return { main: head.trim(), sub: rest.join(",").trim() || null };
  }
  // "ARC-<naam>" -> Architect (ARC)
  const arc = /^arc[-\s]+(.+)$/i.exec(raw);
  if (arc) return { main: "Architect (ARC)", sub: arc[1].trim() };
  // config-groep
  if (channelGroups[norm]) return { main: channelGroups[norm].main, sub: channelGroups[norm].sub ?? null };
  // val terug op de platte kanaal-mapping, anders het label zelf
  return { main: labelMap[norm] || raw, sub: null };
}

// Zet het opgeslagen label_names-veld om naar unieke {main, sub}-paren.
export function channelsInfoForLabels(labelNames: string | null | undefined): { main: string; sub: string | null }[] {
  const parts = (labelNames || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    const c = channelInfo("");
    return c ? [c] : [];
  }
  const seen = new Set<string>();
  const out: { main: string; sub: string | null }[] = [];
  let hadIgnoredOnly = true;
  for (const p of parts) {
    const info = channelInfo(p);
    if (info) {
      hadIgnoredOnly = false;
      const key = info.main + "||" + (info.sub || "");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(info);
      }
    }
  }
  if (hadIgnoredOnly) return [];
  return out;
}

// Vertaalt één deal-label naar een kanaal.
// Geeft null terug als het label genegeerd moet worden.
export function labelToChannel(label: string | null | undefined): string | null {
  const norm = (label || "").trim().toLowerCase();
  if (!norm) return NO_LABEL_CHANNEL;
  if (ignoreLabels.has(norm)) return null;
  return labelMap[norm] || (label as string).trim();
}

// Vertaalt het opgeslagen label_names-veld (komma-gescheiden) naar unieke kanalen.
export function channelsForLabels(labelNames: string | null | undefined): string[] {
  const parts = (labelNames || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    const c = labelToChannel("");
    return c ? [c] : [];
  }
  const channels = new Set<string>();
  let hadIgnoredOnly = true;
  for (const p of parts) {
    const c = labelToChannel(p);
    if (c) {
      channels.add(c);
      hadIgnoredOnly = false;
    }
  }
  // alle labels genegeerd -> deal valt buiten de analyse
  if (hadIgnoredOnly) return [];
  return Array.from(channels);
}
