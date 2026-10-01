"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SyncButton } from "./SyncButton";
import afdelingenCfg from "@/config/afdelingen.json";

// Vormgeving: de gedeelde huisstijl (app/glas.css, ~/Claude/platform-huisstijl):
// glazen zijbalk met pilvormige menu-items, actief = zwarte pil. De logica
// (welke afdeling open staat, slot-rijen, inklappen) is ongewijzigd.

type Item = { href: string; label: string; icon?: string; soon?: boolean };
type Afdeling = Item & { pad: string };

const OVERZICHT: Item[] = [
  { href: "/", label: "Algemeen", icon: "overzicht" },
  { href: "/content", label: "Wacht op jou", icon: "inbox" },
  { href: "/kaart", label: "Kaart (alles)", icon: "kaart" },
];

// Diensten komen uit config/afdelingen.json (spec §17): dezelfde bron als de
// pagina's en het toegangsslot. Onderdelen (Overzicht, Kanalen, Concurrentie,
// Analyse) staan als subtabs op de dienstpagina zelf, niet meer in dit menu.
const AFDELINGEN: Afdeling[] = afdelingenCfg.afdelingen.map((a) => ({
  pad: a.pad,
  href: "/" + a.pad,
  label: a.naam,
  icon: a.icoon,
}));

const MARKETING: Item[] = [
  { href: "/seo-sea", label: "SEO / SEA", icon: "zoek" },
  { href: "/websites", label: "Websites", icon: "web" },
];
const TEAM: Item[] = [
  { href: "/sales-team", label: "Sales team", icon: "team" },
  { href: "/woordenboek", label: "Woordenboek", icon: "boek" },
  { href: "/applicaties", label: "Applicaties", icon: "apps" },
];

// Lijniconen (24-grid, stroke 1.6). Vaste set, komt nooit uit data.
const ICONEN: Record<string, string> = {
  overzicht: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  kaart: '<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/>',
  engineering: '<path d="M3 20h18"/><path d="M6 20V9l6-5 6 5v11"/><path d="M6 13h12"/>',
  energy: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  "3d-scanning": '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  safety: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9.5 12 2 2 3.5-4"/>',
  plaatsbeschrijving: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  meetstaten: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  architectuur: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
  permits: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13h5M10 17h3"/>',
  // Zelfde tekening als in Watch Tower: een dossier met een vinkje.
  regularisatie: '<path d="M6 3h9l4 4v14H6z"/><path d="m9 14 2 2 4-4"/>',
  doel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  lijst: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  zoek: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 22 19"/>',
  boek: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>',
  apps: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l1 8v6H4v-6z"/>',
  slot: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  links: '<path d="M15 5l-7 7 7 7"/>',
  rechts: '<path d="m9 5 7 7-7 7"/>',
};

function Icoon({ naam, className }: { naam: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      // De paden komen uit de vaste ICONEN-tabel hierboven, nooit uit data.
      dangerouslySetInnerHTML={{ __html: ICONEN[naam] || ICONEN.overzicht }}
    />
  );
}

export function Sidebar({ afdelingen, wachtend = 0 }: { afdelingen: string[]; wachtend?: number }) {
  const mag = (pad: string) => afdelingen.includes(pad);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sb-collapsed") === "1") setCollapsed(true);
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem("sb-collapsed", n ? "1" : "0");
      } catch {}
      return n;
    });

  // Een dienst blijft actief op zijn subtabs (/energy/kanalen, /energy/analyse, ...).
  const row = (it: Item, metOnderdelen = false) => {
    const active = pathname === it.href || (metOnderdelen && pathname.startsWith(it.href + "/"));
    return (
      <Link
        key={it.href}
        href={it.href}
        title={it.label + (it.soon ? " (in aanbouw)" : "")}
        className={active ? "actief" : it.soon ? "binnenkort" : undefined}
        style={it.soon && !active ? { color: "var(--inkt-vaag)" } : undefined}
      >
        <Icoon naam={it.icon || "overzicht"} />
        <span className="lbl">{it.label}</span>
        {it.href === "/content" && wachtend > 0 && (
          <span className="chip let" style={{ marginLeft: "auto", padding: "1px 7px", fontSize: 11 }} title={`${wachtend} teksten wachten op je goedkeuring`}>
            {wachtend}
          </span>
        )}
      </Link>
    );
  };

  const slotRij = (it: Afdeling) => (
    <div key={it.href} className="slotrij" title={`${it.label}: geen toegang`} aria-disabled="true">
      <Icoon naam={it.icon || "overzicht"} />
      <span className="lbl">{it.label}</span>
      {!collapsed && <Icoon naam="slot" className="slot" />}
    </div>
  );

  // Afdelingen blijven staan als je er niet bij mag -- zo weet het team wát er
  // bestaat. De gegevens komen er niet: middleware.ts blokkeert het adres.
  const afdelingGroep = () => (
    <div key="afdelingen">
      {collapsed ? <div className="streep" /> : <span className="groep">Diensten</span>}
      {AFDELINGEN.map((it) =>
        mag(it.pad) ? (
          <div key={it.href}>{row(it, true)}</div>
        ) : (
          slotRij(it)
        ),
      )}
    </div>
  );

  const group = (label: string, items: Item[]) => (
    <div key={label}>
      {collapsed ? <div className="streep" /> : <span className="groep">{label}</span>}
      {items.map((it) => row(it))}
    </div>
  );

  return (
    <aside className={"rail rail-sales" + (collapsed ? " dicht" : "")}>
      <div className="woordmerk">
        {collapsed ? "S" : "Sales"}
        {!collapsed && <small>Dashboard</small>}
      </div>

      <nav aria-label="Hoofdmenu">
        {group("Overzicht", OVERZICHT)}
        {afdelingGroep()}
        {group("Marketing", MARKETING)}
        {group("Team", TEAM)}
      </nav>

      <div className="voet">
        {!collapsed && (
          <>
            <span className="verbonden" title="Het dashboard leest Pipedrive, Monday, Google Ads, Search Console, de websitemeting en facturatiecontrole. Het schrijft nergens naartoe.">
              <i /> Alleen lezen
            </span>
            <div className="sync">
              <SyncButton variant="sidebar" />
            </div>
          </>
        )}
        <button onClick={toggle} className="klap" title={collapsed ? "Menu uitklappen" : "Menu inklappen"} type="button">
          <Icoon naam={collapsed ? "rechts" : "links"} />
        </button>
      </div>
    </aside>
  );
}
