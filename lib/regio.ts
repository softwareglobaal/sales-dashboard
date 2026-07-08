// Regio-afleiding uit projectadressen (postcode -> provincie) + parser voor deal-titels.

export const BE_PROVINCE_NAMES = [
  "Antwerpen",
  "Vlaams-Brabant",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Limburg",
  "Brussel",
  "Waals-Brabant",
  "Henegouwen",
  "Luik",
  "Namen",
  "Luxemburg",
] as const;

// Belgische postcodes horen deterministisch bij één provincie.
export function postcodeToProvince(pc: string | number | null | undefined): string | null {
  const n = typeof pc === "number" ? pc : parseInt(String(pc || ""), 10);
  if (!n || n < 1000 || n > 9999) return null;
  if (n <= 1299) return "Brussel";
  if (n <= 1499) return "Waals-Brabant";
  if (n <= 1999) return "Vlaams-Brabant";
  if (n <= 2999) return "Antwerpen";
  if (n <= 3499) return "Vlaams-Brabant";
  if (n <= 3999) return "Limburg";
  if (n <= 4999) return "Luik";
  if (n <= 5999) return "Namen";
  if (n <= 6599) return "Henegouwen";
  if (n <= 6999) return "Luxemburg";
  if (n <= 7999) return "Henegouwen";
  if (n <= 8999) return "West-Vlaanderen";
  return "Oost-Vlaanderen"; // 9000-9999
}

export type ProjectLocation = { province: string; postcode: string; city: string };

// Haal het projectadres (postcode + gemeente) uit een deal-titel.
// Patroon: "... , 3000 Leuven: Engineering" of "Straat 12 3290 Diest".
// Regels tegen valse treffers: postcode NIET aan het begin van de titel (= dossiernummer
// bij H-Architects, bv "2169 Lucien"), en in een geldige BE-range.
export function parseProjectLocation(
  title: string | null | undefined,
  postcodeFromField?: string | null
): ProjectLocation | null {
  // 1) Expliciet postcode-veld (enkel UNABO) heeft voorrang.
  if (postcodeFromField) {
    const prov = postcodeToProvince(postcodeFromField);
    if (prov) return { province: prov, postcode: String(postcodeFromField), city: "" };
  }
  if (!title) return null;

  // 2) Uit de titel: (begin|scheiding) [B-]PPPP  Gemeente
  const re = /(^|[\s,(])(?:B-)?([1-9]\d{3})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-\. ]{1,28}?)(?=[:,()]|$|\s{2})/g;
  let m: RegExpExecArray | null;
  let best: ProjectLocation | null = null;
  while ((m = re.exec(title))) {
    if (m.index === 0 && m[1] === "") continue; // postcode helemaal vooraan = dossiernummer
    const prov = postcodeToProvince(m[2]);
    if (!prov) continue;
    const city = m[3].trim().replace(/\s+/g, " ");
    best = { province: prov, postcode: m[2], city };
  }
  return best;
}
