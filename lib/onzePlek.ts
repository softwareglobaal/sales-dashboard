/**
 * "Onze plek": waar staat elke eigen site in elke ranglijst van een
 * concurrentiepagina. De ranglijsten zelf tonen alleen concurrenten; een eigen
 * site staat er dus nooit in. Wat we hier berekenen is de plek die hij zou
 * hebben als je hem meetelt, met precies dezelfde sorteersleutel als de lijst.
 *
 * Rangschikking: 1 + het aantal sites dat strikt beter scoort. Bij gelijke stand
 * delen sites dezelfde plek (zoals bij een sportklassement), zodat een site met
 * nul pagina's niet willekeurig ergens tussen de andere nullen belandt.
 *
 * Alles hier is rekenwerk op rijen die de pagina al ophaalde; geen SQL.
 */
import type { Markt, LeaderboardRij, EigenPositie } from "./concurrentieQueries";

export type PlekRegel = {
  lijst: string;                       // de naam van de ranglijst zoals op de pagina
  status: "in" | "uit" | "onbekend";   // in de lijst / niet in de lijst / niet te bepalen
  tekst: string;
  google?: boolean;                    // een Google-ranglijst: niet erin staan is daar een werkpunt
};

export type Plek = { plek: number; totaal: number };

type Sleutel<T> = (r: T) => number;

/** Wat een ranglijst van een rij nodig heeft. Zowel BureauRij als ConcurrentRij passen hierin. */
export type Meetrij = {
  bereikbaar?: number | null;
  omvang?: number | null;
  blog_artikels?: number | null;
  blog_per_maand?: number | null;
  verslaggevers?: number | null;
  architecten?: number | null;
  epb_paginas?: number | null;
  laatste_blog?: string | null;
  spam_verdacht?: number | null;
};

/** Standaardrangschikking: 1 + aantal rijen dat op de sleutels strikt beter scoort. */
export function plekIn<T>(rijen: T[], eigen: T, sleutels: Sleutel<T>[]): Plek {
  const beter = (r: T) => {
    for (const k of sleutels) {
      const a = k(r) || 0;
      const b = k(eigen) || 0;
      if (a !== b) return a > b;
    }
    return false;
  };
  // totaal = de lijst plus de site zelf
  return { plek: 1 + rijen.filter(beter).length, totaal: rijen.length + 1 };
}

const n = (x: number) => new Intl.NumberFormat("nl-BE").format(x || 0);

/** De plek op omvang (zelfde sleutel als "Sterkst online"), of null als de site niet gemeten is. */
export function plekOpOmvang(rijen: Meetrij[], eigen: Meetrij | undefined): Plek | null {
  if (!eigen || eigen.bereikbaar === null || eigen.bereikbaar === undefined) return null;
  return plekIn<Meetrij>(rijen, eigen, OMVANG);
}

/** Sorteersleutel van de omvanglijsten: pagina's in deze markt, dan artikels. */
export const OMVANG: Sleutel<Meetrij>[] = [(r) => r.omvang || 0, (r) => r.blog_artikels || 0];

/**
 * Plek in een ranglijst die alleen concurrenten toont. `getoond` is hoeveel
 * rijen de pagina standaard laat zien; valt de plek daarbinnen, dan zeggen we dat.
 */
export function plekRanglijst(o: {
  lijst: string;
  rijen: Meetrij[];
  eigen: Meetrij | undefined;
  sleutels: Sleutel<Meetrij>[];
  waarde?: (r: Meetrij) => string;
  getoond?: number;
}): PlekRegel {
  if (!o.eigen || o.eigen.bereikbaar === null || o.eigen.bereikbaar === undefined) {
    return { lijst: o.lijst, status: "onbekend", tekst: "nog niet gemeten" };
  }
  const p = plekIn(o.rijen, o.eigen, o.sleutels);
  const binnen = o.getoond && p.plek <= o.getoond ? ` · binnen de top ${o.getoond}` : "";
  const waarde = o.waarde ? ` (${o.waarde(o.eigen)})` : "";
  return {
    lijst: o.lijst,
    status: "uit",
    tekst: `niet in de lijst · zou #${n(p.plek)} zijn van ${n(p.totaal)}${waarde}${binnen}`,
  };
}

