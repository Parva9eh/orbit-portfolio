/**
 * Solar system scene — textures: Solar System Scope (CC BY 4.0)
 * https://www.solarsystemscope.com/textures/
 */
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { GLTF } from "three-stdlib";
import type { CelestialItem, Planet } from "@shared";
import {
  isAsteroid,
  positionOnOrbit,
  sampleOrbitPath,
  spinAngle,
  asteroidTumble,
  hashString,
  formatDiameterKm,
  formatMiss,
  type OrbitElements,
} from "@shared";
import { useSimSettings } from "../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../sim/simUtils";
import CameraDirector from "./scene/CameraDirector";
import {
  EARTH_MAPS,
  EXTRA_MAPS,
  PLANET_ALBEDO,
  preloadTextures,
  preloadBootTextures,
  preloadEarthTextures,
} from "./scene/textureCache";
import { useLazyTexture } from "./scene/useLazyTexture";
import IssMarker from "./scene/IssMarker";
import MeasureLine from "./scene/MeasureLine";
import type { IssPosition } from "@shared";
import { toThreePath } from "../lib/vec3";
import {
  makeCircleSprite,
  makeTextSpriteTexture,
} from "./scene/textures/canvasSprites";
import { EARTH_VERT, EARTH_FRAG } from "./scene/shaders/earth";
import { JUPITER_VERT, JUPITER_FRAG } from "./scene/shaders/jupiter";
import {
  asteroidDisplayScale,
  softOrbitColor,
  labelWorldHeight,
  isNearSunDisc,
} from "./scene/math/sceneHelpers";
import { useT } from "./scene/useSimTime";
import MilkyWaySky from "./scene/MilkyWaySky";
import RealisticStars from "./scene/RealisticStars";
import ZodiacalDust from "./scene/ZodiacalDust";
import Sun from "./scene/Sun";

