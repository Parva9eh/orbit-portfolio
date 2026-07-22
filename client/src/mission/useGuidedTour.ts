import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Asteroid, CelestialItem, Planet } from "@shared";
import type { GuidedTourId } from "../components/mission/GuidedTours";
import type { ViewMode } from "../components/mission/MissionTopBar";
import type { MissionStepId } from "../content/site";
import { closestAsteroid } from "../lib/neoSort";
import { trackGuidedTour } from "../lib/analytics";
import type { LiveMissionAction } from "./liveMissionState";
import type { ViewScale } from "../sim/useSim";
import type { PaginatedResponse } from "@shared";

export type GuidedTourArgs = {
  dispatchLive: Dispatch<LiveMissionAction>;
  setMode: Dispatch<SetStateAction<ViewMode>>;
  goToStep: (step: MissionStepId) => void;
  setCameraMode: (mode: "free" | "tour" | "focus") => void;
  setViewScale: (v: ViewScale) => void;
  setTrueScale: (v: boolean) => void;
  trueScale: boolean;
  setSelectedItem: Dispatch<SetStateAction<CelestialItem | null>>;
  filteredAsteroids: Asteroid[];
  planetsData: PaginatedResponse<Planet> | null | undefined;
  handleIssFocusChange: (v: boolean) => void;
};

/**
 * One-click guided demos (closest NEO, Earth, ISS, system, true scale, MW context).
 * Stays planetary mission control — no separate galaxy-map mode.
 */
export function useGuidedTour({
  dispatchLive,
  setMode,
  goToStep,
  setCameraMode,
  setViewScale,
  setTrueScale,
  trueScale,
  setSelectedItem,
  filteredAsteroids,
  planetsData,
  handleIssFocusChange,
}: GuidedTourArgs) {
  const handleGuidedTour = useCallback(
    (id: GuidedTourId) => {
      trackGuidedTour(id);
      dispatchLive({ type: "SET_ISS_FOCUS", value: false });
      if (id === "closest") {
        setMode("live");
        goToStep("live");
        setViewScale("nearEarth");
        const c = closestAsteroid(filteredAsteroids);
        if (c) {
          setSelectedItem(c);
          setCameraMode("focus");
        }
        return;
      }
      if (id === "earth") {
        setMode("live");
        goToStep("live");
        setViewScale("nearEarth");
        dispatchLive({ type: "SET_ISS", show: false });
        setCameraMode("tour");
        const earth = planetsData?.data?.find((p) => p.name === "Earth");
        if (earth) setSelectedItem(earth);
        return;
      }
      if (id === "iss") {
        setMode("live");
        goToStep("live");
        handleIssFocusChange(true);
        return;
      }
      if (id === "system") {
        setMode("live");
        goToStep("live");
        setViewScale("system");
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        setCameraMode("tour");
        setSelectedItem(null);
        return;
      }
      if (id === "trueScale") {
        setTrueScale(!trueScale);
        setViewScale("system");
        setCameraMode("tour");
        return;
      }
      if (id === "milkyWay") {
        // Schematic galactic context: system framing + free cam to see the band
        setMode("live");
        goToStep("live");
        setViewScale("system");
        dispatchLive({ type: "SET_ISS", show: false, focus: false });
        setSelectedItem(null);
        setCameraMode("free");
        window.dispatchEvent(new CustomEvent("orbit-camera-home"));
      }
    },
    [
      dispatchLive,
      setMode,
      goToStep,
      setViewScale,
      setCameraMode,
      filteredAsteroids,
      planetsData,
      handleIssFocusChange,
      setTrueScale,
      trueScale,
      setSelectedItem,
    ]
  );

  return { handleGuidedTour };
}
