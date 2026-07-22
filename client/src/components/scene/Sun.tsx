import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimSettings } from "../../sim/useSim";
import { qualitySettings } from "../../sim/simUtils";
import { useLazyTexture } from "./useLazyTexture";
import { EXTRA_MAPS } from "./textureCache";
import {
  SUN_RADIUS,
  SUN_VERT,
  SUN_FRAG,
  CHROMA_VERT,
  CHROMA_FRAG,
} from "./shaders/sun";
import SolarFlare from "./SolarFlare";

export default function Sun({
  meshRef,
}: {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const body = useRef<THREE.Mesh>(null);
  const map = useLazyTexture(EXTRA_MAPS.sun);
  const { quality } = useSimSettings();
  const segs = qualitySettings(quality).sunSegments;

  const setBodyRef = (el: THREE.Mesh | null) => {
    body.current = el;
    meshRef.current = el;
  };

  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uHasMap: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uMap.value = map;
    uniforms.uHasMap.value = map ? 1 : 0;
  }, [map, uniforms]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    if (body.current) body.current.rotation.y = t * 0.018;
  });

  const coronaSegs = Math.max(32, Math.floor(segs / 2));

  return (
    <group position={[0, 0, 0]} name="Sun">
      <mesh ref={setBodyRef}>
        <sphereGeometry args={[SUN_RADIUS, segs, segs]} />
        <shaderMaterial
          vertexShader={SUN_VERT}
          fragmentShader={SUN_FRAG}
          uniforms={uniforms}
          toneMapped
        />
      </mesh>

      {/* Geometric chromosphere + corona — same family in System + Near-Earth */}
      <mesh scale={1.03} renderOrder={1}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={CHROMA_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
          toneMapped
        />
      </mesh>

      {/* Inner corona shell (backside rim) */}
      <mesh scale={1.12} renderOrder={0}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vViewV;
            void main() {
              float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
              float a = pow(1.0 - ndv, 2.5) * 0.2;
              if (a < 0.004) discard;
              gl_FragColor = vec4(vec3(1.0, 0.85, 0.5) * a, a);
            }
          `}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Soft outer atmosphere — scene bloom without EffectComposer */}
      <mesh scale={1.38} renderOrder={-1}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vViewV;
            void main() {
              float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
              // Wide soft falloff — reads as natural solar atmosphere
              float a = pow(1.0 - ndv, 1.55) * 0.085;
              if (a < 0.003) discard;
              vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.9, 0.55), ndv);
              gl_FragColor = vec4(col * a, a);
            }
          `}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Extra wide glow for cinematic mock-like sun bloom */}
      <mesh scale={2.1} renderOrder={-2}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vViewV;
            void main() {
              float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
              float a = pow(1.0 - ndv, 1.25) * 0.045;
              if (a < 0.002) discard;
              vec3 col = mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.92, 0.65), ndv);
              gl_FragColor = vec4(col * a, a);
            }
          `}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Shared natural flare / bloom substitute for both views */}
      <SolarFlare />

      <pointLight
        position={[0, 0, 0]}
        color="#fff4dc"
        intensity={210}
        decay={2}
        distance={320}
      />
      <pointLight
        position={[0, 0, 0]}
        color="#ffb060"
        intensity={40}
        decay={2}
        distance={120}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */

