import type { Asteroid } from "@shared";

/** Resolve a deep-link or list ref to a catalog asteroid. */
export function findAsteroidByRef(
  list: Asteroid[],
  ref: string
): Asteroid | undefined {
  const q = ref.trim().toLowerCase();
  return list.find(
    (a) =>
      a.id.toLowerCase() === q ||
      a.designation?.toLowerCase() === q ||
      a.name.replace(/[()]/g, "").trim().toLowerCase() === q ||
      a.name.toLowerCase() === q
  );
}
