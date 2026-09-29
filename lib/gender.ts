import { getDb } from "./db";

// Geslacht van de contactpersoon per aanvraag (deal), binnen een lead-scope.
// De scope-SQL gebruikt ongekwalificeerde kolommen van `deals`; daarom eerst een
// subquery op deals en pas daarna de join met persons (die ook account_key/id heeft).

export type GenderRow = { label: "Man" | "Vrouw" | "Onbekend"; aanvragen: number; gewonnen: number };
export type GenderSplit = { rows: GenderRow[]; totaal: number; ingevuld: number };

export function genderSplit(scopeSql: string, named: Record<string, string>, from: string, to: string): GenderSplit {
  const db = getDb();
  const res = db
    .prepare(
      `SELECT CASE WHEN p.gender = 'Man' THEN 'Man' WHEN p.gender = 'Vrouw' THEN 'Vrouw' ELSE 'Onbekend' END AS label,
              COUNT(*) AS aanvragen,
              SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) AS gewonnen
       FROM (SELECT account_key AS ak, status, json_extract(raw, '$.person_id.value') AS pid
             FROM deals WHERE ${scopeSql} AND add_time >= @from AND add_time < @to) d
       LEFT JOIN persons p ON p.account_key = d.ak AND p.id = d.pid
       GROUP BY label`
    )
    .all({ from, to, ...named }) as GenderRow[];

  const rows = (["Man", "Vrouw", "Onbekend"] as const).map(
    (l) => res.find((r) => r.label === l) || { label: l, aanvragen: 0, gewonnen: 0 }
  );
  const totaal = rows.reduce((a, r) => a + r.aanvragen, 0);
  const ingevuld = totaal - rows[2].aanvragen;
  return { rows, totaal, ingevuld };
}
