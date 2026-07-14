/** Shared celestial domain model (client + server). */

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

/** Kepler-style elements used for animation (scene units / radians). */
export type OrbitElements = {
  /** Semi-major axis in scene units */
  semiMajorAxis: number;
  /** 0 = circle */
  eccentricity: number;
  /** Orbital inclination (radians) */
  inclination: number;
  /** Mean anomaly at t=0 (radians) */
  phase: number;
  /**
   * Orbital period in Earth-years (Earth = 1).
   * Client maps this to animation speed.
   */
  periodYears: number;
};

/**
 * Close-approach briefing fields from NASA NeoWs (or mock).
 * Used by Body Inspector + Earth-relative HUD — not for navigation.
 */
export type CloseApproach = {
  /** Approach epoch (ms since Unix epoch, UTC) when known */
  epochMs: number | null;
  /** ISO date string YYYY-MM-DD or full NeoWs datetime */
  dateIso: string;
  missKm: number;
  missAu: number;
  /** Lunar distances ≈ missKm / 384_400 */
  missLd: number;
  relativeVelocityKmS: number;
  orbitingBody?: string;
};

/** Mean Earth–Moon distance used for LD conversion. */
export const LUNAR_DISTANCE_KM = 384_400;

export type Asteroid = {
  kind: "asteroid";
  id: string;
  name: string;
  /** Rest / reference position (t≈0 on its orbit) */
  position: Vec3;
  /**
   * Display / size seed. For NeoWs this is max estimated diameter in km
   * (scene scales it separately for meshes).
   */
  size: number;
  isHazardous: boolean;
  orbit: OrbitElements;
  /** Relative spin rate (1 = moderate tumble) */
  spinRate: number;
  /** Estimated diameter range (km) from NeoWs when available */
  diameterKmMin?: number;
  diameterKmMax?: number;
  /** Primary Earth close approach (feed window) */
  approach?: CloseApproach;
  /**
   * Orbit provenance for UI honesty.
   * - approx: placement estimate from miss distance / hash
   * - sbdb: JPL SBDB elements (P3+)
   * - mock: local mock catalog
   */
  orbitSource?: "approx" | "sbdb" | "mock";
  /** Clean designation for SBDB/Sentry lookups (optional) */
  designation?: string;
};

export type Planet = {
  kind: "planet";
  id: string;
  name: string;
  /** Position at simulation t=0 */
  position: Vec3;
  /** Display radius in scene units (already log-compressed) */
  size: number;
  /** Earth radii (physical relative size, for UI) */
  earthRadii: number;
  period: number;
  color?: number;
  orbit: OrbitElements;
  /**
   * Sidereal rotation period in Earth days.
   * Negative = retrograde (Venus, Uranus-ish spin sense handled via tilt).
   */
  spinDays: number;
  /** Axial tilt in radians */
  axialTilt: number;
  hasRings?: boolean;
};

export type CelestialItem = Asteroid | Planet;

export function isAsteroid(item: CelestialItem): item is Asteroid {
  return item.kind === "asteroid";
}

export function isPlanet(item: CelestialItem): item is Planet {
  return item.kind === "planet";
}

export function defaultOrbitFromPosition(position: Vec3): OrbitElements {
  const r = Math.hypot(position.x, position.y, position.z) || 1;
  const phase = Math.atan2(position.z, position.x);
  const inclination = Math.asin(
    Math.max(-1, Math.min(1, position.y / r))
  );
  return {
    semiMajorAxis: Math.hypot(position.x, position.z) || r,
    eccentricity: 0,
    inclination,
    phase,
    periodYears: Math.max(0.1, Math.pow(r / 14, 1.5)),
  };
}

/** Normalize legacy mock rows that lack kind/id/orbit. */
export function asAsteroid(
  raw: Partial<Asteroid> & {
    name: string;
    position: Vec3;
    size: number;
  }
): Asteroid {
  const orbit = raw.orbit ?? defaultOrbitFromPosition(raw.position);
  return {
    kind: "asteroid",
    id: raw.id ?? `asteroid:${raw.name}`,
    name: raw.name,
    position: raw.position,
    size: raw.size,
    isHazardous: Boolean(raw.isHazardous),
    orbit,
    spinRate: raw.spinRate ?? 1,
    diameterKmMin: raw.diameterKmMin,
    diameterKmMax: raw.diameterKmMax,
    approach: raw.approach,
    orbitSource: raw.orbitSource,
    designation: raw.designation,
  };
}

/** Build CloseApproach from raw miss/velocity numbers. */
export function makeCloseApproach(input: {
  dateIso?: string;
  epochMs?: number | null;
  missKm: number;
  missAu?: number;
  relativeVelocityKmS?: number;
  orbitingBody?: string;
}): CloseApproach {
  const missKm = Math.max(0, input.missKm);
  const missAu =
    input.missAu != null && Number.isFinite(input.missAu)
      ? input.missAu
      : missKm / 149_597_870.7;
  return {
    epochMs: input.epochMs ?? null,
    dateIso: input.dateIso ?? "",
    missKm,
    missAu,
    missLd: missKm / LUNAR_DISTANCE_KM,
    relativeVelocityKmS: Math.max(0, input.relativeVelocityKmS ?? 0),
    orbitingBody: input.orbitingBody ?? "Earth",
  };
}

export function asPlanet(
  raw: Partial<Planet> & {
    name: string;
    position: Vec3;
    size: number;
    period: number;
  }
): Planet {
  const fromPos = defaultOrbitFromPosition(raw.position);
  const orbit: OrbitElements = raw.orbit ?? {
    ...fromPos,
    periodYears: raw.period,
    semiMajorAxis: fromPos.semiMajorAxis || 10,
  };

  return {
    kind: "planet",
    id: raw.id ?? `planet:${raw.name}`,
    name: raw.name,
    position: raw.position,
    size: raw.size,
    earthRadii: raw.earthRadii ?? raw.size * 10,
    period: raw.period,
    color: raw.color,
    orbit: {
      ...orbit,
      periodYears: orbit.periodYears || raw.period,
    },
    spinDays: raw.spinDays ?? 1,
    axialTilt: raw.axialTilt ?? 0,
    hasRings: raw.hasRings ?? raw.name === "Saturn",
  };
}
