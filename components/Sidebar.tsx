"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SyncButton } from "./SyncButton";

type Item = { href: string; label: string; dot?: string; icon?: string; soon?: boolean };

const OVERZICHT: Item[] = [
  { href: "/", label: "Algemeen", icon: "▦" },
  { href: "/kaart", label: "Kaart (alles)", icon: "◉" },
];
const AFDELINGEN: Item[] = [
  { href: "/engineering", label: "Engineering", dot: "#16a34a" },
  { href: "/energy", label: "Energy", dot: "#3a4459", soon: true },
  { href: "/3d-scanning", label: "3D Scanning", dot: "#3a4459", soon: true },
  { href: "/safety", label: "Safety", dot: "#3a4459", soon: true },
  { href: "/plaatsbeschrijving", label: "Plaatsbeschrijving", dot: "#3a4459", soon: true },
  { href: "/meetstaten", label: "Meetstaten", dot: "#3a4459", soon: true },
  { href: "/h-architects", label: "H-Architects", dot: "#3a4459", soon: true },
];
const MARKETING: Item[] = [{ href: "/seo-sea", label: "SEO / SEA", icon: "◎", soon: true }];
const TEAM: Item[] = [
  { href: "/sales-team", label: "Sales team", icon: "◍" },
  { href: "/woordenboek", label: "Woordenboek", icon: "≣" },
  { href: "/applicaties", label: "Applicaties", icon: "⊞" },
];

export function Sidebar() {
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
        title={collapsed ? it.label : undefined}
        className={
          "relative flex items-center gap-2.5 rounded-lg py-2 text-[13.5px] transition " +
          (collapsed ? "justify-center px-0" : "px-2.5") +
          " " +
          (active
            ? "bg-gradient-to-r from-blue-600/25 to-blue-600/5 font-semibold text-white before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-blue-500 before:content-['']"
            : it.soon
              ? "text-slate-500 hover:bg-[#1b2333]"
              : "text-slate-300 hover:bg-[#1b2333]")
        }
      >
        {it.icon ? (
          <span className="w-4 text-center text-[14px] opacity-85">{it.icon}</span>
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.dot }} />
        )}
        {!collapsed && <span>{it.label}</span>}
        {!collapsed && it.soon && (
          <span className="ml-auto rounded border border-[#2a3446] px-1.5 py-px text-[9.5px] uppercase tracking-wide text-slate-500">
            soon
          </span>
        )}
      </Link>
    );
  };

  const group = (label: string, items: Item[]) => (
    <div key={label}>
      {collapsed ? (
        <div className="mx-2 my-2 border-t border-[#232c3d]" />
      ) : (
        <div className="px-2.5 pb-1.5 pt-4 text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate-500">
          {label}
        </div>
      )}
      {items.map(row)}
    </div>
  );

  return (
    <aside
      className={
        "sticky top-0 flex h-screen shrink-0 flex-col bg-[#0f1522] text-slate-300 transition-[width] duration-200 " +
        (collapsed ? "w-16" : "w-[250px]")
      }
    >
      <div className={"flex items-center gap-2.5 pb-4 pt-[18px] " + (collapsed ? "justify-center px-0" : "px-[18px]")}>
        <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-blue-600 to-indigo-400 text-[15px] font-extrabold text-white shadow-[0_2px_8px_rgba(43,80,214,.45)]">
          S
        </div>
        {!collapsed && <b className="text-[14.5px] font-semibold tracking-tight text-white">Sales dashboard</b>}
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {group("Overzicht", OVERZICHT)}
        {group("Afdelingen", AFDELINGEN)}
        {group("Marketing", MARKETING)}
        {group("Team", TEAM)}
      </nav>

      <div className="flex flex-col gap-2 border-t border-[#273040] p-3 text-[11.5px] text-slate-400">
        <button
          onClick={toggle}
          title={collapsed ? "Menu uitklappen" : "Menu inklappen"}
          className="flex items-center justify-center gap-2 rounded-lg py-2 text-slate-400 hover:bg-[#1b2333]"
        >
          <span className="text-[13px]">{collapsed ? "»" : "«"}</span>
          {!collapsed && <span>Inklappen</span>}
        </button>
        {!collapsed && (
          <>
            <div className="flex items-center gap-2 px-1">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(37,194,106,.16)]" />
              Verbonden · Pipedrive (alleen lezen)
            </div>
            <SyncButton variant="sidebar" />
          </>
        )}
      </div>
    </aside>
  );
}
