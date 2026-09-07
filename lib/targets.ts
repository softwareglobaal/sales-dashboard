// Jaardoelen (targets) per scope. Config-gedreven, leeg totdat jullie waarden invullen.
import targets from "@/config/targets.json";
export type YearTarget = { omzet: number; aantal: number };

// scope = sleutel in targets.json: "all" | "unabo" | "tkn" (Engineering) of "energy".
export function getYearTarget(scope: string): YearTarget {
  const t = targets as any;
  const omzet = Number(t.omzet?.[scope] ?? 0) || 0;
  const aantal = Number(t.aantal?.[scope] ?? 0) || 0;
  return { omzet, aantal };
}
