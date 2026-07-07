"use client";

import { useEffect, useState } from "react";

export function NotesPanel() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content || "");
        setSavedAt(d.updatedAt || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json();
      setSavedAt(d.updatedAt || new Date().toISOString());
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">📝 Notities / to-do (gedeeld, lokaal)</h3>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? "Opslaan…" : dirty ? "Opslaan" : "Opgeslagen"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        disabled={!loaded}
        rows={5}
        placeholder="Bv. openstaande vragen, ideeën, dingen om samen te bespreken…"
        className="w-full resize-y rounded-lg border border-zinc-200 p-3 text-sm text-zinc-800 focus:border-blue-400 focus:outline-none"
      />
      {savedAt && (
        <p className="mt-1 text-xs text-zinc-400">
          Laatst opgeslagen: {new Date(savedAt).toLocaleString("nl-BE")}
        </p>
      )}
    </div>
  );
}
