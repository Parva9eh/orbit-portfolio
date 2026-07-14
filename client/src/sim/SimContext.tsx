import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ActionsCtx, SettingsCtx } from "./contexts";
import { useSimActions, useSimSettings } from "./useSim";

export type TimeScalePreset = 0 | 0.1 | 1 | 10;
export type CameraMode = "free" | "tour" | "focus";
export type QualityPreset = "low" | "cinematic";
export type ViewScale = "system" | "nearEarth";

/** Settings that drive scene LOD / camera — consumers re-render when these change. */
export type SimSettings = {
  timeScale: TimeScalePreset;
  trueScale: boolean;
  showLabels: boolean;
  audioEnabled: boolean;
  cameraMode: CameraMode;
  quality: QualityPreset;
  viewScale: ViewScale;
};

/** Stable actions + clock refs — identity does not change every tick. */
export type SimActions = {
  setTimeScale: (s: TimeScalePreset) => void;
  setTrueScale: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setAudioEnabled: (v: boolean) => void;
  setCameraMode: (m: CameraMode) => void;
  setQuality: (q: QualityPreset) => void;
  setViewScale: (v: ViewScale) => void;
  simTimeRef: React.MutableRefObject<number>;
  /** Always-current time scale for the ticker (no React subscribe). */
  timeScaleRef: React.MutableRefObject<TimeScalePreset>;
  getSimTime: () => number;
};

export function SimProvider({ children }: { children: ReactNode }) {
  const [timeScale, setTimeScaleState] = useState<TimeScalePreset>(1);
  const [trueScale, setTrueScale] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>("tour");
  const [quality, setQuality] = useState<QualityPreset>("cinematic");
  const [viewScale, setViewScale] = useState<ViewScale>("system");

  const simTimeRef = useRef(0);
  const timeScaleRef = useRef<TimeScalePreset>(1);

  const setTimeScale = useCallback((s: TimeScalePreset) => {
    timeScaleRef.current = s;
    setTimeScaleState(s);
  }, []);

  const getSimTime = useCallback(() => simTimeRef.current, []);

  const settings = useMemo<SimSettings>(
    () => ({
      timeScale,
      trueScale,
      showLabels,
      audioEnabled,
      cameraMode,
      quality,
      viewScale,
    }),
    [
      timeScale,
      trueScale,
      showLabels,
      audioEnabled,
      cameraMode,
      quality,
      viewScale,
    ],
  );

  // Actions object is stable (only refs + useCallback setters)
  const actions = useMemo<SimActions>(
    () => ({
      setTimeScale,
      setTrueScale,
      setShowLabels,
      setAudioEnabled,
      setCameraMode,
      setQuality,
      setViewScale,
      simTimeRef,
      timeScaleRef,
      getSimTime,
    }),
    [setTimeScale, getSimTime],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <SettingsCtx.Provider value={settings}>{children}</SettingsCtx.Provider>
    </ActionsCtx.Provider>
  );
}

/** Scene / camera / LOD — re-renders only when settings change. */
/**
 * Inside Canvas: advances sim clock from timeScaleRef (no settings re-subscribe).
 * When paused (0), still runs but adds 0 — FrameloopController may switch to demand.
 */
export function SimTicker() {
  const { simTimeRef, timeScaleRef } = useSimActions();
  useFrame((_, dt) => {
    simTimeRef.current += dt * timeScaleRef.current;
  });
  return null;
}

/**
 * Switch R3F to demand when paused + free camera (saves GPU).
 * Tour/Focus and any non-zero time scale keep always loop.
 * OrbitControls invalidate on interaction while in demand mode.
 */
export function FrameloopController() {
  const { timeScale, cameraMode } = useSimSettings();
  const { invalidate, set } = useThree();

  const needAlways = timeScale !== 0 || cameraMode !== "free";

  useEffect(() => {
    set({ frameloop: needAlways ? "always" : "demand" });
    // Kick one frame so the last pose paints
    invalidate();
  }, [needAlways, set, invalidate]);

  // While demand + free: keep invalidating during pointer drag on the canvas
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
      // a few frames for damping settle
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
