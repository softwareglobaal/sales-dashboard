// Pipelines die het dashboard NIET meetelt (oud / niet meer gebruikt / test).
// Dit verbergt enkel in het dashboard — er wordt NIETS verwijderd in Pipedrive.
//
// Wil je een pipeline (terug) tonen? Haal de regel weg.
// Wil je er één verbergen? Voeg de exacte naam toe bij het juiste account.
// (De namen moeten exact overeenkomen met die in Pipedrive.)

export const HIDDEN_PIPELINES: Record<string, string[]> = {
  harchitects: [
    "SETUP",
    "B2B: 3D Scan onderzoek (OUD)",
  ],
  unabo: [
    "OUD: Architecten prospecties (niet gebruiken)",
    "SETUP",
  ],
  tknburo: [
    "ARCHIVE",
  ],
  energieefficient: [
    "Archive",
    "SETUP",
  ],
};

// Bouwt een SQL-stuk dat de verborgen pipelines uitsluit, met parameters.
export function hiddenExclusion(): { clause: string; params: string[] } {
  const pairs: [string, string][] = [];
  for (const [account, names] of Object.entries(HIDDEN_PIPELINES)) {
    for (const name of names) pairs.push([account, name]);
  }
  if (pairs.length === 0) return { clause: "", params: [] };
  const clause =
    " AND " +
    pairs.map(() => "NOT (account_key = ? AND pipeline_name = ?)").join(" AND ");
  const params = pairs.flat();
  return { clause, params };
}
