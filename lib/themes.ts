import cfg from "@/config/themes.json";

export type Theme = { key: string; label: string; match: string[] };
export const THEMES: Theme[] = (cfg.themes as Theme[]) || [];

export function getTheme(key: string | undefined): Theme | undefined {
  if (!key) return undefined;
  return THEMES.find((t) => t.key === key);
}

// SQL-fragment (met LIKE-condities op productnaam) om deals op een thema te filteren.
// Geeft een subquery-conditie terug die je met AND kan toevoegen, plus de params.
export function themeDealCondition(theme: Theme | undefined, alias = ""): { clause: string; params: string[] } {
  if (!theme || !theme.match.length) return { clause: "", params: [] };
  const likes = theme.match.map(() => "lower(dp.name) LIKE ?").join(" OR ");
  const params = theme.match.map((m) => `%${m.toLowerCase()}%`);
  const idCol = `${alias}id`;
  const accCol = `${alias}account_key`;
  const clause = ` AND ${idCol} IN (SELECT dp.deal_id FROM deal_products dp WHERE dp.account_key = ${accCol} AND (${likes}))`;
  return { clause, params };
}
