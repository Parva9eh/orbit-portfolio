import type { Asteroid } from "@shared";

/** Miss km for sort — unknowns sink to the end. */
export function missKmOf(a: Asteroid): number {
  const km = a.approach?.missKm;
  if (km != null && Number.isFinite(km) && km >= 0) return km;
  return Number.POSITIVE_INFINITY;
}

/** Closest approach first (Earth-relative briefing list). */
export function sortAsteroidsByMiss(list: Asteroid[]): Asteroid[] {
  return [...list].sort((a, b) => {
    const d = missKmOf(a) - missKmOf(b);
    if (d !== 0) return d;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function closestAsteroid(list: Asteroid[]): Asteroid | null {
  if (list.length === 0) return null;
  return sortAsteroidsByMiss(list)[0] ?? null;
}
