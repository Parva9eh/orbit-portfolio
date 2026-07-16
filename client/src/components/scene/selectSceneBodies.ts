import type { Asteroid, CelestialItem, Planet } from "@shared";
import { isAsteroid, sampleOrbitPath } from "@shared";
import type { CompareOrbitSpec } from "./types";
import { softOrbitColor } from "./math/sceneHelpers";
import { toThreePath } from "../../lib/vec3";
import { scalePosition } from "../../sim/simUtils";

export const INNER_PLANETS = new Set([
  "Mercury",
  "Venus",
  "Earth",
  "Mars",
]);

/** Keep planets mounted (visibility only) when switching Near-Earth. */
export function filterBodyPlanets(
  planetsData: Planet[],
  showPlanets: boolean
): Planet[] {
  if (showPlanets) return planetsData;
  return planetsData.filter((p) => p.name === "Earth");
}

export function isInnerOrEarth(name: string, nearEarth: boolean): boolean {
  return !nearEarth || INNER_PLANETS.has(name) || name === "Earth";
}

/** Orbits: hide outer in near-Earth; skip all when toggle off. */
export function filterOrbitPlanets(
  planetsData: Planet[],
  showPlanets: boolean,
  nearEarth: boolean
): Planet[] {
  if (!showPlanets) return [];
  if (!nearEarth) return planetsData;
  return planetsData.filter((p) => INNER_PLANETS.has(p.name));
}

export function filterSceneAsteroids(
  items: CelestialItem[],
  maxNeos: number
): Asteroid[] {
  return items.filter(isAsteroid).slice(0, maxNeos);
}

export function buildPlanetOrbitSpecs(
  orbitPlanets: Planet[],
  orbitSegments: number,
  trueScale: boolean
): { id: string; color: string; points: ReturnType<typeof toThreePath> }[] {
  return orbitPlanets.map((p) => ({
    id: p.id,
    color: softOrbitColor(p.color),
    points: toThreePath(
      sampleOrbitPath(p.orbit, orbitSegments).map((pt) =>
        scalePosition(pt, trueScale)
      )
    ),
  }));
}

/** Selected NEO orbit — skipped if already in compare set. */
export function buildSelectedAsteroidOrbit(
  selectedItem: CelestialItem | null,
  asteroids: Asteroid[],
  compareOrbits: CompareOrbitSpec[],
  orbitSegments: number,
  trueScale: boolean
): {
  id: string;
  hazardous: boolean;
  points: ReturnType<typeof toThreePath>;
} | null {
  if (!selectedItem || !isAsteroid(selectedItem)) return null;
  if (!asteroids.some((a) => a.id === selectedItem.id)) return null;
  if (compareOrbits.some((c) => c.id === selectedItem.id)) return null;
  return {
    id: selectedItem.id,
    hazardous: selectedItem.isHazardous,
    points: toThreePath(
      sampleOrbitPath(selectedItem.orbit, orbitSegments).map((pt) =>
        scalePosition(pt, trueScale)
      )
    ),
  };
}
