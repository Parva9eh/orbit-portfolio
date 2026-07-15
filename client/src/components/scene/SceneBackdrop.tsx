import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

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
