import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EXTRA_MAPS } from "./textureCache";
import { useLazyTexture } from "./useLazyTexture";
import { MW_VERT, MW_FRAG } from "./shaders/milkyWay";

export default function MilkyWaySky() {
  const map = useLazyTexture(EXTRA_MAPS.milkyWay);
  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uHasMap: { value: 0 },
      uBoost: { value: 2.15 },
    }),
    [],
  );
  useEffect(() => {
    uniforms.uMap.value = map;
    uniforms.uHasMap.value = map ? 1 : 0;
  }, [map, uniforms]);

  return (
    <mesh scale={[-1, 1, 1]} rotation={[0.4, 1.05, 0.12]}>
      <sphereGeometry args={[580, 96, 64]} />
      <shaderMaterial
        vertexShader={MW_VERT}
        fragmentShader={MW_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Custom starfield: spherical distribution + circular alpha map.
 * drei <Stars> uses raw GL points (squares on many GPUs).
 */

