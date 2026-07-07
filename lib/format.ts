export function euro(n: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function euroShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `€ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `€ ${Math.round(n / 1_000)}k`;
  return `€ ${Math.round(n)}`;
}

export function num(n: number): string {
  return new Intl.NumberFormat("nl-BE").format(n || 0);
}

export function pct(n: number): string {
  return `${Math.round((n || 0) * 100)}%`;
}

export function dateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
