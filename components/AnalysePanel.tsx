"use client";

import { useState } from "react";

// Minimale, veilige Markdown-render (## kop, ### subkop, - opsomming, **vet**).
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={"ul" + out.length} className="my-2 ml-1 space-y-1.5">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-zinc-700">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{inline(li)}</span>
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const inline = (t: string): React.ReactNode => {
    const parts = t.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold text-zinc-900">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^-\s+/.test(line)) {
      list.push(line.replace(/^-\s+/, ""));
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) {
      out.push(
        <h4 key={out.length} className="mt-4 mb-1 text-[13px] font-semibold text-zinc-800">
          {inline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h3 key={out.length} className="mt-5 mb-1.5 flex items-center gap-2 text-[15px] font-bold text-zinc-900 first:mt-0">
          {inline(line.slice(3))}
        </h3>
      );
    } else {
      out.push(
        <p key={out.length} className="my-1.5 text-[13.5px] leading-relaxed text-zinc-700">
          {inline(line)}
        </p>
      );
    }
  }
  flush();
  return out;
}

export function AnalysePanel({ period, themeKey, scope }: { period: string; themeKey?: string; scope?: string }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const filterKey = period + "|" + (themeKey || "") + "|" + (scope || "all");
  const stale = text != null && generatedFor !== filterKey;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, t: themeKey || "", sc: scope || "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Er ging iets mis.");
        setText(null);
      } else {
        setText(data.text);
        setGeneratedFor(filterKey);
      }
    } catch {
      setError("Kon geen verbinding maken met de server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="analyse" className="mb-8 scroll-mt-40">
      <div className="overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm">
        <div className={"flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" + (open ? " border-b border-indigo-100" : "")}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={open ? "Inklappen" : "Uitklappen"}
            className="flex flex-1 items-center gap-2.5 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-[15px] text-white shadow-sm">
              ✦
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-zinc-900">
                Analyse &amp; advies
                {!open && text && <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[10px] font-medium text-indigo-700">analyse klaar</span>}
              </div>
              <div className="text-[11.5px] text-zinc-500">Door Claude · op basis van de cijfers voor de gekozen periode</div>
            </div>
            <span className={"ml-1 text-zinc-400 transition-transform " + (open ? "rotate-180" : "")}>▾</span>
          </button>
          {open && (
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Bezig…
                </>
              ) : text ? (
                "Opnieuw genereren"
              ) : (
                "Genereer analyse"
              )}
            </button>
          )}
        </div>

        {open && (
        <div className="px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>
          )}

          {!text && !error && !loading && (
            <p className="py-4 text-center text-[13px] text-zinc-500">
              Klik op <b>Genereer analyse</b> voor een korte analyse en 3–5 concrete acties voor deze periode.
            </p>
          )}

          {loading && !text && (
            <div className="space-y-2 py-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
            </div>
          )}

          {text && (
            <>
              {stale && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  De filters zijn gewijzigd sinds deze analyse. Klik op <b>Opnieuw genereren</b> voor de nieuwe periode.
                </div>
              )}
              <div className="max-w-none">{renderMarkdown(text)}</div>
              <p className="mt-4 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
                AI-gegenereerd op basis van geaggregeerde cijfers (geen klant- of dealnamen verstuurd). Controleer belangrijke
                beslissingen altijd zelf.
              </p>
            </>
          )}
        </div>
        )}
      </div>
    </section>
  );
}
