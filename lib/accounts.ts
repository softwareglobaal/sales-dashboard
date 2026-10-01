// De 4 Pipedrive-accounts. Tokens komen uit .env.local (niet in de code).
export type Account = {
  key: string; // unieke sleutel, gebruikt in de database
  name: string; // weergavenaam in het dashboard
  domain: string; // bedrijf.pipedrive.com
  token: string;
  color: string; // kleur in grafieken
  syncProducts?: boolean; // producten per deal ophalen (voor afdelings-/omzetanalyse)
  // Producten enkel ophalen voor deals die op of na deze datum aangemaakt of gewonnen
  // zijn. Eén oproep per deal: bij H-Architects (6.000+ deals) zou alles ophalen het
  // Pipedrive-dagbudget opblazen, en het dashboard toont toch enkel dit en vorig jaar.
  productenVanaf?: string;
  // Deal-flow (aanvraag -> offerte-tijd) en geslacht van contactpersonen: één of meer
  // oproepen per deal, enkel nodig voor de Analyse-tabs van Engineering en Energy.
  // Stond vroeger aan zodra syncProducts aan stond; toen H-Architects producten kreeg
  // (30/09/2026) haalde de sync daardoor de fase-historiek van alle 6.000+ H-A-deals op.
  analyse?: boolean;
};

export const ACCOUNTS: Account[] = [
  {
    key: "harchitects",
    name: "H-Architects",
    domain: "h-architects",
    token: process.env.PIPEDRIVE_TOKEN_HARCHITECTS || "",
    color: "#2563eb", // blauw
    // Enkel om Regularisatie van Architectuur te scheiden: dat staat bij H-A als
    // product "Regularisatie" op de deal. De omzet blijft de deal value.
    syncProducts: true,
    productenVanaf: "2025-01-01",
  },
  {
    key: "unabo",
    name: "UNABO",
    domain: "unabo",
    token: process.env.PIPEDRIVE_TOKEN_UNABO || "",
    color: "#16a34a", // groen
    syncProducts: true,
    analyse: true,
  },
  {
    key: "tknburo",
    name: "TKN-Buro",
    domain: "tkn-buro-tekenwerk",
    token: process.env.PIPEDRIVE_TOKEN_TKNBURO || "",
    color: "#ea580c", // oranje
    syncProducts: true,
    analyse: true,
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
