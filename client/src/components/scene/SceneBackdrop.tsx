import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Deep navy void (cinematic mock) — solid color only, no sky plate. */
const CLEAR = "#020612";

export function SceneBackdrop() {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const c = new THREE.Color(CLEAR);
    gl.setClearColor(c, 1);
    scene.background = c;
  }, [gl, scene]);

  return <fog attach="fog" args={[CLEAR, 220, 620]} />;
}
