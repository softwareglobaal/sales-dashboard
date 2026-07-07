import cfg from "@/config/lossReasons.json";

const map: Record<string, string> = (cfg.map as Record<string, string>) || {};

// Normaliseert en voegt verlies-reden-varianten samen tot één nette reden.
export function normalizeLossReason(reason: string | null | undefined): string {
  const raw = (reason || "").trim();
  if (!raw) return "(geen reden ingevuld)";
  const norm = raw
    .toLowerCase()
    .replace(/^x\s+/, "") // standaard "X "-voorvoegsel weg
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (map[norm]) return map[norm];
  // nette fallback: enkel het "X "-voorvoegsel weghalen, originele tekst behouden
  return raw.replace(/^x\s+/i, "").trim();
}
