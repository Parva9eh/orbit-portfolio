import type * as THREE from "three";

export type CompareOrbitSpec = {
  id: string;
  name: string;
  hazardous: boolean;
  /** Accent for dual-orbit compare (P4) */
  color: string;
  points: THREE.Vector3[];
};
