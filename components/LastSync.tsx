import { getSyncStatus } from "@/lib/queries";
import { dateTime } from "@/lib/format";

export function LastSync() {
  const statuses = getSyncStatus();
  const last = statuses
    .map((s) => s.last_sync)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;
  return (
    <p className="mt-10 text-center text-xs text-zinc-400">
      Laatst gesynchroniseerd: {dateTime(last || null)} · data komt uit Pipedrive (alleen lezen)
    </p>
  );
}
