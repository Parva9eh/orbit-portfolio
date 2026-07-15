import * as THREE from "three";
import type { Vec3 } from "@shared";

/** Map shared orbit samples to Three.js path points. */
export function toThreePath(points: Vec3[]): THREE.Vector3[] {
  return points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
}
