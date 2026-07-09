// Jaardoelen (targets) per scope. Config-gedreven, leeg totdat jullie waarden invullen.
import targets from "@/config/targets.json";
import type { EngScope } from "./queries";

export type YearTarget = { omzet: number; aantal: number };

export function getYearTarget(scope: EngScope): YearTarget {
  const t = targets as any;
  const omzet = Number(t.omzet?.[scope] ?? 0) || 0;
  const aantal = Number(t.aantal?.[scope] ?? 0) || 0;
  return { omzet, aantal };
}
