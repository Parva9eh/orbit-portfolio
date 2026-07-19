/**
 * Solar system scene — textures: Solar System Scope (CC BY 4.0)
 * https://www.solarsystemscope.com/textures/
 */
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CelestialItem, Planet } from "@shared";
import { isAsteroid } from "@shared";
import type { IssPosition } from "@shared";
import { useSimSettings } from "../sim/useSim";
import { scaleSize, qualitySettings } from "../sim/simUtils";
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
import MilkyWaySky from "./scene/MilkyWaySky";
import RealisticStars from "./scene/RealisticStars";
import ZodiacalDust from "./scene/ZodiacalDust";
import Sun from "./scene/Sun";
import OrbitLine from "./scene/OrbitLine";
import EarthBody from "./scene/Earth";
import PlanetBody from "./scene/PlanetBody";
import { OrbitProgressMarker, MotionTrail } from "./scene/MotionTrail";
import AsteroidBelt from "./scene/AsteroidBelt";
import NeoInstances from "./scene/NeoInstances";
import SceneLabels from "./scene/SceneLabels";
import { SceneBackdrop } from "./scene/SceneBackdrop";
export { SceneBackdrop };
import type { CompareOrbitSpec } from "./scene/types";
import {
  buildPlanetOrbitSpecs,
  buildSelectedAsteroidOrbit,
  filterBodyPlanets,
  filterOrbitPlanets,
  filterSceneAsteroids,
  isInnerOrEarth,
} from "./scene/selectSceneBodies";

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export type { CompareOrbitSpec } from "./scene/types";

export type ThreeDSceneProps = {
  items?: CelestialItem[];
  onItemClick: (item: CelestialItem) => void;
  /** Desktop hover for lightweight tooltips (null clears). Cheap: few planets + page NEOs. */
  onItemHover?: (item: CelestialItem | null) => void;
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
  onItemHover,
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

  const bodyPlanets = useMemo(
    () => filterBodyPlanets(planetsData, showPlanets),
    [planetsData, showPlanets]
  );

  const isBodyVisible = (name: string) => isInnerOrEarth(name, nearEarth);

  const orbitPlanets = useMemo(
    () => filterOrbitPlanets(planetsData, showPlanets, nearEarth),
    [showPlanets, nearEarth, planetsData]
  );

  /** Warm textures for visible bodies only. */
  useEffect(() => {
    const srgb: string[] = [
      EXTRA_MAPS.sun,
      EXTRA_MAPS.milkyWayDisplay,
      EXTRA_MAPS.milkyWay,
    ];
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

  const asteroids = useMemo(
    () => filterSceneAsteroids(items, q.maxNeos),
    [items, q.maxNeos]
  );

  const planetOrbits = useMemo(
    () => buildPlanetOrbitSpecs(orbitPlanets, q.orbitSegments, trueScale),
    [orbitPlanets, trueScale, q.orbitSegments]
  );

  const selectedAsteroidOrbit = useMemo(
    () =>
      buildSelectedAsteroidOrbit(
        selectedItem,
        asteroids,
        compareOrbits,
        q.orbitSegments,
        trueScale
      ),
    [selectedItem, asteroids, trueScale, q.orbitSegments, compareOrbits]
  );

  useFrame(() => {
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
      <ambientLight intensity={0.14} />
      <hemisphereLight args={["#3a4a68", "#0c0a08", 0.28]} />

      {/*
        Camera-locked sky (system + near-Earth): constant angular size.
        Fixed world spheres looked huge/pixelated when zooming.
      */}
      {q.enableMilkyWay && <MilkyWaySky nearEarth={nearEarth || issFocus} />}
      <RealisticStars count={q.starCount} />
      {q.enableShafts && !nearEarth && !issFocus && <ZodiacalDust />}
      <group visible={!nearEarth && !issFocus}>
        <AsteroidBelt trueScale={trueScale} count={q.beltCount} />
      </group>
      <group visible={!issFocus || !nearEarth}>
        <Sun meshRef={sunMeshRef} />
      </group>
      {issFocus && nearEarth && <ambientLight intensity={0.55} />}

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
                onHover={(active) => onItemHover?.(active ? p : null)}
              />
              {showIss && nearEarth && vis && (
                <IssMarker
                  iss={iss}
                  earthPos={issEarthPos}
                  earthDisplayRadius={
                    earthRadiusRef.current > 0.2
                      ? earthRadiusRef.current
                      : scaleSize(
                          planetsData.find((x) => x.name === "Earth")?.size ??
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
        if (issFocus) return null;
        return (
          <group key={p.id} visible={vis}>
            <PlanetBody
              planet={p}
              livePos={livePos}
              selected={selectedItem?.id === p.id}
              onClick={() => onItemClick(p)}
              onHover={(active) => onItemHover?.(active ? p : null)}
            />
          </group>
        );
      })}

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

      {selectedItem &&
        !isAsteroid(selectedItem) &&
        bodyPlanets.some((p) => p.id === selectedItem.id) && (
          <OrbitProgressMarker orbit={selectedItem.orbit} color="#d0e8ff" />
        )}

      {selectedItem && isAsteroid(selectedItem) && (
        <MotionTrail livePos={livePos} itemId={selectedItem.id} />
      )}

      <SceneLabels
        showLabels={showLabels}
        nearEarth={nearEarth}
        bodyPlanets={bodyPlanets}
        isBodyVisible={isBodyVisible}
        selectedItem={selectedItem}
        asteroids={asteroids}
        compareOrbits={compareOrbits}
        livePos={livePos}
      />

      <NeoInstances
        asteroids={asteroids}
        selectedId={
          selectedItem && isAsteroid(selectedItem) ? selectedItem.id : null
        }
        compareOrbits={compareOrbits}
        livePos={livePos}
        onItemClick={onItemClick}
        onItemHover={onItemHover}
        hidden={issFocus}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={220}
        maxPolarAngle={Math.PI * 0.48}
        minPolarAngle={0.15}
        enabled={cameraMode === "free" && !issFocus}
      />
      <CameraDirector
        selectedItem={selectedItem}
        livePos={livePos}
        controlsRef={controlsRef}
        earthPosRef={earthPosRef}
        issFocus={issFocus && nearEarth}
      />

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
    </group>
  );
});

export default ThreeDScene;
