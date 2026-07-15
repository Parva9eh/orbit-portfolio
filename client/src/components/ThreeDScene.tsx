/**
 * Solar system scene — textures: Solar System Scope (CC BY 4.0)
 * https://www.solarsystemscope.com/textures/
 */
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CelestialItem, Planet } from "@shared";
import { isAsteroid, sampleOrbitPath } from "@shared";
import type { IssPosition } from "@shared";
import { useSimSettings } from "../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../sim/simUtils";
import { toThreePath } from "../lib/vec3";
import CameraDirector from "./scene/CameraDirector";
import {
  EXTRA_MAPS,
  PLANET_ALBEDO,
  preloadTextures,
  preloadBootTextures,
  preloadEarthTextures,
} from "./scene/textureCache";
import IssMarker from "./scene/IssMarker";
import MeasureLine from "./scene/MeasureLine";
import { softOrbitColor } from "./scene/math/sceneHelpers";
import MilkyWaySky from "./scene/MilkyWaySky";
import RealisticStars from "./scene/RealisticStars";
import ZodiacalDust from "./scene/ZodiacalDust";
import Sun from "./scene/Sun";
import OrbitLine from "./scene/OrbitLine";
import EarthBody from "./scene/Earth";
import PlanetBody from "./scene/PlanetBody";
import { OrbitProgressMarker, MotionTrail } from "./scene/MotionTrail";
import AsteroidBelt from "./scene/AsteroidBelt";
import { DistanceLabel, SelectionLabel } from "./scene/Labels";
import NeoInstances from "./scene/NeoInstances";
import { SceneBackdrop } from "./scene/SceneBackdrop";
export { SceneBackdrop };
import type { CompareOrbitSpec } from "./scene/types";


/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export type { CompareOrbitSpec } from "./scene/types";

export type ThreeDSceneProps = {
  items?: CelestialItem[];
  onItemClick: (item: CelestialItem) => void;
  selectedItem: CelestialItem | null;
  showPlanets: boolean;
  planetsData?: Planet[];
  /** P4 — up to 2 NEO orbits drawn for compare (may include non-selected) */
  compareOrbits?: CompareOrbitSpec[];
  /** P5 — live ISS (Near-Earth schematic) */
  showIss?: boolean;
  iss?: IssPosition | null;
  /** Tight Earth–ISS view: larger station, LEO ring, hide NEO clutter */
  issFocus?: boolean;
  /** P6 — distance ruler endpoints (body id or "sun") */
  measureAId?: string | null;
  measureBId?: string | null;
  onMeasureDistance?: (sceneDist: number | null) => void;
};

