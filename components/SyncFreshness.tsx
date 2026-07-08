import { getSyncStatus } from "@/lib/queries";
import { dateTime } from "@/lib/format";

// Prominente "laatst bijgewerkt"-indicator met kleur-gecodeerde versheid.
// Mehdi wil in één oogopslag zien of de data recent is of verouderd.
export function SyncFreshness() {
  const statuses = getSyncStatus();
  const last = statuses
    .map((s) => s.last_sync)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  if (!last) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11.5px] font-medium text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Nog nooit gesynchroniseerd
      </span>
    );
  }

  const then = new Date(last.replace(" ", "T")).getTime();
  const hours = (Date.now() - then) / 36e5;

  let tone: "green" | "amber" | "red";
  let ago: string;
  if (hours < 24) {
    tone = "green";
    ago = hours < 1 ? "zojuist" : `${Math.round(hours)} u geleden`;
  } else {
    const days = Math.round(hours / 24);
    ago = `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
    tone = days <= 2 ? "amber" : "red";
  }

  const cls = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  const dot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];

  return (
    <span
      title={`Laatst gesynchroniseerd: ${dateTime(last)}`}
      className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium " + cls}
    >
      <span className={"h-1.5 w-1.5 rounded-full " + dot} />
      Bijgewerkt: {ago}
      {tone === "red" && <span className="font-semibold">· ververs de data</span>}
    </span>
  );
}
