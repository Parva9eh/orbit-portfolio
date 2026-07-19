import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Planet } from "@shared";
import { positionOnOrbit, spinAngle } from "@shared";
import { useSimSettings } from "../../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../../sim/simUtils";
import { useT } from "./useSimTime";
import { useLazyTexture } from "./useLazyTexture";
import { PLANET_ALBEDO, EXTRA_MAPS } from "./textureCache";
import { JUPITER_VERT, JUPITER_FRAG } from "./shaders/jupiter";

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



export default function PlanetBody({
  planet,
  livePos,
  onClick,
  onHover,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  /** Lightweight pointer hover (desktop) — optional */
  onHover?: (active: boolean) => void;
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
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        onHover?.(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        onHover?.(false);
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

