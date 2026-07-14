import { useContext } from "react";
import type {
  SimActions,
  SimSettings,
  TimeScalePreset,
  CameraMode,
  QualityPreset,
  ViewScale,
} from "./SimContext";
import { ActionsCtx, SettingsCtx } from "./contexts";

export type { TimeScalePreset, CameraMode, QualityPreset, ViewScale };

export function useSimSettings(): SimSettings {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSimSettings must be used within SimProvider");
  return ctx;
}

export function useSimActions(): SimActions {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error("useSimActions must be used within SimProvider");
  return ctx;
}

export function useSim(): SimSettings & SimActions {
  return { ...useSimSettings(), ...useSimActions() };
}