function EarthMoon({
  earthSize,
  showOrbit = true,
}: {
  earthSize: number;
  showOrbit?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const t = useT();
  const moonMap = useLazyTexture(EXTRA_MAPS.moon);
  // Slightly exaggerated for readability at system scale (~real is ~30 Earth radii)
  const orbitR = earthSize * 4.4;
  const period = 9.5;
  const moonSize = Math.max(earthSize * 0.32, 0.18);
  const inc = 0.12;

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    // Dense closed ring (open list; OrbitLine closes) — smooth moon path
    const segs = 384;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * orbitR,
          Math.sin(a) * orbitR * Math.sin(inc),
          Math.sin(a) * orbitR * Math.cos(inc),
        ),
      );
    }
    return pts;
  }, [orbitR, inc]);

  useFrame(() => {
    if (!ref.current) return;
    const time = t();
    const a = (time / period) * Math.PI * 2;
    ref.current.position.set(
      Math.cos(a) * orbitR,
      Math.sin(a) * orbitR * Math.sin(inc),
      Math.sin(a) * orbitR * Math.cos(inc),
    );
    // Tidally locked-ish spin
    ref.current.rotation.y = a + Math.PI;
  });

  return (
    <>
      {showOrbit && (
        <OrbitLine points={orbitPoints} color="#b0c4d8" opacity={0.55} lineWidth={0.75} />
      )}
      <group ref={ref}>
        <mesh scale={moonSize}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            map={moonMap}
            color={moonMap ? "#f0f0f0" : "#c8c8c8"}
            roughness={0.92}
            metalness={0.02}
            emissive="#1a1a20"
            emissiveIntensity={0.12}
          />
        </mesh>
        {/* Soft rim so the Moon stays readable against dark space */}
        <mesh scale={moonSize * 1.06}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#c0d0e0"
            transparent
            opacity={0.12}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

function EarthBody({
  planet,
  livePos,
  onClick,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const t = useT();
  const { trueScale, quality } = useSimSettings();
  const displaySize = scaleSize(planet.size, trueScale);
  const segs = qualitySettings(quality).planetSegments;

  // Maps preloaded at boot — day alone is enough to leave the solid-sphere placeholder
  const day = useLazyTexture(EARTH_MAPS.day);
  const night = useLazyTexture(EARTH_MAPS.night);
  const specular = useLazyTexture(EARTH_MAPS.specular, false);
  const clouds = useLazyTexture(EARTH_MAPS.clouds);
  const ready = !!day;

  const uniforms = useMemo(
    () => ({
      dayMap: { value: day as THREE.Texture | null },
      nightMap: { value: (night ?? day) as THREE.Texture | null },
      specularMap: { value: (specular ?? day) as THREE.Texture | null },
      sunPosition: { value: new THREE.Vector3(0, 0, 0) },
    }),
    // stable object; values patched below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    uniforms.dayMap.value = day;
    uniforms.nightMap.value = night ?? day;
    uniforms.specularMap.value = specular ?? day;
  }, [day, night, specular, uniforms]);

  useFrame(() => {
    const time = t();
    const raw = positionOnOrbit(planet.orbit, time);
    const p = scalePosition(raw, trueScale);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, p.y, p.z);
      let stored = livePos.current.get(planet.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(planet.id, stored);
      }
      stored.set(p.x, p.y, p.z);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.order = "ZXY";
      bodyRef.current.rotation.z = planet.axialTilt;
      bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.order = "ZXY";
      cloudRef.current.rotation.z = planet.axialTilt;
      cloudRef.current.rotation.y =
        spinAngle(planet.spinDays, time) * 1.15 + time * 0.02;
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={bodyRef} scale={displaySize}>
        <sphereGeometry args={[1, segs, segs]} />
        {ready ? (
          <shaderMaterial
            vertexShader={EARTH_VERT}
            fragmentShader={EARTH_FRAG}
            uniforms={uniforms}
          />
        ) : (
          <meshStandardMaterial
            color="#2a5a9a"
            roughness={0.7}
            metalness={0.05}
          />
        )}
      </mesh>
      {clouds && (
        <mesh ref={cloudRef} scale={displaySize * 1.018}>
          <sphereGeometry
            args={[1, Math.max(24, segs / 2), Math.max(24, segs / 2)]}
          />
          <meshStandardMaterial
            map={clouds}
            transparent
            opacity={0.45}
            depthWrite={false}
            roughness={1}
            metalness={0}
            alphaTest={0.02}
          />
        </mesh>
      )}
      <mesh scale={displaySize * 1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#5aa8ff"
          transparent
          opacity={selected ? 0.2 : 0.1}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <EarthMoon earthSize={displaySize} showOrbit />
    </group>
  );
}

function OrbitProgressMarker({
  orbit,
  color = "#c8e0ff",
}: {
  orbit: OrbitElements;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useT();
  const { trueScale } = useSimSettings();
  useFrame(() => {
    if (!ref.current) return;
    const p = scalePosition(positionOnOrbit(orbit, t()), trueScale);
    ref.current.position.set(p.x, p.y, p.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Motion trail without React setState (avoids per-frame re-renders).
 * Updates a BufferGeometry position attribute imperatively.
 */
function MotionTrail({
  livePos,
  itemId,
}: {
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  itemId: string;
}) {
  const maxPoints = 48;
  const history = useRef<THREE.Vector3[]>([]);
  const positions = useMemo(() => new Float32Array(maxPoints * 3), []);
  const lineObj = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setDrawRange(0, 0);
    const m = new THREE.LineBasicMaterial({
      // Warm trail — ice-blue read as “selected body turned cyan”
      color: 0xc8b89a,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Line(g, m);
  }, [positions]);

  useEffect(() => {
    history.current = [];
    lineObj.geometry.setDrawRange(0, 0);
  }, [itemId, lineObj]);

  useFrame(() => {
    const p = livePos.current.get(itemId);
    if (!p) return;
    const last = history.current[history.current.length - 1];
    if (!last || last.distanceToSquared(p) > 0.06) {
      history.current.push(p.clone());
      if (history.current.length > maxPoints) history.current.shift();
      const n = history.current.length;
      for (let i = 0; i < n; i++) {
        const v = history.current[i];
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      }
      const geom = lineObj.geometry;
      const attr = geom.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      geom.setDrawRange(0, n);
      geom.computeBoundingSphere();
    }
  });

  return <primitive object={lineObj} />;
}

/** Dust + rocks between Mars–Jupiter scene radii. */
function AsteroidBelt({
  trueScale,
  count = 900,
}: {
  trueScale: boolean;
  count?: number;
}) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Scenic radii: Mars ~17, Jupiter ~35
      let r = 20 + Math.random() * 14;
      if (trueScale) r *= 1.35;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      const s = 0.35 + Math.random() * 0.35;
      col.setRGB(0.55 * s, 0.48 * s, 0.4 * s);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, colors };
  }, [trueScale, count]);

  const sprite = useMemo(() => makeCircleSprite(32, true), []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.28}
        vertexColors
        transparent={false}
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
        alphaTest={0.5}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Outline-only text (no filled panel).
 * Dark rounded chips were the "flashing boxes" when they crossed the sun.
 *
 * Orientation: CanvasTexture for THREE.Sprite must use default flipY=true
 * so line 0 is at the top of the billboard (flipY=false made labels
 * upside-down / hard to read).
 */
function DistanceLabel({
  itemId,
  name,
  livePos,
  systemView = true,
}: {
  itemId: string;
  name: string;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  systemView?: boolean;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const cullDist = systemView ? 150 : 48;
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture([name], { fontSize: 20 }),
    [name],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    const p = livePos.current.get(itemId);
    if (!spr || !mat || !p) return;

    const d = camera.position.distanceTo(p);
    const labelPos = new THREE.Vector3(
      p.x,
      p.y + 0.5 + Math.min(d * 0.006, 0.9),
      p.z,
    );
    spr.position.copy(labelPos);

    const h = labelWorldHeight(d, "name");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 1.25,
    );
    const visible = d < cullDist && d > 3 && !onSun && p.length() > 6.5;
    spr.visible = visible;
    if (!visible) return;

    // Always positive scale — negative Y would mirror text upside-down
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // anchor bottom-center above the body
    mat.opacity = THREE.MathUtils.clamp(1.0 - d / cullDist, 0.45, 0.95);
  });

  return (
    <sprite ref={spriteRef} renderOrder={20} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
      />
    </sprite>
  );
}

function SelectionLabel({
  selectedItem,
  livePos,
}: {
  selectedItem: CelestialItem;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const offsetY = isAsteroid(selectedItem)
    ? 1.0
    : Math.max(1.0, (selectedItem as Planet).size * 0.5 + 0.75);

  const lines = useMemo(() => {
    if (isAsteroid(selectedItem)) {
      const tag = selectedItem.isHazardous ? "PHA" : "NEO";
      const diam = formatDiameterKm(
        selectedItem.diameterKmMin,
        selectedItem.diameterKmMax,
        selectedItem.size,
      );
      const miss = selectedItem.approach
        ? formatMiss(
            selectedItem.approach.missLd,
            selectedItem.approach.missKm,
            { compact: true },
          )
        : null;
      return [
        selectedItem.name,
        miss ? `${tag} · ${miss} · ${diam}` : `${tag} · ${diam}`,
      ];
    }
    return [
      selectedItem.name,
      `${(selectedItem as Planet).earthRadii.toFixed(2)} R⊕ · ${selectedItem.orbit.periodYears.toFixed(2)} yr`,
    ];
  }, [selectedItem]);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture(lines, { fontSize: 20 }),
    [lines],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    if (!spr || !mat) return;
    const p = livePos.current.get(selectedItem.id);
    const labelPos = p
      ? new THREE.Vector3(p.x, p.y + offsetY, p.z)
      : new THREE.Vector3(
          selectedItem.position.x,
          selectedItem.position.y + offsetY,
          selectedItem.position.z,
        );
    spr.position.copy(labelPos);
    const d = camera.position.distanceTo(labelPos);
    const h = labelWorldHeight(d, "detail");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 1.25,
    );
    spr.visible = !onSun;
    if (onSun) return;
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // bottom-center so text sits above the body upright
  });

  return (
    <sprite ref={spriteRef} renderOrder={25} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
        opacity={0.95}
      />
    </sprite>
  );
}

