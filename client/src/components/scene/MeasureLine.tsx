import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { useThree } from "@react-three/fiber";

type MeasureLineProps = {
  getA: () => THREE.Vector3 | null;
  getB: () => THREE.Vector3 | null;
  onDistance?: (sceneDist: number | null) => void;
};

/**
 * P6 — live measure segment between two world positions (distance ruler).
 */
export default function MeasureLine({
  getA,
  getB,
  onDistance,
}: MeasureLineProps) {
  const { size } = useThree();
  const onDistRef = useRef(onDistance);
  onDistRef.current = onDistance;

  const { line, material, positions } = useMemo(() => {
    const positions = new Float32Array(6);
    const geo = new LineGeometry();
    geo.setPositions(positions);
    const material = new LineMaterial({
      color: 0xc4b5fd,
      linewidth: 2.0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      worldUnits: false,
      dashed: true,
      dashSize: 0.4,
      gapSize: 0.25,
    });
    material.resolution.set(
      typeof window !== "undefined" ? window.innerWidth : 800,
      typeof window !== "undefined" ? window.innerHeight : 600
    );
    const line = new Line2(geo, material);
    line.computeLineDistances();
    line.frustumCulled = false;
    line.renderOrder = 8;
    return { line, material, positions, geo };
  }, []);

  useFrame(() => {
    const a = getA();
    const b = getB();
    material.resolution.set(size.width, size.height);
    if (!a || !b) {
      line.visible = false;
      onDistRef.current?.(null);
      return;
    }
    line.visible = true;
    positions[0] = a.x;
    positions[1] = a.y;
    positions[2] = a.z;
    positions[3] = b.x;
    positions[4] = b.y;
    positions[5] = b.z;
    (line.geometry as LineGeometry).setPositions(positions as unknown as number[]);
    line.computeLineDistances();
    onDistRef.current?.(a.distanceTo(b));
  });

  return <primitive object={line} />;
}
