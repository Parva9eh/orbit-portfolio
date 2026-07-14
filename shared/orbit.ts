import type { OrbitElements, Vec3 } from "./celestial";

/** Earth orbital year duration in simulation seconds (tunable feel). */
export const EARTH_YEAR_SECONDS = 48;

/**
 * Compress AU distances into a viewable scene.
 * Mercury ≈ 8, Earth ≈ 14, Jupiter ≈ 36, Neptune ≈ 88.
 */
export function auToSceneRadius(au: number): number {
  return 14 * Math.pow(Math.max(au, 0.05), 0.55);
}

/** Log-compress planet radii so Jupiter doesn't swallow the scene. */
export function earthRadiiToDisplaySize(earthRadii: number): number {
  return 0.55 + Math.log10(earthRadii + 1) * 1.35;
}

/**
 * Map NEO miss distance (km) to a comfortable orbit radius around the sun.
 */
export function missKmToSceneRadius(missKm: number): number {
  const safe = Math.max(missKm, 1);
  return 18 + Math.min(70, Math.log10(safe) * 9);
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mean motion (rad / sim-second) from period in Earth-years. */
export function meanMotion(periodYears: number): number {
  const years = Math.max(periodYears, 0.05);
  return (Math.PI * 2) / (years * EARTH_YEAR_SECONDS);
}

/** Clamp eccentricity so polar radius stays stable. */
function clampE(e: number): number {
  if (!Number.isFinite(e) || e < 0) return 0;
  return Math.min(e, 0.85);
}

/**
 * In-plane polar position (periapsis along +X), then incline about +X.
 * Path sampling and live motion MUST share this so rings/lines match bodies.
 */
function orbitalPoint(
  a: number,
  e: number,
  inclination: number,
  trueAnomaly: number
): Vec3 {
  const ecc = clampE(e);
  const r = (a * (1 - ecc * ecc)) / (1 + ecc * Math.cos(trueAnomaly));
  const x = r * Math.cos(trueAnomaly);
  const zOrb = r * Math.sin(trueAnomaly);
  // Rotate about X by inclination (line of nodes = X axis)
  const y = -zOrb * Math.sin(inclination);
  const z = zOrb * Math.cos(inclination);
  return { x, y, z };
}

/**
 * Live body position from orbital elements + simulation time.
 * Mean anomaly advances with time; small-e approx for true anomaly.
 */
export function positionOnOrbit(elements: OrbitElements, t: number): Vec3 {
  const { semiMajorAxis: a, eccentricity, inclination, phase } = elements;
  const M = phase + meanMotion(elements.periodYears) * t;
  const e = clampE(eccentricity);
  // First-order approximation M → ν (fine for e ≲ 0.3)
  const nu = M + 2 * e * Math.sin(M);
  return orbitalPoint(a, e, inclination, nu);
}

/**
 * How many polyline segments for a smooth ring (avoids “broken chord” ellipses).
 * Larger semi-major axes need more samples so world-space chord length stays small.
 */
export function orbitSegmentCount(
  semiMajorAxis: number,
  qualitySegments: number
): number {
  const a = Math.max(1, semiMajorAxis);
  // Outer planets get more samples so chords stay short in world space
  const adaptive = Math.round(qualitySegments * Math.sqrt(a / 14));
  return Math.min(1536, Math.max(192, adaptive, qualitySegments));
}

/**
 * Static closed orbit polyline for rendering.
 * Samples true anomaly evenly so the ellipse is geometrically correct
 * (independent of phase — phase only sets where the body starts).
 *
 * Returns an open list of `n` unique points (first ≠ last). The renderer
 * should close the ring; double-closing caused tiny overlapping stubs.
 */
export function sampleOrbitPath(
  elements: OrbitElements,
  segments = 256
): Vec3[] {
  const { semiMajorAxis: a, eccentricity, inclination } = elements;
  if (!Number.isFinite(a) || a <= 0) return [];

  const n = orbitSegmentCount(a, Math.max(16, segments));
  const pts: Vec3[] = [];
  // i = 0 … n-1 only — do NOT repeat the start point (renderer closes the loop)
  for (let i = 0; i < n; i++) {
    const nu = (i / n) * Math.PI * 2;
    pts.push(orbitalPoint(a, eccentricity, inclination, nu));
  }
  return pts;
}

/** Spin angle (radians) from sidereal days; negative days → retrograde. */
export function spinAngle(spinDays: number, t: number): number {
  const EARTH_SPIN_SECONDS = 2.2;
  const days = spinDays === 0 ? 1 : spinDays;
  const period = EARTH_SPIN_SECONDS * Math.abs(days);
  const dir = days < 0 ? -1 : 1;
  return dir * ((t / period) * Math.PI * 2);
}

export function asteroidTumble(
  spinRate: number,
  t: number,
  seed: number
): { x: number; y: number; z: number } {
  const s = spinRate * (0.6 + (seed % 10) * 0.05);
  return {
    x: t * 0.35 * s,
    y: t * 0.55 * s,
    z: t * 0.25 * s,
  };
}
