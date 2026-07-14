/** Calendar helpers for approach timeline (local calendar days, ISO YYYY-MM-DD). */

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local midnight (avoids UTC shift surprises). */
export function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoLocal(iso);
  d.setDate(d.getDate() + days);
  return formatIsoLocal(d);
}

/** Inclusive window of `count` days starting at `startIso` (default today). */
export function dayWindow(startIso: string, count = 7): string[] {
  return Array.from({ length: count }, (_, i) => addDaysIso(startIso, i));
}

/** Short chip label: "Today" | "Wed 16" */
export function dayChipLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today";
  const d = parseIsoLocal(iso);
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${wd} ${d.getDate()}`;
}

export function dayChipTitle(iso: string): string {
  return parseIsoLocal(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
