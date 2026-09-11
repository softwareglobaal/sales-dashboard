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
    <div className="paneel">
      <div className="mb-3 flex items-center justify-between">
        <h2 style={{ fontSize: 18 }}>Notities en to-do (gedeeld, lokaal)</h2>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="knop-donker knop-klein"
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
        className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none"
      />
      {savedAt && (
        <p className="mt-1 text-xs text-zinc-400">
          Laatst opgeslagen: {new Date(savedAt).toLocaleString("nl-BE")}
        </p>
      )}
    </div>
  );
}
