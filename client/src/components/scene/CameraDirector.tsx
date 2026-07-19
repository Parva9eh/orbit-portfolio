import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { CelestialItem } from "@shared";
import { isAsteroid } from "@shared";
import { useSimSettings } from "../../sim/useSim";

type CameraDirectorProps = {
  selectedItem: CelestialItem | null;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  /** Live Earth world position for near-Earth framing */
  earthPosRef?: React.MutableRefObject<THREE.Vector3>;
  /** P5 — tight Earth + ISS framing (hides NEO clutter in scene) */
  issFocus?: boolean;
};

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * free  — user OrbitControls
 * tour  — auto cinematic orbit (system or near-Earth)
 * focus — dolly toward selected body
 *
 * ViewScale changes use a frozen pose-to-pose transition (end pose captured
 * once). Refreshing the end pose every frame from a moving Earth caused
 * intermittent flashes.
 */
export default function CameraDirector({
  selectedItem,
  livePos,
  controlsRef,
  earthPosRef,
  issFocus = false,
}: CameraDirectorProps) {
  const { camera } = useThree();
  const { cameraMode, viewScale } = useSimSettings();
  const tourAngle = useRef(0.35);
  const prevIssFocus = useRef(issFocus);
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3());
  const origin = useRef(new THREE.Vector3(0, 0, 0));
  const trackedTmp = useRef(new THREE.Vector3());
  const introDone = useRef(false);
  const prevScale = useRef(viewScale);

  const transitioning = useRef(false);
  const transitionT = useRef(1);
  const fromPos = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const toTarget = useRef(new THREE.Vector3());
  /** Pending near-Earth until Earth has a real live position */
  const pendingNearEarth = useRef(false);
  /** One-shot ease back to system overview (clear selection / home). */
  const homeFrame = useRef(false);
  const TRANSITION_SEC = 1.6;

  const getEarthLive = () => livePos.current.get("planet:Earth") ?? null;

  useEffect(() => {
    const onHome = () => {
      homeFrame.current = true;
      introDone.current = true;
      tourAngle.current = 0.35;
    };
    window.addEventListener("orbit-camera-home", onHome);
    return () => window.removeEventListener("orbit-camera-home", onHome);
  }, []);

  const computeNearEarthPose = (
    outPos: THREE.Vector3,
    outTarget: THREE.Vector3,
    earth: THREE.Vector3,
  ) => {
    // ISS focus: close orbit of Earth so station + LEO ring dominate
    if (issFocus) {
      const r = 7.2;
      outPos.set(
        earth.x + Math.cos(tourAngle.current) * r,
        earth.y + 3.2,
        earth.z + Math.sin(tourAngle.current) * r,
      );
      outTarget.copy(earth);
      return;
    }
    if (cameraMode === "focus" && selectedItem) {
      const tracked = livePos.current.get(selectedItem.id) ?? earth;
      outTarget.copy(tracked);
      const dist = isAsteroid(selectedItem) ? 6 : 14;
      outPos.set(
        tracked.x + dist * 0.7,
        tracked.y + dist * 0.4,
        tracked.z + dist * 0.55,
      );
      return;
    }
    const r = 16;
    outPos.set(
      earth.x + Math.cos(tourAngle.current) * r,
      earth.y + 8,
      earth.z + Math.sin(tourAngle.current) * r,
    );
    outTarget.copy(earth);
  };

  const computeSystemPose = (
    outPos: THREE.Vector3,
    outTarget: THREE.Vector3,
  ) => {
    if (cameraMode === "focus" && selectedItem) {
      const tracked =
        livePos.current.get(selectedItem.id) ??
        trackedTmp.current.set(
          selectedItem.position.x,
          selectedItem.position.y,
          selectedItem.position.z,
        );
      outTarget.copy(tracked);
      const dist = isAsteroid(selectedItem) ? 11 : 28;
      const height = isAsteroid(selectedItem) ? 5 : 12;
      outPos.set(
        tracked.x + dist * 0.7,
        tracked.y + height,
        tracked.z + dist * 0.55,
      );
      return;
    }
    const r = 72;
    const elev = 34;
    outPos.set(
      Math.cos(tourAngle.current) * r,
      elev,
      Math.sin(tourAngle.current) * r,
    );
    outTarget.copy(origin.current);
  };

  const beginTransition = (next: "system" | "nearEarth") => {
    fromPos.current.copy(camera.position);
    const controls = controlsRef.current;
    if (controls) fromTarget.current.copy(controls.target);
    else fromTarget.current.copy(target.current);

    if (next === "nearEarth") {
      const earth = getEarthLive();
      if (!earth) {
        pendingNearEarth.current = true;
        return;
      }
      pendingNearEarth.current = false;
      tourAngle.current = Math.atan2(
        camera.position.z - earth.z,
        camera.position.x - earth.x,
      );
      // Freeze end pose at transition start (do not refresh each frame)
      computeNearEarthPose(toPos.current, toTarget.current, earth);
    } else {
      pendingNearEarth.current = false;
      tourAngle.current = Math.atan2(camera.position.z, camera.position.x);
      computeSystemPose(toPos.current, toTarget.current);
    }

    transitionT.current = 0;
    transitioning.current = true;
    if (next === "system") introDone.current = true;
  };

  useEffect(() => {
    if (prevScale.current === viewScale) return;
    prevScale.current = viewScale;
    beginTransition(viewScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScale]);

  // Enter/exit ISS focus — reframe near Earth without changing viewScale
  useEffect(() => {
    if (prevIssFocus.current === issFocus) return;
    prevIssFocus.current = issFocus;
    if (viewScale === "nearEarth") beginTransition("nearEarth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issFocus, viewScale]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;

    // Start delayed near-Earth handoff once Earth reports a live position
    if (pendingNearEarth.current && viewScale === "nearEarth") {
      const earth = getEarthLive();
      if (earth) beginTransition("nearEarth");
    }

    // —— Frozen pose-to-pose handoff
    if (transitioning.current) {
      if (controls) controls.enabled = false;

      transitionT.current = Math.min(
        1,
        transitionT.current + dt / TRANSITION_SEC,
      );
      const u = smoothstep(transitionT.current);

      camera.position.lerpVectors(fromPos.current, toPos.current, u);
      target.current.lerpVectors(fromTarget.current, toTarget.current, u);
      camera.lookAt(target.current);
      if (controls) {
        controls.target.copy(target.current);
        // Avoid controls.update() clamping during transition (can flash)
      }

      if (transitionT.current >= 1) {
        transitioning.current = false;
        camera.position.copy(toPos.current);
        target.current.copy(toTarget.current);
        if (controls) {
          controls.target.copy(toTarget.current);
          controls.update();
        }
      }
      return;
    }

    // —— Near-Earth neighborhood framing
    if (viewScale === "nearEarth" && (cameraMode !== "free" || issFocus)) {
      if (controls) controls.enabled = cameraMode === "free" && !issFocus;
      const earth = getEarthLive() ?? earthPosRef?.current;
      if (!earth) return;

      if (issFocus) {
        tourAngle.current += dt * 0.12;
        const r = 7.2;
        desired.current.set(
          earth.x + Math.cos(tourAngle.current) * r,
          earth.y + 3.2,
          earth.z + Math.sin(tourAngle.current) * r,
        );
        target.current.lerp(earth, 1 - Math.exp(-2.5 * dt));
      } else if (cameraMode === "focus" && selectedItem) {
        const tracked = livePos.current.get(selectedItem.id) ?? earth;
        target.current.lerp(tracked, 1 - Math.exp(-2.4 * dt));
        const dist = isAsteroid(selectedItem) ? 6 : 14;
        desired.current.set(
          tracked.x + dist * 0.7,
          tracked.y + dist * 0.4,
          tracked.z + dist * 0.55,
        );
      } else if (cameraMode === "free") {
        return;
      } else {
        tourAngle.current += dt * 0.08;
        const r = 16;
        desired.current.set(
          earth.x + Math.cos(tourAngle.current) * r,
          earth.y + 8,
          earth.z + Math.sin(tourAngle.current) * r,
        );
        target.current.lerp(earth, 1 - Math.exp(-2 * dt));
      }
      // Gentle follow — avoid aggressive lerp that strobes when Earth steps
      camera.position.lerp(desired.current, 1 - Math.exp(-1.6 * dt));
      camera.lookAt(target.current);
      if (controls) {
        controls.target.copy(target.current);
      }
      return;
    }

    // Intro ease (system only, first load)
    if (!introDone.current && cameraMode === "tour" && viewScale === "system") {
      desired.current.set(28, 38, 64);
      camera.position.lerp(desired.current, 1 - Math.exp(-1.2 * dt));
      if (camera.position.distanceTo(desired.current) < 1.5) {
        introDone.current = true;
      }
      camera.lookAt(origin.current);
      if (controls) controls.enabled = false;
      return;
    }

    // Tour — cinematic auto-orbit around the system (or Earth in near-Earth handled above)
    if (cameraMode === "tour") {
      if (controls) controls.enabled = false;
      tourAngle.current += dt * 0.07;
      const r = 72;
      const elev = 34;
      desired.current.set(
        Math.cos(tourAngle.current) * r,
        elev,
        Math.sin(tourAngle.current) * r,
      );
      camera.position.lerp(desired.current, 1 - Math.exp(-1.5 * dt));
      target.current.lerp(origin.current, 0.08);
      camera.lookAt(target.current);
      if (controls) controls.target.copy(target.current);
      return;
    }

    // Focus — dolly to selection; with no selection, fall through to free
    if (cameraMode === "focus" && selectedItem) {
      if (controls) controls.enabled = false;
      const tracked =
        livePos.current.get(selectedItem.id) ??
        trackedTmp.current.set(
          selectedItem.position.x,
          selectedItem.position.y,
          selectedItem.position.z,
        );
      target.current.lerp(tracked, 1 - Math.exp(-3 * dt));
      const dist = isAsteroid(selectedItem) ? 11 : 28;
      const height = isAsteroid(selectedItem) ? 5 : 12;
      const side = 0.65;
      desired.current.set(
        tracked.x +
          dist * Math.cos(tourAngle.current * 0.25) * side +
          dist * 0.55,
        tracked.y + height,
        tracked.z +
          dist * Math.sin(tourAngle.current * 0.25) * side +
          dist * 0.45,
      );
      tourAngle.current += dt * 0.15;
      camera.position.lerp(desired.current, 1 - Math.exp(-2.2 * dt));
      camera.lookAt(target.current);
      if (controls) controls.target.copy(target.current);
      return;
    }

    // Home framing after clear selection — ease to system overview once
    if (homeFrame.current) {
      if (controls) controls.enabled = false;
      desired.current.set(48, 52, 88);
      target.current.lerp(origin.current, 1 - Math.exp(-2.5 * dt));
      camera.position.lerp(desired.current, 1 - Math.exp(-2.2 * dt));
      camera.lookAt(target.current);
      if (controls) controls.target.copy(target.current);
      if (camera.position.distanceTo(desired.current) < 2.5) {
        homeFrame.current = false;
        if (controls) {
          controls.enabled = !issFocus;
          controls.update();
        }
      }
      return;
    }

    // Free (default) — user OrbitControls; also used when Focus has no selection
    if (controls) {
      controls.enabled = !issFocus;
      controls.update();
    }
  });

  return null;
}
