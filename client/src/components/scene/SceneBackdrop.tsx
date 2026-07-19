import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const CLEAR = "#010308";

/** Dark clear + subtle fog. Always solid dark — no sky plate fight. */
export function SceneBackdrop() {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const c = new THREE.Color(CLEAR);
    gl.setClearColor(c, 1);
    scene.background = c;
  }, [gl, scene]);

  return <fog attach="fog" args={[CLEAR, 180, 560]} />;
}