/**
 * SSS ring strip is 2048×125 (radial features along width).
 * Three.js RingGeometry UVs are (angle, radius) — swap so width maps radially.
 */
function makeSaturnRingGeometry(
  inner: number,
  outer: number,
  theta = 192,
  radial = 6,
): THREE.RingGeometry {
  const geo = new THREE.RingGeometry(inner, outer, theta, radial);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const angleU = uv.getX(i); // 0..1 around circumference
    const radiusV = uv.getY(i); // 0..1 inner → outer
    // U = radial (Cassini division etc.), V = mild angular sample of the strip
    uv.setXY(i, radiusV, 0.35 + angleU * 0.3);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Multi-layer Saturn rings with correct SSS UVs + equatorial tilt. */
function SaturnRings({
  displaySize,
  ringMap,
  axialTilt,
}: {
  displaySize: number;
  ringMap: THREE.Texture;
  axialTilt: number;
}) {
  // Approximate real ratios (R_s): D/C ~1.11–1.5, B ~1.5–1.95, A ~2.02–2.27
  const mainGeo = useMemo(
    () =>
      makeSaturnRingGeometry(displaySize * 1.12, displaySize * 2.32, 256, 8),
    [displaySize],
  );
  // Thin outer F-ring hint
  const outerGeo = useMemo(
    () =>
      makeSaturnRingGeometry(displaySize * 2.34, displaySize * 2.42, 128, 2),
    [displaySize],
  );

  useEffect(() => {
    // Premultiply-friendly sampling for the alpha strip
    ringMap.colorSpace = THREE.SRGBColorSpace;
    ringMap.anisotropy = 8;
    ringMap.wrapS = THREE.ClampToEdgeWrapping;
    ringMap.wrapT = THREE.ClampToEdgeWrapping;
    ringMap.needsUpdate = true;
  }, [ringMap]);

  return (
    // RingGeometry lies in XY; flip to XZ equatorial plane, match planet axial tilt
    <group rotation={[Math.PI / 2, 0, axialTilt]}>
      <mesh geometry={mainGeo} renderOrder={2}>
        <meshStandardMaterial
          map={ringMap}
          color="#f0e6d0"
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.92}
          metalness={0.08}
          alphaTest={0.04}
          emissive="#1a140c"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Soft underside so the ring doesn't vanish when lit from above */}
      <mesh geometry={mainGeo} renderOrder={1} scale={[1, 1, 1]}>
        <meshBasicMaterial
          map={ringMap}
          color="#8a7a60"
          transparent
          opacity={0.35}
          side={THREE.BackSide}
          depthWrite={false}
          alphaTest={0.06}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={outerGeo} renderOrder={2}>
        <meshBasicMaterial
          map={ringMap}
          color="#d8c8a8"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
          alphaTest={0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function PlanetBody({
  planet,
  livePos,
  onClick,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const ringGroupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const t = useT();
  const { trueScale, quality } = useSimSettings();
  const displaySize = scaleSize(planet.size, trueScale);
  const segs = qualitySettings(quality).planetSegments;

  // Preloaded at boot — rarely null after first frames
  const albedoUrl = PLANET_ALBEDO[planet.name] ?? null;
  const colorMap = useLazyTexture(albedoUrl);
  const cloudMap = useLazyTexture(
    planet.name === "Venus" ? EXTRA_MAPS.venusAtmo : null,
  );
  const ringMap = useLazyTexture(
    planet.hasRings || planet.name === "Saturn" ? EXTRA_MAPS.saturnRing : null,
  );

  // Force material map update when texture arrives (avoids stuck solid spheres)
  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = colorMap;
      matRef.current.needsUpdate = true;
    }
  }, [colorMap]);

  const atmo: Record<string, string> = {
    Venus: "#e8c878",
    Mars: "#c47850",
    Jupiter: "#d4c4a0",
    Saturn: "#e0d0b0",
    Uranus: "#7fd0e0",
    Neptune: "#4a7ad4",
  };

  const placeholder: Record<string, string> = {
    Mercury: "#9a9088",
    Venus: "#d4b878",
    Mars: "#c06040",
    Jupiter: "#c8b090",
    Saturn: "#e0d0a0",
    Uranus: "#80d0e0",
    Neptune: "#4a70c0",
  };

  const jupUniforms = useMemo(
    () => ({
      map: { value: colorMap as THREE.Texture | null },
      uTime: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    jupUniforms.map.value = colorMap;
  }, [colorMap, jupUniforms]);

  useFrame(() => {
    const time = t();
    jupUniforms.uTime.value = time;
    const raw = positionOnOrbit(planet.orbit, time);
    const p = scalePosition(raw, trueScale);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, p.y, p.z);
      let stored = livePos.current.get(planet.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(planet.id, stored);
      }
      stored.set(p.x, p.y, p.z);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.order = "ZXY";
      bodyRef.current.rotation.z = planet.axialTilt;
      bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.order = "ZXY";
      cloudRef.current.rotation.z = planet.axialTilt;
      cloudRef.current.rotation.y = spinAngle(
        Math.abs(planet.spinDays) * 0.9,
        time,
      );
    }
    // Rings share axial tilt but do not spin with the day
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.set(0, 0, planet.axialTilt);
    }
  });

  const isJupiter = planet.name === "Jupiter";
  const isSaturn = planet.name === "Saturn";

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={bodyRef} scale={displaySize}>
        <sphereGeometry
          args={[1, isSaturn ? segs + 16 : segs, isSaturn ? segs + 16 : segs]}
        />
        {isJupiter && colorMap ? (
          <shaderMaterial
            vertexShader={JUPITER_VERT}
            fragmentShader={JUPITER_FRAG}
            uniforms={jupUniforms}
          />
        ) : (
          <meshStandardMaterial
            ref={matRef}
            map={colorMap}
            roughness={
              planet.name === "Uranus" || planet.name === "Neptune"
                ? 0.45
                : isSaturn
                  ? 0.78
                  : 0.78
            }
            metalness={
              planet.name === "Uranus" || planet.name === "Neptune"
                ? 0.12
                : isSaturn
                  ? 0.04
                  : 0.05
            }
            color={
              colorMap
                ? planet.name === "Uranus"
                  ? "#c8f0f5"
                  : planet.name === "Neptune"
                    ? "#a8c4ff"
                    : isSaturn
                      ? "#fff6e8"
                      : "#ffffff"
                : placeholder[planet.name] ?? "#888888"
            }
          />
        )}
      </mesh>
      {/* Saturn: soft shadow of rings on the globe */}
      {isSaturn && (
        <mesh
          scale={[displaySize * 1.01, displaySize * 0.18, displaySize * 1.01]}
        >
          <sphereGeometry args={[1, 48, 16]} />
          <meshBasicMaterial
            color="#0a0806"
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      )}
      {cloudMap && (
        <mesh ref={cloudRef} scale={displaySize * 1.02}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            map={cloudMap}
            transparent
            opacity={0.55}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      )}
      {atmo[planet.name] && (
        <mesh scale={displaySize * (isSaturn ? 1.04 : 1.05)}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial
            color={atmo[planet.name]}
            transparent
            opacity={selected ? 0.18 : isSaturn ? 0.08 : 0.1}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {isSaturn && ringMap && (
        <group ref={ringGroupRef}>
          <SaturnRings
            displaySize={displaySize}
            ringMap={ringMap}
            axialTilt={0}
          />
        </group>
      )}
    </group>
  );
}

