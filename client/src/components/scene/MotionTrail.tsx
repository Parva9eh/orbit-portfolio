import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { positionOnOrbit, type OrbitElements } from "@shared";
import { useSimSettings } from "../../sim/useSim";
import { scalePosition } from "../../sim/simUtils";
import { useT } from "./useSimTime";

export function OrbitProgressMarker({
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


export function MotionTrail({
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

