"use client";

import { useRouter } from "next/navigation";

export function MaandKeuze({ opties, huidig, basis }: { opties: { key: string; label: string }[]; huidig: string; basis: string }) {
  const router = useRouter();
  const isMaand = /^\d{4}-\d{2}$/.test(huidig);
  return (
    <select
      value={isMaand ? huidig : ""}
      onChange={(e) => {
        const u = new URL(basis, "http://x");
        if (e.target.value) u.searchParams.set("periode", e.target.value);
        else u.searchParams.delete("periode");
        router.push(u.pathname + (u.search || ""));
      }}
      className="knop-licht knop-klein"
      style={{ paddingRight: 10, cursor: "pointer" }}
      aria-label="Kies een maand"
    >
      <option value="">Maand…</option>
      {opties.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
