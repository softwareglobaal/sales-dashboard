"use client";

import { useState } from "react";

/**
 * Korte versie van een lange lijst: de pagina markeert elke rij voorbij de
 * eerste `start` met `data-extra`; die blijven verborgen tot iemand op
 * "Toon alle" klikt (zie `.ingekort` in globals.css). Werkt voor tabelrijen,
 * lijstitems en kaartjes in een rooster: de rijen zelf blijven server-gerenderd.
 * Geen URL-parameter: open- en dichtklappen raakt de filters van de pagina niet.
 */
export function Ingekort({
  totaal,
  start,
  wat,
  children,
}: {
  totaal: number;
  start: number;
  wat: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const meer = totaal > start;
  return (
    <div className={"ingekort" + (open || !meer ? " open" : "")}>
      {children}
      {meer && (
        <button
          type="button"
          className="knop-stil knop-klein mt-3"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open
            ? `Toon alleen de eerste ${start}`
            : `Toon alle ${new Intl.NumberFormat("nl-BE").format(totaal)} ${wat}`}
        </button>
      )}
    </div>
  );
}
