"use client";

import { useRouter } from "next/navigation";

type Params = Record<string, string | undefined>;
type Option = { key: string; label: string };

function href(path: string, params: Params, overrides: Params): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

// Periode-knoppen
export function PeriodSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      {options.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            onClick={() => router.push(href(path, params, { period: o.key }))}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition " +
              (active ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-100")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Maand-keuzelijst (2026)
export function MonthSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const isMonth = /^2026-\d{2}$/.test(current);
  return (
    <select
      value={isMonth ? current : ""}
      onChange={(e) => e.target.value && router.push(href(path, params, { period: e.target.value }))}
      className={
        "rounded-lg border px-3 py-1.5 text-sm " +
        (isMonth ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-white text-zinc-600")
      }
    >
      <option value="">Maand 2026…</option>
      {options.map((o) => (
        <option key={o.key} value={o.key} className="bg-white text-zinc-800">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Week-keuzelijst (2026)
export function WeekSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const isWeek = /^wk:\d{4}-\d{2}-\d{2}$/.test(current);
  return (
    <select
      value={isWeek ? current : ""}
      onChange={(e) => e.target.value && router.push(href(path, params, { period: e.target.value }))}
      className={
        "rounded-lg border px-3 py-1.5 text-sm " +
        (isWeek ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-white text-zinc-600")
      }
    >
      <option value="">Week 2026…</option>
      {options.map((o) => (
        <option key={o.key} value={o.key} className="bg-white text-zinc-800">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Maand/Week-schakelaar
export function GranularitySelector({
  current,
  params,
  path = "/",
}: {
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const opts = [
    { key: "month", label: "Per maand" },
    { key: "week", label: "Per week" },
  ];
  return (
    <div className="inline-flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      {opts.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            onClick={() => router.push(href(path, params, { g: o.key }))}
            className={
              "rounded-md px-3 py-1 text-sm font-medium transition " +
              (active ? "bg-zinc-800 text-white" : "text-zinc-600 hover:bg-zinc-100")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Thema-keuzelijst
export function ThemeSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current || ""}
      onChange={(e) => router.push(href(path, params, { t: e.target.value || undefined }))}
      className={
        "rounded-lg border px-3 py-1.5 text-sm " +
        (current ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-200 bg-white text-zinc-600")
      }
    >
      <option value="">Alle thema&apos;s</option>
      {options.map((o) => (
        <option key={o.key} value={o.key} className="bg-white text-zinc-800">
          {o.label}
        </option>
      ))}
    </select>
  );
}

type PipelineOption = {
  account_key: string;
  accountName: string;
  pipeline: string;
  count: number;
};

// Keuzelijst voor de trechter
export function FunnelPicker({
  options,
  current,
  params,
  path = "/",
}: {
  options: PipelineOption[];
  current: string; // "account_key|||pipeline"
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => {
        const [acc, pipe] = e.target.value.split("|||");
        router.push(href(path, params, { fa: acc, fp: pipe }));
      }}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
    >
      {options.map((o) => (
        <option key={o.account_key + o.pipeline} value={`${o.account_key}|||${o.pipeline}`}>
          {o.accountName} — {o.pipeline} ({o.count})
        </option>
      ))}
    </select>
  );
}