/**
 * Smooth closed orbit ring via Line2 (screen-space width + built-in AA).
 *
 * Why not native THREE.Line?
 * WebGL line primitives are always ~1px, poorly antialiased, and with few
 * samples look like “tiny broken chords glued together.” Line2 draws a
 * continuous ribbon with proper joins.
 *
 * Why not dashed / fat tubes? Thin continuous ellipse (~0.7–1px screen space).
 */
function OrbitLine({
  points,
  color,
  opacity = 0.62,
  selected = false,
  lineWidth = 0.85,
}: {
  points: THREE.Vector3[];
  color: string | number;
  opacity?: number;
  lineWidth?: number;
  selected?: boolean;
}) {
  const { size } = useThree();

  const { line, geometry, material } = useMemo(() => {
    const geometry = new LineGeometry();
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: 0.85,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      // worldUnits: false → linewidth is in CSS pixels (stable under zoom)
      worldUnits: false,
    });
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = -1;
    return { line, geometry, material };
  }, []);

  // Keep resolution in sync so Line2 AA doesn’t shimmer on resize / DPR change
  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);

  useEffect(() => {
    if (points.length < 2) return;

    // Closed ring: append start so last segment meets first (no gap at periapsis)
    const n = points.length;
    const alreadyClosed =
      n > 2 && points[0].distanceToSquared(points[n - 1]) < 1e-10;
    const ring = alreadyClosed ? points : [...points, points[0]];

    geometry.setFromPoints(ring);
    line.computeLineDistances();

    material.color.set(color as THREE.ColorRepresentation);
    // Selected: slightly brighter, barely thicker — still a fine hairline
    material.opacity = selected ? Math.min(opacity + 0.12, 0.88) : opacity;
    material.linewidth = selected ? lineWidth * 1.15 : lineWidth;
    material.needsUpdate = true;
  }, [points, color, opacity, selected, lineWidth, geometry, material, line]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (points.length < 2) return null;
  return <primitive object={line} />;
}