const ThreeDScene = React.memo(function ThreeDScene({
  items = [],
  onItemClick,
  selectedItem,
  showPlanets,
  planetsData = [],
  compareOrbits = [],
  showIss = false,
  iss = null,
  issFocus = false,
  measureAId = null,
  measureBId = null,
  onMeasureDistance,
}: ThreeDSceneProps) {
  const { gl } = useThree();
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const { trueScale, showLabels, quality, cameraMode, viewScale } =
    useSimSettings();
  const q = qualitySettings(quality);
  const nearEarth = viewScale === "nearEarth";
  const earthRadiusRef = useRef(1.2);
  const issEarthPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    // Boot: only sun + sky (and Earth soon after). Outer planets wait for System view.
    preloadBootTextures();
    preloadEarthTextures();
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = q.exposure;
    const maxDpr = q.dprMax;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  }, [gl, quality, q.dprMax, q.exposure]);

  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const livePos = useRef(new Map<string, THREE.Vector3>());
  const earthPosRef = useRef(new THREE.Vector3(14, 0, 0));

  const INNER_PLANETS = useMemo(
    () => new Set(["Mercury", "Venus", "Earth", "Mars"]),
    [],
  );

  /**
   * Keep planets mounted (visibility only) when switching Near-Earth —
   * unmounting remounts React trees and flashes Bloom/postprocessing.
   * - showPlanets on  → full set (outer hidden via visible in near-Earth)
   * - showPlanets off → Earth (+ Moon) only
   */
  const bodyPlanets = useMemo(() => {
    if (showPlanets) return planetsData;
    return planetsData.filter((p) => p.name === "Earth");
  }, [planetsData, showPlanets]);

  const isBodyVisible = (name: string) =>
    !nearEarth || INNER_PLANETS.has(name) || name === "Earth";

  // Orbits: hide outer in near-Earth; skip all when toggle off
  const orbitPlanets = useMemo(() => {
    if (!showPlanets) return [] as Planet[];
    if (!nearEarth) return planetsData;
    return planetsData.filter((p) => INNER_PLANETS.has(p.name));
  }, [showPlanets, nearEarth, planetsData, INNER_PLANETS]);

  /**
   * Warm textures for **visible** bodies only.
   * Near-Earth → inner + Earth. System → full set.
   * Outer maps stay cold until System view (isBodyVisible flips them on).
   */
  useEffect(() => {
    const srgb: string[] = [EXTRA_MAPS.sun, EXTRA_MAPS.milkyWay];
    let needEarth = false;

    for (const p of bodyPlanets) {
      if (!isBodyVisible(p.name)) continue;

      if (p.name === "Earth") {
        needEarth = true;
        continue;
      }

      const albedo = PLANET_ALBEDO[p.name];
      if (albedo) srgb.push(albedo);
      if (p.name === "Venus") srgb.push(EXTRA_MAPS.venusAtmo);
      if (p.hasRings || p.name === "Saturn") srgb.push(EXTRA_MAPS.saturnRing);
    }

    if (needEarth) preloadEarthTextures();
    preloadTextures(srgb, true);
  }, [bodyPlanets, nearEarth]);

  const asteroids = useMemo(() => {
    const list = items.filter(isAsteroid);
    return list.slice(0, q.maxNeos);
  }, [items, q.maxNeos]);

  const planetOrbits = useMemo(
    () =>
      orbitPlanets.map((p) => ({
        id: p.id,
        color: softOrbitColor(p.color),
        points: toThreePath(
          sampleOrbitPath(p.orbit, q.orbitSegments).map((pt) =>
            scalePosition(pt, trueScale),
          ),
        ),
      })),
    [orbitPlanets, trueScale, q.orbitSegments],
  );

  /** Selected NEO orbit — skipped if already in compare set (compare draws it). */
  const selectedAsteroidOrbit = useMemo(() => {
    if (!selectedItem || !isAsteroid(selectedItem)) return null;
    if (!asteroids.some((a) => a.id === selectedItem.id)) return null;
    if (compareOrbits.some((c) => c.id === selectedItem.id)) return null;
    return {
      id: selectedItem.id,
      hazardous: selectedItem.isHazardous,
      points: toThreePath(
        sampleOrbitPath(selectedItem.orbit, q.orbitSegments).map((pt) =>
          scalePosition(pt, trueScale),
        ),
      ),
    };
  }, [selectedItem, asteroids, trueScale, q.orbitSegments, compareOrbits]);

  useFrame(() => {
    // Track Earth for near-Earth camera + ISS placement
    const ep = livePos.current.get("planet:Earth");
    if (ep) {
      earthPosRef.current.copy(ep);
      issEarthPos.copy(ep);
    }
    const earthPlanet =
      planetsData.find((p) => p.name === "Earth") ??
      bodyPlanets.find((p) => p.name === "Earth");
    if (earthPlanet) {
      earthRadiusRef.current = scaleSize(earthPlanet.size, trueScale);
    }
  });


  return (
    <group>
      {/* background/fog set by SceneBackdrop (outside Suspense) for dark first paint */}

      <ambientLight intensity={0.14} />
      <hemisphereLight args={["#3a4a68", "#0c0a08", 0.28]} />

      {q.enableMilkyWay && <MilkyWaySky />}
      <RealisticStars count={q.starCount} radius={320} depth={100} />
      {/* Zodiacal — cinematic System only (in Near-Earth it reads as a golden fog wall) */}
      {q.enableShafts && !nearEarth && !issFocus && <ZodiacalDust />}
      {/* Main belt is a different population — hide in Near-Earth NEO view */}
      <group visible={!nearEarth && !issFocus}>
        <AsteroidBelt trueScale={trueScale} count={q.beltCount} />
      </group>
      {/* Dim the sun in ISS focus so Earth + station read clearly */}
      <group visible={!issFocus || !nearEarth}>
        <Sun meshRef={sunMeshRef} />
      </group>
      {issFocus && nearEarth && (
        <ambientLight intensity={0.55} />
      )}

      {!issFocus &&
        planetOrbits.map((o) => (
          <OrbitLine
            key={`p-orbit-${o.id}`}
            points={o.points}
            color={o.color}
            opacity={nearEarth ? 0.58 : 0.52}
            lineWidth={q.orbitLineWidth}
            selected={selectedItem?.id === o.id}
          />
        ))}

      {bodyPlanets.map((p) => {
        const vis = isBodyVisible(p.name);
        if (p.name === "Earth") {
          return (
            <group key={p.id} visible={vis}>
              <EarthBody
                planet={p}
                livePos={livePos}
                selected={selectedItem?.id === p.id}
                onClick={() => onItemClick(p)}
              />
              {/* P5 — ISS schematic LEO marker (Near-Earth only) */}
              {/* Ring + craft as soon as Show ISS is on — do not wait for /api/iss */}
              {showIss && nearEarth && vis && (
                <IssMarker
                  iss={iss}
                  earthPos={issEarthPos}
                  earthDisplayRadius={
                    // Prefer live Earth radius; stable fallback so ring isn't tiny/zero
                    earthRadiusRef.current > 0.2
                      ? earthRadiusRef.current
                      : scaleSize(
                          planetsData.find((p) => p.name === "Earth")?.size ??
                            1.2,
                          trueScale
                        )
                  }
                  focusMode={issFocus}
                />
              )}
            </group>
          );
        }
        // ISS focus: only Earth (and ISS) — hide other planets
        if (issFocus) return null;
        return (
          <group key={p.id} visible={vis}>
            <PlanetBody
              planet={p}
              livePos={livePos}
              selected={selectedItem?.id === p.id}
              onClick={() => onItemClick(p)}
            />
          </group>
        );
      })}

      {/* P4 compare orbits — hide during ISS focus */}
      {!issFocus &&
        compareOrbits.map((c) => (
          <OrbitLine
            key={`cmp-orbit-${c.id}`}
            points={c.points}
            color={c.color}
            opacity={0.85}
            lineWidth={q.orbitLineWidth * 1.25}
            selected
          />
        ))}

      {!issFocus && selectedAsteroidOrbit && (
        <OrbitLine
          points={selectedAsteroidOrbit.points}
          color={selectedAsteroidOrbit.hazardous ? "#d07060" : "#8aa4b8"}
          opacity={0.72}
          lineWidth={q.orbitLineWidth * 1.1}
          selected
        />
      )}

      {/* Progress marker only for planets — for NEOs a solid sphere sat on the
          rock and looked like a light-blue “selected asteroid” (bug). */}
      {selectedItem &&
        !isAsteroid(selectedItem) &&
        bodyPlanets.some((p) => p.id === selectedItem.id) && (
          <OrbitProgressMarker orbit={selectedItem.orbit} color="#d0e8ff" />
        )}

      {selectedItem && isAsteroid(selectedItem) && (
        <MotionTrail livePos={livePos} itemId={selectedItem.id} />
      )}

      {/* Compare labels in Near-Earth / system */}
      {showLabels &&
        compareOrbits.map((c) => (
          <DistanceLabel
            key={`lbl-cmp-${c.id}`}
            itemId={c.id}
            name={c.name}
            livePos={livePos}
            systemView={!nearEarth}
          />
        ))}

      {/*
        Outline-only sprite labels (no dark panels).
        Near-Earth: Earth + selected only — fewer chips near the sun.
      */}
      {showLabels &&
        bodyPlanets
          .filter((p) => isBodyVisible(p.name))
          .filter(
            (p) =>
              !nearEarth || p.name === "Earth" || selectedItem?.id === p.id,
          )
          .map((p) => (
            <DistanceLabel
              key={`lbl-${p.id}`}
              itemId={p.id}
              name={p.name}
              livePos={livePos}
              systemView={!nearEarth}
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
          />
        )}

      <NeoInstances
        asteroids={asteroids}
        selectedId={selectedItem && isAsteroid(selectedItem) ? selectedItem.id : null}
        compareOrbits={compareOrbits}
        livePos={livePos}
        onItemClick={onItemClick}
        hidden={issFocus}
      />

      {/*
        No EffectComposer / Bloom / DOF — full-screen post caused the black
        square on the sun (especially Near-Earth). Glow is scene-based for both
        views: geometric corona shells + SolarFlare (bloom disc, halo, streaks,
        ghosts). Curves only differ by camera distance / viewScale.
      */}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        // Keep limits stable across viewScale — changing them mid-flight flashes/clamps
        minDistance={4}
        maxDistance={220}
        maxPolarAngle={Math.PI * 0.48}
        minPolarAngle={0.15}
        // Do NOT pass target={...} every render — it snaps the look-at and flashes
        enabled={cameraMode === "free" && !issFocus}
      />
      <CameraDirector
        selectedItem={selectedItem}
        livePos={livePos}
        controlsRef={controlsRef}
        earthPosRef={earthPosRef}
        issFocus={issFocus && nearEarth}
      />

      {/* P6 distance ruler — dashed segment between two endpoints */}
      {measureAId && measureBId && (
        <MeasureLine
          getA={() => {
            if (measureAId === "sun") return new THREE.Vector3(0, 0, 0);
            return livePos.current.get(measureAId) ?? null;
          }}
          getB={() => {
            if (measureBId === "sun") return new THREE.Vector3(0, 0, 0);
            return livePos.current.get(measureBId) ?? null;
          }}
          onDistance={onMeasureDistance}
        />
      )}

      {selectedItem && (
        <SelectionLabel selectedItem={selectedItem} livePos={livePos} />
      )}
    </group>
  );
});

export default ThreeDScene;
