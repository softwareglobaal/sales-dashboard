"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      const total = (json.results || []).reduce((a: number, r: any) => a + (r.count || 0), 0);
      const errors = (json.results || []).filter((r: any) => r.status === "error");
      setMsg(
        errors.length
          ? `Klaar met ${errors.length} fout(en). ${total} deals opgehaald.`
          : `${total} deals opgehaald ✓`
      );
      router.refresh();
    } catch (e: any) {
      setMsg("Fout bij synchroniseren: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          onClick={sync}
          disabled={loading}
          className="w-full rounded-lg border border-[#2a3446] bg-[#1b2333] px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-[#232d40] disabled:opacity-50"
        >
          {loading ? "Bezig met ophalen…" : "↻ Data verversen"}
        </button>
        {msg && <span className="text-[11px] text-zinc-400">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Bezig met ophalen…" : "↻ Data verversen"}
      </button>
      {msg && <span className="text-sm text-zinc-600">{msg}</span>}
    </div>
  );
}
