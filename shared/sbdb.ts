/** JPL SBDB (Small-Body DataBase) — normalized payload for client + server. */

import type { Asteroid, OrbitElements } from "./celestial";
import { auToSceneRadius } from "./orbit";

const DEG = Math.PI / 180;

export type SbdbOrbitResult = {
  found: boolean;
  /** Search string used */
  query: string;
  designation?: string;
  fullname?: string;
  /** Scene-ready Kepler elements (scene units / radians) */
  orbit?: OrbitElements;
  /** Physical / display elements (AU, deg, days) */
  aAu?: number;
  e?: number;
  iDeg?: number;
  periodDays?: number;
  periodYears?: number;
  moidAu?: number;
  pha?: boolean;
  neo?: boolean;
  orbitClass?: string;
  /** Human message when not found / multi-match */
  message?: string;
};

export type SbdbElement = {
  name?: string;
  value?: string | number | null;
};

/** Pull a named element value from SBDB `orbit.elements` array. */
export function sbdbElementValue(
  elements: SbdbElement[] | undefined,
  name: string
): number | null {
  if (!elements?.length) return null;
  const hit = elements.find((el) => el.name === name);
  if (!hit || hit.value == null || hit.value === "") return null;
  const n = typeof hit.value === "number" ? hit.value : parseFloat(String(hit.value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Map SBDB osculating elements → scene OrbitElements.
 * a (au), e, i (deg), ma (deg), per (days).
 */
export function orbitFromSbdbElements(
  elements: SbdbElement[],
  /** Keep prior phase if MA missing so body doesn't jump to origin-ish */
  fallbackPhase = 0
): {
  orbit: OrbitElements;
  aAu: number;
  e: number;
  iDeg: number;
  periodDays: number;
  periodYears: number;
} | null {
  const aAu = sbdbElementValue(elements, "a");
  const e = sbdbElementValue(elements, "e") ?? 0;
  const iDeg = sbdbElementValue(elements, "i") ?? 0;
  const maDeg = sbdbElementValue(elements, "ma");
  const perDays = sbdbElementValue(elements, "per");

  if (aAu == null || aAu <= 0) return null;

  const periodYears =
    perDays != null && perDays > 0
      ? perDays / 365.25
      : Math.pow(aAu, 1.5); // Kepler fallback

  const phase =
    maDeg != null && Number.isFinite(maDeg) ? maDeg * DEG : fallbackPhase;

  return {
    orbit: {
      semiMajorAxis: auToSceneRadius(aAu),
      eccentricity: Math.min(0.85, Math.max(0, e)),
      inclination: iDeg * DEG,
      phase,
      periodYears: Math.max(0.05, periodYears),
    },
    aAu,
    e: Math.max(0, e),
    iDeg,
    periodDays: perDays ?? periodYears * 365.25,
    periodYears: Math.max(0.05, periodYears),
  };
}

/** Merge SBDB result into an existing NeoWs asteroid (keeps approach metrics). */
export function mergeAsteroidWithSbdb(
  base: Asteroid,
  sbdb: SbdbOrbitResult
): Asteroid {
  if (!sbdb.found || !sbdb.orbit) return base;
  return {
    ...base,
    orbit: sbdb.orbit,
    orbitSource: "sbdb",
    designation: sbdb.designation ?? base.designation,
    isHazardous: sbdb.pha != null ? sbdb.pha : base.isHazardous,
  };
}

/** Clean NeoWs name → SBDB sstr (strip parentheses, extra spaces). */
export function designationForSbdb(asteroid: Pick<Asteroid, "designation" | "name">): string {
  const raw = (asteroid.designation || asteroid.name || "").trim();
  return raw.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}
