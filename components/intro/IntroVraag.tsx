"use client";

import { useState } from "react";

// Pop-up bij de eerste login: wil je de handleiding lezen? "Ja" opent de PDF in een
// nieuw tabblad. Beide antwoorden worden bewaard; de handleiding blijft in het menu.
export function IntroVraag({ naam, handleiding }: { naam: string; handleiding: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const antwoord = (keuze: "ja" | "nee") => {
    if (keuze === "ja") window.open(handleiding, "_blank", "noopener");
    setOpen(false);
    fetch("/api/intro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keuze }) }).catch(() => {});
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-titel"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(18,18,17,.45)", backdropFilter: "blur(4px)" }}
    >
      <div className="paneel" style={{ maxWidth: 460, width: "100%", background: "var(--glas-sterk)" }}>
        <span className="label">Welkom{naam ? `, ${naam}` : ""}</span>
        <h2 id="intro-titel" style={{ margin: "8px 0 10px", font: "500 24px/1.2 var(--serif)" }}>
          Wil je eerst de korte handleiding lezen?
        </h2>
        <p className="lede" style={{ fontSize: 14 }}>
          Ze legt in een paar pagina&apos;s uit wat het dashboard toont, hoe je het leest en wat je kan doen als een cijfer niet klopt. Je vindt ze
          later ook altijd in het menu onder <b>Handleiding</b>.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button type="button" className="knop-donker" onClick={() => antwoord("ja")} autoFocus>
            Ja, open de handleiding
          </button>
          <button type="button" className="knop-licht" onClick={() => antwoord("nee")}>
            Nee, misschien later
          </button>
        </div>
      </div>
    </div>
  );
}