/**
 * DepthOfField is intentionally disabled because its mask pass can produce
 * a black rectangle around the sun in Near-Earth view.
 */

/** Immediate dark clear — runs outside Suspense so first paint is never light-blue. */
export function SceneBackdrop() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(new THREE.Color("#010308"), 1);
  }, [gl]);
  return (
    <>
      <color attach="background" args={["#010308"]} />
      <fog attach="fog" args={["#010308", 220, 620]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export type CompareOrbitSpec = {
  id: string;
  name: string;
  hazardous: boolean;
  /** Accent for dual-orbit compare (P4) */
  color: string;
  points: THREE.Vector3[];
};

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
  const asteroidGltf = useGLTF("/models/bennu.glb", true) as GLTF;
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const { trueScale, showLabels, quality, cameraMode, viewScale } =
    useSimSettings();
  const t = useT();
  const q = qualitySettings(quality);
  const nearEarth = viewScale === "nearEarth";
  const colorsDirty = useRef(true);
  /** Don't draw NEOs until matrices are written — identity = stacked on the sun. */
  const neoMatricesReady = useRef(false);
  const earthRadiusRef = useRef(1.2);
  const issEarthPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    useGLTF.preload("/models/bennu.glb");
    // Boot: only sun + sky (and Earth soon after). Outer planets wait for System view.
    preloadBootTextures();
    preloadEarthTextures();
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = q.exposure;
    const maxDpr = q.dprMax;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  }, [gl, quality, q.dprMax, q.exposure]);

  const asteroidRef = useRef<THREE.InstancedMesh>(null);
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(), []);
  const posVec = useMemo(() => new THREE.Vector3(), []);
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

  // Precompute per-asteroid static data once (avoid hashString every frame)
  const asteroidStatic = useMemo(
    () =>
      asteroids.map((a) => {
        const seed = hashString(a.id);
        const scaleMul = nearEarth ? 2.8 : trueScale ? 1.0 : 1.65;
        const s = Math.max(
          asteroidDisplayScale(a.size) * scaleMul,
          nearEarth ? 0.42 : 0.28,
        );
        // Warm rock tones — avoid pure-black silhouettes on the sun
        const color = a.isHazardous
          ? new THREE.Color("#e89878")
          : new THREE.Color().setRGB(
              0.55 + (seed % 40) / 120,
              0.5 + (seed % 35) / 130,
              0.45 + (seed % 30) / 140,
            );
        // Selection: slight warm lift (not light-blue — that was the old marker)
        const selectedColor = color.clone().lerp(new THREE.Color("#ffe8c8"), 0.35);
        return { seed, scale: s, color, selectedColor, spinRate: a.spinRate };
      }),
    [asteroids, nearEarth, trueScale],
  );

  useEffect(() => {
    colorsDirty.current = true;
  }, [asteroids, nearEarth, trueScale, selectedItem?.id]);

  /**
   * Bennu GLB is ~565 units across (OSIRIS-REx meters). Without normalize,
   * instanced NEOs are planet-sized and look "broken". Center + unit-scale.
   * Also pull albedo map from the GLTF material when present.
   */
  const { bennuGeometry, bennuMap } = useMemo(() => {
    const found: { geo: THREE.BufferGeometry; map: THREE.Texture | null } = {
      geo: null as unknown as THREE.BufferGeometry,
      map: null,
    };
    let hasMesh = false;
    asteroidGltf.scene?.traverse((obj) => {
      if (hasMesh) return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        hasMesh = true;
        found.geo = mesh.geometry;
        const mat = mesh.material as
          | THREE.MeshStandardMaterial
          | THREE.MeshStandardMaterial[];
        const m = Array.isArray(mat) ? mat[0] : mat;
        found.map = m?.map ?? null;
      }
    });
    if (!hasMesh) {
      return {
        bennuGeometry: null as THREE.BufferGeometry | null,
        bennuMap: null as THREE.Texture | null,
      };
    }

    const geo = found.geo.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
    geo.computeBoundingSphere();
    geo.computeVertexNormals();
    const map = found.map;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    }
    return { bennuGeometry: geo, bennuMap: map };
  }, [asteroidGltf]);

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

  const asteroidMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe8d8c0,
      map: bennuMap ?? null,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: false,
      // Lift fills so NEOs don’t become black rectangles against the photosphere
      emissive: 0x3a3228,
      emissiveIntensity: 0.35,
    });
    mat.vertexColors = false;
    return mat;
  }, [bennuMap]);

  const fallbackGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const neoGeometry = bennuGeometry ?? fallbackGeo;

  // Ensure instanced mesh can receive per-instance colors
  useEffect(() => {
    const mesh = asteroidRef.current;
    if (!mesh || asteroids.length === 0) return;
    if (!mesh.instanceColor) {
      const colors = new Float32Array(Math.max(asteroids.length, 32) * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
    colorsDirty.current = true;
  }, [asteroids.length, neoGeometry]);

  // When asteroid set/geometry changes, hide until matrices are written (prevents
  // a frame of every instance at the origin = black mass on the sun).
  useEffect(() => {
    neoMatricesReady.current = false;
    if (asteroidRef.current) asteroidRef.current.visible = false;
  }, [asteroids, neoGeometry, nearEarth, trueScale]);

  useFrame(() => {
    const time = t();

    if (asteroidRef.current && asteroids.length > 0) {
      const mesh = asteroidRef.current;
      mesh.count = asteroids.length;
      for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        const st = asteroidStatic[i];
        const raw = positionOnOrbit(a.orbit, time);
        const p = scalePosition(raw, trueScale);
        posVec.set(p.x, p.y, p.z);
        let stored = livePos.current.get(a.id);
        if (!stored) {
          stored = new THREE.Vector3();
          livePos.current.set(a.id, stored);
        }
        stored.copy(posVec);

        const tumble = asteroidTumble(st.spinRate, time, st.seed);
        euler.set(tumble.x, tumble.y, tumble.z);
        quat.setFromEuler(euler);
        scaleVec.set(st.scale, st.scale, st.scale);
        matrix.compose(posVec, quat, scaleVec);
        mesh.setMatrixAt(i, matrix);

        // Selection / compare tints (A/B match orbit line colors)
        let col = st.color;
        const cmp = compareOrbits.find((c) => c.id === a.id);
        if (cmp) {
          col = st.color.clone().lerp(new THREE.Color(cmp.color), 0.55);
        } else if (selectedItem?.id === a.id) {
          col = st.selectedColor;
        }
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorsDirty.current = false;
      if (!neoMatricesReady.current) {
        neoMatricesReady.current = true;
        mesh.visible = true;
      }
    }

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

      {/*
        Bennu GLB instanced NEOs.
        Geometry is unit-normalized (~565m OSIRIS-REx mesh → 1 unit).
        Use raw InstancedMesh so useFrame matrices aren't fought by <Instance>.
      */}
      {asteroids.length > 0 && !issFocus && (
        <instancedMesh
          ref={asteroidRef}
          args={[neoGeometry, asteroidMaterial, Math.max(asteroids.length, 1)]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
          // Hidden until first useFrame writes real orbit matrices (see neoMatricesReady)
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            const id = e.instanceId;
            if (id == null || id < 0 || id >= asteroids.length) return;
            onItemClick(asteroids[id]);
          }}
        />
      )}

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
