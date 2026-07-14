/**
 * Build a scene-capable Asteroid from Sentry + SBDB for objects not on NeoWs.
 */
import type { Asteroid, SbdbOrbitResult, SentryWatchItem } from "@shared";
import { asAsteroid, mergeAsteroidWithSbdb, positionOnOrbit } from "@shared";

export function sentrySceneId(des: string): string {
  return `sentry:${des.trim()}`;
}

export function isSentrySceneId(id: string): boolean {
  return id.startsWith("sentry:");
}

/** Create / upgrade a synthetic NEO for the scene from SBDB elements. */
export function asteroidFromSentrySbdb(
  des: string,
  sbdb: SbdbOrbitResult,
  summary?: SentryWatchItem | null
): Asteroid | null {
  if (!sbdb.found || !sbdb.orbit) return null;

  const name = sbdb.fullname || summary?.fullname || `(${des})`;
  const sizeKm = Math.max(
    0.02,
    summary?.diameterKm ?? 0.12
  );

  const base = asAsteroid({
    id: sentrySceneId(des),
    name,
    designation: sbdb.designation ?? des,
    position: positionOnOrbit(sbdb.orbit, 0),
    size: sizeKm,
    // Not a PHA flag from Sentry alone — keep false unless already known
    isHazardous: false,
    orbit: sbdb.orbit,
    orbitSource: "sbdb",
    diameterKmMin: sizeKm * 0.7,
    diameterKmMax: sizeKm,
    spinRate: 0.8,
  });

  return mergeAsteroidWithSbdb(base, sbdb);
}
