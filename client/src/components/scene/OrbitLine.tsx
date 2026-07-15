import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

/**
 * Smooth closed orbit ring via Line2 (screen-space width + built-in AA).
 */
export default function OrbitLine({
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
      worldUnits: false,
    });
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = -1;
    return { line, geometry, material };
  }, []);

  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);

  useEffect(() => {
    if (points.length < 2) return;

    const n = points.length;
    const alreadyClosed =
      n > 2 && points[0].distanceToSquared(points[n - 1]) < 1e-10;
    const ring = alreadyClosed ? points : [...points, points[0]];

    geometry.setFromPoints(ring);
    line.computeLineDistances();

    material.color.set(color as THREE.ColorRepresentation);
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
