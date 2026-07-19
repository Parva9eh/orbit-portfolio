import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Planet } from "@shared";
import { positionOnOrbit, spinAngle } from "@shared";
import { useSimSettings } from "../../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../../sim/simUtils";
import { useT } from "./useSimTime";
import { useLazyTexture } from "./useLazyTexture";
import { EARTH_MAPS, EXTRA_MAPS } from "./textureCache";
import { EARTH_VERT, EARTH_FRAG } from "./shaders/earth";
import OrbitLine from "./OrbitLine";

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



export default function EarthBody({
  planet,
  livePos,
  onClick,
  onHover,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  onHover?: (active: boolean) => void;
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


