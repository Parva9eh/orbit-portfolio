import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSimActions, useSimSettings } from "./useSim";

export function SimTicker() {
  const { simTimeRef, timeScaleRef } = useSimActions();
  useFrame((_, dt) => {
    simTimeRef.current += dt * timeScaleRef.current;
  });
  return null;
}

export function FrameloopController() {
  const { timeScale, cameraMode } = useSimSettings();
  const { invalidate, set } = useThree();

  const needAlways = timeScale !== 0 || cameraMode !== "free";

  useEffect(() => {
    set({ frameloop: needAlways ? "always" : "demand" });
    invalidate();
  }, [needAlways, set, invalidate]);

  useEffect(() => {
    if (needAlways) return;
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    let dragging = false;
    const onDown = () => {
      dragging = true;
      invalidate();
    };
    const onMove = () => {
      if (dragging) invalidate();
    };
    const onUp = () => {
      dragging = false;
      let n = 0;
      const tick = () => {
        invalidate();
        if (++n < 30) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [needAlways, invalidate]);

  return null;
}
