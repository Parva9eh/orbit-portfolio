import type { Asteroid, CelestialItem, Planet, SbdbOrbitResult } from "@shared";
import {
  formatMiss,
  formatRulerDistance,
  isAsteroid,
  mergeAsteroidWithSbdb,
  sampleOrbitPath,
} from "@shared";
import type { CompareOrbitSpec } from "../components/ThreeDScene";
import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import { COMPARE_COLORS } from "../lib/urlState";
import { toThreePath } from "../lib/vec3";
import { scalePosition } from "../sim/simUtils";
import { sortAsteroidsByMiss } from "../lib/neoSort";

export function filterAsteroids(
  data: Asteroid[] | undefined,
  searchTerm: string,
  maxMissLd: number | null,
  minDiameterM: number | null
): Asteroid[] {
  let list = data ?? [];
  const q = searchTerm.trim().toLowerCase();
  if (q) {
    list = list.filter((neo) => (neo.name || "").toLowerCase().includes(q));
  }
  if (maxMissLd != null) {
    list = list.filter(
      (neo) =>
        neo.approach?.missLd != null && neo.approach.missLd <= maxMissLd
    );
  }
  if (minDiameterM != null) {
    const minKm = minDiameterM / 1000;
    list = list.filter((neo) => {
      const d = neo.diameterKmMax ?? neo.diameterKmMin ?? neo.size;
      return d != null && d >= minKm;
    });
  }
  return sortAsteroidsByMiss(list);
}

export function closestSummaryLine(closest: Asteroid | null): string | null {
  if (!closest) return null;
  const miss = closest.approach
    ? formatMiss(closest.approach.missLd, closest.approach.missKm, {
        compact: true,
      })
    : "—";
  return `${closest.name} @ ${miss}`;
}

export function resolveDisplaySelected(
  selectedItem: CelestialItem | null,
  sbdb: SbdbOrbitResult | null | undefined,
  sentrySceneBody: Asteroid | null
): CelestialItem | null {
  if (!selectedItem) return null;
  if (!isAsteroid(selectedItem)) return selectedItem;
  if (sentrySceneBody && selectedItem.id === sentrySceneBody.id) {
    return sentrySceneBody;
  }
  if (!sbdb?.found) return selectedItem;
  return mergeAsteroidWithSbdb(selectedItem, sbdb);
}

export function buildSceneItems(opts: {
  showPlanets: boolean;
  showAsteroids: boolean;
  planets: Planet[];
  filteredAsteroids: Asteroid[];
  displaySelected: CelestialItem | null;
  sentrySceneBody: Asteroid | null;
}): CelestialItem[] {
  const planets = opts.showPlanets ? opts.planets : [];
  let neos = opts.showAsteroids ? [...opts.filteredAsteroids] : [];
  if (
    opts.displaySelected &&
    isAsteroid(opts.displaySelected) &&
    opts.displaySelected.orbitSource === "sbdb"
  ) {
    neos = neos.map((n) =>
      n.id === opts.displaySelected!.id
        ? (opts.displaySelected as Asteroid)
        : n
    );
  }
  if (
    opts.sentrySceneBody &&
    !neos.some((n) => n.id === opts.sentrySceneBody!.id)
  ) {
    neos = [...neos, opts.sentrySceneBody];
  }
  return [...neos, ...planets];
}

export function buildCompareOrbits(opts: {
  compareIds: string[];
  catalog: Asteroid[];
  displaySelected: CelestialItem | null;
  orbitSegments: number;
  trueScale: boolean;
}): CompareOrbitSpec[] {
  if (opts.compareIds.length === 0) return [];
  const colors = [COMPARE_COLORS.a, COMPARE_COLORS.b] as const;
  const out: CompareOrbitSpec[] = [];
  for (let i = 0; i < opts.compareIds.length; i++) {
    const id = opts.compareIds[i];
    let a = opts.catalog.find((x) => x.id === id);
    if (
      opts.displaySelected &&
      isAsteroid(opts.displaySelected) &&
      opts.displaySelected.id === id
    ) {
      a = opts.displaySelected;
    }
    if (!a) continue;
    out.push({
      id: a.id,
      name: a.name,
      hazardous: a.isHazardous,
      color: colors[i] ?? COMPARE_COLORS.a,
      points: toThreePath(
        sampleOrbitPath(a.orbit, opts.orbitSegments).map((pt) =>
          scalePosition(pt, opts.trueScale)
        )
      ),
    });
  }
  return out;
}

export function rulerApproachMissLabel(
  rulerA: RulerEndpoint | null,
  rulerB: RulerEndpoint | null,
  catalog: Asteroid[],
  sentrySceneBody: Asteroid | null
): string | null {
  if (!rulerA || !rulerB) return null;
  const ids = [rulerA, rulerB];
  const neoEnd = ids.find(
    (p) => p.kind === "body" && p.id !== "planet:Earth"
  );
  const earthEnd = ids.find(
    (p) =>
      (p.kind === "body" && p.id === "planet:Earth") || p.name === "Earth"
  );
  if (!neoEnd || !earthEnd || neoEnd.kind !== "body") return null;
  const pool = [
    ...catalog,
    ...(sentrySceneBody ? [sentrySceneBody] : []),
  ];
  const neo = pool.find((a) => a.id === neoEnd.id);
  if (!neo?.approach) return null;
  return formatMiss(neo.approach.missLd, neo.approach.missKm);
}

export function rulerStatusLabel(
  rulerEnabled: boolean,
  rulerSceneDist: number | null
): string | null {
  if (!rulerEnabled || rulerSceneDist == null) return null;
  return formatRulerDistance(rulerSceneDist).label;
}
