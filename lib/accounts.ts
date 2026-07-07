// De 4 Pipedrive-accounts. Tokens komen uit .env.local (niet in de code).
export type Account = {
  key: string; // unieke sleutel, gebruikt in de database
  name: string; // weergavenaam in het dashboard
  domain: string; // bedrijf.pipedrive.com
  token: string;
  color: string; // kleur in grafieken
  syncProducts?: boolean; // producten per deal ophalen (voor afdelings-/omzetanalyse)
};

export const ACCOUNTS: Account[] = [
  {
    key: "harchitects",
    name: "H-Architects",
    domain: "h-architects",
    token: process.env.PIPEDRIVE_TOKEN_HARCHITECTS || "",
    color: "#2563eb", // blauw
  },
  {
    key: "unabo",
    name: "UNABO",
    domain: "unabo",
    token: process.env.PIPEDRIVE_TOKEN_UNABO || "",
    color: "#16a34a", // groen
    syncProducts: true,
  },
  {
    key: "tknburo",
    name: "TKN-Buro",
    domain: "tkn-buro-tekenwerk",
    token: process.env.PIPEDRIVE_TOKEN_TKNBURO || "",
    color: "#ea580c", // oranje
    syncProducts: true,
  },
  {
    key: "energieefficient",
    name: "Energie Efficiënt",
    domain: "energieefficient",
    token: process.env.PIPEDRIVE_TOKEN_ENERGIEEFFICIENT || "",
    color: "#9333ea", // paars
  },
];

export function getAccount(key: string): Account | undefined {
  return ACCOUNTS.find((a) => a.key === key);
}
