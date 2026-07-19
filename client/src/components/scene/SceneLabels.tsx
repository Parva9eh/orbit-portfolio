import type { MutableRefObject } from "react";
import type { CelestialItem, Planet } from "@shared";
import { isAsteroid } from "@shared";
import * as THREE from "three";
import type { CompareOrbitSpec } from "./types";
import { DistanceLabel, SelectionLabel } from "./Labels";

type SceneLabelsProps = {
  showLabels: boolean;
  nearEarth: boolean;
  bodyPlanets: Planet[];
  isBodyVisible: (name: string) => boolean;
  selectedItem: CelestialItem | null;
  asteroids: { id: string }[];
  compareOrbits: CompareOrbitSpec[];
  livePos: MutableRefObject<Map<string, THREE.Vector3>>;
};

/**
 * Outline sprite labels for planets, compare set, selected NEO, and selection chip.
 */
export default function SceneLabels({
  showLabels,
  nearEarth,
  bodyPlanets,
  isBodyVisible,
  selectedItem,
  asteroids,
  compareOrbits,
  livePos,
}: SceneLabelsProps) {
  return (
    <>
      {showLabels &&
        compareOrbits.map((c) => (
          <DistanceLabel
            key={`lbl-cmp-${c.id}`}
            itemId={c.id}
            name={c.name}
            livePos={livePos}
            systemView={!nearEarth}
            priority="neo"
          />
        ))}

      {/*
        Outline-only sprite labels (no dark panels).
        System: all visible planets. Near-Earth: Earth + selection only.
        NEOs stay selected/compare-only (hover chip covers the rest).
      */}
      {showLabels &&
        bodyPlanets
          .filter((p) => isBodyVisible(p.name))
          .filter(
            (p) =>
              !nearEarth || p.name === "Earth" || selectedItem?.id === p.id
          )
          .map((p) => (
            <DistanceLabel
              key={`lbl-${p.id}`}
              itemId={p.id}
              name={p.name}
              livePos={livePos}
              systemView={!nearEarth}
              priority="body"
            />
          ))}

      {showLabels &&
        selectedItem &&
        isAsteroid(selectedItem) &&
        asteroids.some((a) => a.id === selectedItem.id) && (
          <DistanceLabel
            key={`lbl-neo-${selectedItem.id}`}
            itemId={selectedItem.id}
            name={selectedItem.name}
            livePos={livePos}
            systemView={!nearEarth}
            priority="neo"
          />
        )}

      {selectedItem && (
        <SelectionLabel selectedItem={selectedItem} livePos={livePos} />
      )}
    </>
  );
}
