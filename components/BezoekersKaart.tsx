"use client";

// Bezoekers op een inzoombare wereldkaart (globe), met echte grenzen en plaatsnamen.
// Kaartbeeld: OpenFreeMap (gratis, geen sleutel, OpenStreetMap-data); licht of donker
// volgt het thema van het dashboard. Elke bol is een gemeente uit de eigen meting
// (IP-locatie, DB-IP), grootte = sessies, oranje rand = er was een contactactie.
// De kaart start op het land van de gekozen site(s) (config/websites.json `kaart`);
// de knoppen springen naar een ander land of naar de hele wereld.

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { num } from "@/lib/format";

export type KaartPunt = { stad: string | null; land: string | null; lat: number | null; lon: number | null; sessies: number; conversies: number };

// Begrenzing per land: [west, zuid, oost, noord].
const LANDEN: Record<string, { naam: string; bbox: [number, number, number, number] }> = {
  BE: { naam: "België", bbox: [2.5, 49.45, 6.45, 51.55] },
  SR: { naam: "Suriname", bbox: [-58.1, 1.8, -53.9, 6.1] },
  NL: { naam: "Nederland", bbox: [3.3, 50.7, 7.3, 53.6] },
  "US-FL": { naam: "Zuid-Florida", bbox: [-80.75, 25.55, -79.95, 26.45] },
  US: { naam: "Verenigde Staten", bbox: [-125, 24.5, -66.9, 49.4] },
};

const STIJL = { licht: "https://tiles.openfreemap.org/styles/positron", donker: "https://tiles.openfreemap.org/styles/dark" };

function donker(): boolean {
  if (typeof document === "undefined") return false;
  const t = document.documentElement.getAttribute("data-thema");
  if (t) return t === "donker";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function BezoekersKaart({ punten, landen }: { punten: KaartPunt[]; landen: string[] }) {
  const doos = useRef<HTMLDivElement>(null);
  const kaart = useRef<any>(null);
  const [actief, setActief] = useState<string>(landen[0] || "wereld");
  const [fout, setFout] = useState<string | null>(null);

  const geojson = {
    type: "FeatureCollection",
    features: punten
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { stad: p.stad || "?", land: p.land || "", sessies: p.sessies, conversies: p.conversies },
      })),
  };
  const max = Math.max(1, ...punten.map((p) => p.sessies));

  const ga = (doel: string, animatie = true) => {
    setActief(doel);
    const m = kaart.current;
    if (!m) return;
    if (doel === "wereld") m.easeTo({ center: [-20, 25], zoom: 1.1, duration: animatie ? 900 : 0 });
    else if (LANDEN[doel]) m.fitBounds(LANDEN[doel].bbox, { padding: 30, duration: animatie ? 900 : 0 });
  };

  useEffect(() => {
    let weg = false;
    let waarnemer: MutationObserver | null = null;
    (async () => {
      try {
        const mod: any = await import("maplibre-gl");
        const ml = mod.Map ? mod : mod.default; // ESM of CJS-bundel
        // MapLibre 6 laadt zijn rekenwerker als apart module-bestand; dat staat in public/
        // met het versienummer in de naam (bij een update: opnieuw kopiëren uit
        // node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs, versie gepind in package.json).
        ml.setWorkerUrl(`/maplibre/maplibre-gl-worker-${ml.getVersion()}.js`);
        if (weg || !doos.current) return;
        const m = new ml.Map({
          container: doos.current,
          style: donker() ? STIJL.donker : STIJL.licht,
          center: [-20, 25],
          zoom: 1.1,
          attributionControl: { compact: true },
          cooperativeGestures: true, // scrollen over de pagina zoomt de kaart niet per ongeluk
        });
        kaart.current = m;
        m.addControl(new ml.NavigationControl({ visualizePitch: false }), "top-right");

        const popup = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
        const tekenLagen = () => {
          m.setProjection({ type: "globe" });
          if (m.getSource("bezoekers")) return;
          m.addSource("bezoekers", { type: "geojson", data: geojson as any });
          m.addLayer({
            id: "bezoekers",
            type: "circle",
            source: "bezoekers",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["sqrt", ["/", ["get", "sessies"], max]], 0, 4, 1, 18],
              "circle-color": "#2a78d6",
              "circle-opacity": 0.75,
              "circle-stroke-width": ["case", [">", ["get", "conversies"], 0], 2.5, 1],
              "circle-stroke-color": ["case", [">", ["get", "conversies"], 0], "#eb6834", donker() ? "#1c1b19" : "#ffffff"],
            },
          });
        };
        m.on("style.load", tekenLagen);
        m.on("load", () => ga(landen[0] || "wereld", false));
        m.on("mousemove", "bezoekers", (e: any) => {
          const f = e.features?.[0];
          if (!f) return;
          m.getCanvas().style.cursor = "pointer";
          const p = f.properties;
          popup
            .setLngLat(f.geometry.coordinates)
            .setHTML(`<b>${p.stad}</b><br>${num(p.sessies)} ${p.sessies === 1 ? "sessie" : "sessies"}${p.conversies > 0 ? ` · ${num(p.conversies)} met contactactie` : ""}`)
            .addTo(m);
        });
        m.on("mouseleave", "bezoekers", () => {
          m.getCanvas().style.cursor = "";
          popup.remove();
        });

        // Thema wisselen in het dashboard = ander kaartbeeld; de lagen komen terug via style.load.
        let huidig = donker();
        waarnemer = new MutationObserver(() => {
          if (donker() === huidig) return;
          huidig = donker();
          // diff: false = volledig herladen, zodat style.load opnieuw vuurt en de bolletjes terugkomen.
          m.setStyle(huidig ? STIJL.donker : STIJL.licht, { diff: false });
        });
        waarnemer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-thema"] });
      } catch (e) {
        setFout(String((e as Error)?.message || e));
      }
    })();
    return () => {
      weg = true;
      waarnemer?.disconnect();
      kaart.current?.remove();
      kaart.current = null;
    };
    // De punten veranderen enkel bij een nieuwe paginaweergave (server component erboven).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const knoppen = [...landen.filter((l) => LANDEN[l]), "wereld"];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {knoppen.map((l) => (
          <button
            key={l}
            onClick={() => ga(l)}
            className={"chip " + (actief === l ? "accent" : "")}
            style={{ padding: "4px 11px", fontSize: 12, cursor: "pointer" }}
          >
            {l === "wereld" ? "Wereld" : LANDEN[l].naam}
          </button>
        ))}
      </div>
      <div
        ref={doos}
        className="w-full overflow-hidden rounded-xl"
        style={{ height: 420, background: "var(--vlak)" }}
        aria-label="Kaart met bezoekers per gemeente"
      />
      {fout && <p className="mt-2 text-[12px] text-zinc-500">De kaart kon niet laden ({fout}). De tabellen hieronder tonen dezelfde gegevens.</p>}
      <p className="mt-2 text-[11.5px] text-zinc-500">
        Bol = gemeente, groter = meer sessies, oranje rand = met contactactie. Zoom met de knoppen, Ctrl/⌘ + scrollen of twee vingers.
      </p>
    </div>
  );
}