/** De sorteersleutel van "Wie er nog beweegt": wie publiceerde het afgelopen jaar nog. */
export function publiceertNog(r: { laatste_blog?: string | null; spam_verdacht?: number | null }): boolean {
  if ((r.spam_verdacht || 0) >= 3 || !r.laatste_blog) return false;
  const grens = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  return r.laatste_blog >= grens;
}

export function plekActief(lijst: string, rijen: Meetrij[], eigen: Meetrij | undefined): PlekRegel {
  if (!eigen || eigen.bereikbaar === null || eigen.bereikbaar === undefined) {
    return { lijst, status: "onbekend", tekst: "nog niet gemeten" };
  }
  if (!publiceertNog(eigen)) {
    return { lijst, status: "uit", tekst: "niet in de lijst · geen publicatie in het afgelopen jaar" };
  }
  return plekRanglijst({
    lijst, rijen, eigen,
    sleutels: [(r) => r.blog_per_maand || 0, (r) => r.blog_artikels || 0],
    waarde: (r) => `${n(r.blog_artikels || 0)} artikels`,
  });
}

/**
 * Plek in het Google-leaderboard (top N per zoekterm). Daar staat een eigen site
 * wél in als hij hoog genoeg staat. Staat hij er niet in, dan geven we zijn echte
 * positie buiten de top N als die gemeten werd (de meting gaat tot #10).
 */
export function plekGoogle(o: {
  lijst: string;
  leaderboard: LeaderboardRij[];
  posities: EigenPositie[];
  domein: string;
  diepte: number;
  proef?: boolean;
}): PlekRegel | null {
  if (o.leaderboard.length === 0) return null;
  if (o.proef) return { lijst: o.lijst, status: "onbekend", tekst: "proefomgeving: hoort niet in Google", google: true };
  const termen = [...new Set(o.leaderboard.map((r) => r.term))];
  const erin = o.leaderboard.filter((r) => r.domein === o.domein);
  if (erin.length) {
    const rest = termen.length - new Set(erin.map((r) => r.term)).size;
    return {
      lijst: o.lijst,
      status: "in",
      google: true,
      tekst:
        erin.map((r) => `#${r.positie} op '${r.term}'`).join(" · ") +
        (rest > 0 ? ` · niet bij de andere ${rest}` : ""),
    };
  }
  const buiten = o.posities
    .filter((p) => p.domein === o.domein && termen.includes(p.term))
    .sort((a, b) => a.positie - b.positie)[0];
  return {
    lijst: o.lijst,
    status: "uit",
    google: true,
    tekst: buiten
      ? `niet in de lijst · buiten de top ${o.diepte}: #${buiten.positie} op '${buiten.term}'`
      : termen.length === 1
        ? "niet in de lijst · niet in de top 10 op de enige gemeten term"
        : `niet in de lijst · op geen van de ${termen.length} termen in de top 10`,
  };
}

export type ZoekSamenvatting = {
  gemeten: number;
  top3: number;
  top10: number;
  beste: EigenPositie | null;
};

/** Per site: hoeveel gemeten termen in de top 3 en de top 10 staan, plus de beste term. */
export function zoekSamenvatting(posities: EigenPositie[], termen: number, domein: string): ZoekSamenvatting {
  const eigen = posities.filter((p) => p.domein === domein);
  const beste = [...eigen].sort((a, b) => a.positie - b.positie || (b.volume || -1) - (a.volume || -1))[0] || null;
  return {
    gemeten: termen,
    top3: eigen.filter((p) => p.positie <= 3).length,
    top10: eigen.filter((p) => p.positie <= 10).length,
    beste,
  };
}

/** De rol van elke eigen site, per markt. Kort: het staat in een chip. */
const ROLLEN: Record<Markt, Record<string, string>> = {
  energie: {
    "energie-efficient.be": "EPB-site",
    "unabo.be": "hoofdsite UNABO",
    "epb-boete.be": "boetesite particulieren",
  },
  engineering: {
    "unabo.be": "stabiliteitsstudies",
    "tkn-buro.be": "TKN-Buro, meetstaten",
  },
  architectuur: {
    "h-architects.be": "live site",
    "h-architects.globaal.be": "proefomgeving",
  },
  regularisatie: {
    "regulariseren.be": "specialist",
    "mijnregularisatie.be": "zelfcheck",
    "h-architects.be": "moederbureau",
    "unabo.be": "uitgever, adverteerder",
  },
};

export function rolVan(markt: Markt, domein: string): string {
  return ROLLEN[markt]?.[domein] || "eigen site";
}
