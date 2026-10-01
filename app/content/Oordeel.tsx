"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Oordeel({ kansId }: { kansId: string }) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const stuur = async (goed: boolean) => {
    setBezig(true);
    setFout(null);
    const r = await fetch("/api/content/oordeel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kans_id: kansId, goed }),
    });
    setBezig(false);
    if (!r.ok) setFout((await r.json().catch(() => ({})))?.error || `fout ${r.status}`);
    else router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="knop-donker knop-klein" disabled={bezig} onClick={() => stuur(true)}>
        Goedkeuren
      </button>
      <button className="knop-licht knop-klein" disabled={bezig} onClick={() => stuur(false)}>
        Afwijzen
      </button>
      {fout && <span className="text-[12px]" style={{ color: "var(--kritiek)" }}>{fout}</span>}
    </div>
  );
}
