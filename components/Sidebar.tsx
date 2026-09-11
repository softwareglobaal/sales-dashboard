"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SyncButton } from "./SyncButton";

// Vormgeving: de gedeelde huisstijl (app/glas.css, ~/Claude/platform-huisstijl):
// glazen zijbalk met pilvormige menu-items, actief = zwarte pil. De logica
// (welke afdeling open staat, slot-rijen, inklappen) is ongewijzigd.

type Item = { href: string; label: string; icon?: string; soon?: boolean };
type Afdeling = Item & { pad: string; onder?: Item[] };

const OVERZICHT: Item[] = [
  { href: "/", label: "Algemeen", icon: "overzicht" },
  { href: "/kaart", label: "Kaart (alles)", icon: "kaart" },
];

// Afdeling-eerst: wat bij één afdeling hoort, hangt eronder. Concurrentie en
// Verslaggevers stonden hiervoor in een globale groep "Marketing", terwijl ze
// alleen over Energy gaan -- dat breekt zodra Engineering hetzelfde krijgt.
const AFDELINGEN: Afdeling[] = [
  {
    pad: "engineering", href: "/engineering", label: "Engineering", icon: "engineering",
    onder: [
      { href: "/engineering/concurrentie", label: "Concurrentie", icon: "doel" },
    ],
  },
  {
    pad: "energy", href: "/energy", label: "Energy", icon: "energy",
    onder: [
      { href: "/energy/concurrentie", label: "Concurrentie", icon: "doel" },
      { href: "/energy/register", label: "Verslaggevers", icon: "lijst" },
    ],
  },
  { pad: "3d-scanning", href: "/3d-scanning", label: "3D Scanning", icon: "3d-scanning", soon: true },
  { pad: "safety", href: "/safety", label: "Safety", icon: "safety", soon: true },
  { pad: "plaatsbeschrijving", href: "/plaatsbeschrijving", label: "Plaatsbeschrijving", icon: "plaatsbeschrijving", soon: true },
  { pad: "meetstaten", href: "/meetstaten", label: "Meetstaten", icon: "meetstaten", soon: true },
  {
    // De afdelingspagina zelf is nog in aanbouw; de concurrentiemonitor eronder
    // niet. Daarom blijft "soon" op de tab staan maar hangt het onderdeel er wel al.
    pad: "h-architects", href: "/h-architects", label: "H-Architects", icon: "architectuur", soon: true,
    onder: [
      { href: "/h-architects/concurrentie", label: "Concurrentie", icon: "doel" },
    ],
  },
];

const MARKETING: Item[] = [
  { href: "/seo-sea", label: "SEO / SEA", icon: "zoek" },
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
  doel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  lijst: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  zoek: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 22 19"/>',
  boek: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>',
  apps: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
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

export function Sidebar({ afdelingen }: { afdelingen: string[] }) {
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

  const row = (it: Item) => {
    const active = pathname === it.href;
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
      {collapsed ? <div className="streep" /> : <span className="groep">Afdelingen</span>}
      {AFDELINGEN.map((it) =>
        mag(it.pad) ? (
          <div key={it.href}>
            {row(it)}
            {!collapsed && it.onder && <div className="onder">{it.onder.map((sub) => row(sub))}</div>}
          </div>
        ) : (
          slotRij(it)
        ),
      )}
    </div>
  );

  const group = (label: string, items: Item[]) => (
    <div key={label}>
      {collapsed ? <div className="streep" /> : <span className="groep">{label}</span>}
      {items.map(row)}
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
            <span className="verbonden">
              <i /> Pipedrive, alleen lezen
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
