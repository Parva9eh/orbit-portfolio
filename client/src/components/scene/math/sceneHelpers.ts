import * as THREE from "three";
import { SUN_RADIUS } from "../shaders/sun";

export function asteroidDisplayScale(sizeKm: number): number {
  return Math.min(Math.max(sizeKm * 2.2, 0.14), 0.9);
}

export function softOrbitColor(hex?: number): string {
  if (hex == null) return "#8aa8c4";
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // Keep a hint of planet hue but bright enough for System view
  c.setHSL(hsl.h, Math.min(hsl.s * 0.35 + 0.12, 0.4), 0.62);
  return `#${c.getHexString()}`;
}

export function labelWorldHeight(dist: number, kind: "name" | "detail"): number {
  const base = kind === "detail" ? 1.15 : 0.95;
  return THREE.MathUtils.clamp(
    dist * 0.012 * base,
    0.75,
    kind === "detail" ? 2.1 : 1.7,
  );
}

/** Screen-space test: is world point on/near the sun disc from the camera? */
export function isNearSunDisc(
  world: THREE.Vector3,
  camera: THREE.Camera,
  tmpA: THREE.Vector3,
  tmpB: THREE.Vector3,
  labelRadius = 0,
): boolean {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    // Fallback to crude angular test for non-perspective cameras.
    tmpA.copy(world).sub(camera.position);
    const dist = tmpA.length();
    if (dist < 1e-4) return true;
    tmpA.normalize();
    tmpB.copy(camera.position).multiplyScalar(-1).normalize(); // toward origin
    const cos = tmpA.dot(tmpB);

    const sunDist = camera.position.length();
    if (sunDist <= SUN_RADIUS) return true;
    const sunAngle = Math.asin(Math.min(1, SUN_RADIUS / sunDist));
    const bufferAngle = 0.05;
    return cos > Math.cos(sunAngle + bufferAngle + labelRadius);
  }

  const screenSun = tmpA.set(0, 0, 0).project(camera);
  const cameraRight = tmpB.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const sunWorldEdge = new THREE.Vector3()
    .copy(cameraRight)
    .multiplyScalar(SUN_RADIUS);
  const screenSunEdge = sunWorldEdge.project(camera);
  const sunRadius = Math.abs(screenSunEdge.x - screenSun.x);

  const labelScreen = new THREE.Vector3().copy(world).project(camera);
  const labelDist = camera.position.distanceTo(world);
  const labelWorldRadius = labelDist * Math.tan(labelRadius);
  const labelWorldEdge = new THREE.Vector3()
    .copy(world)
    .addScaledVector(cameraRight, labelWorldRadius);
  const labelScreenEdge = labelWorldEdge.project(camera);
  const labelRadiusScreen = Math.abs(labelScreenEdge.x - labelScreen.x);

  const dist = Math.hypot(
    labelScreen.x - screenSun.x,
    labelScreen.y - screenSun.y,
  );
  return dist < sunRadius + labelRadiusScreen + 0.03;
}


