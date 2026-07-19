import { useCallback, useState } from "react";
import type { Dispatch } from "react";
import type { CelestialItem, SbdbOrbitResult } from "@shared";
import { isAsteroid } from "@shared";
import { isSentrySceneId } from "../lib/sentryBody";
import { copyShareUrl, type OrbitUrlState } from "../lib/urlState";
import type { LiveMissionAction, LiveMissionState } from "./liveMissionState";
import type { ViewScale } from "../sim/useSim";

export type ShareAndRulerArgs = {
  live: LiveMissionState;
  dispatchLive: Dispatch<LiveMissionAction>;
  displaySelected: CelestialItem | null;
  sbdb: SbdbOrbitResult | null | undefined;
  viewScale: ViewScale;
};

/**
 * Copy share link and ruler quick-picks (vs Earth / Sun).
 */
export function useShareAndRuler({
  live,
  dispatchLive,
  displaySelected,
  viewScale,
}: ShareAndRulerArgs) {
  const {
    approachDate,
    showHazardous,
    compareIds,
    showIss,
    issFocus,
    sentryBriefDes,
  } = live;

  const [copyLinkStatus, setCopyLinkStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");

  const handleRulerVsEarth = useCallback(() => {
    if (!displaySelected || !isAsteroid(displaySelected)) return;
    dispatchLive({ type: "SET_RULER_ENABLED", value: true });
    dispatchLive({
      type: "SET_RULER_A",
      value: {
        kind: "body",
        id: displaySelected.id,
        name: displaySelected.name,
      },
    });
    dispatchLive({
      type: "SET_RULER_B",
      value: { kind: "body", id: "planet:Earth", name: "Earth" },
    });
  }, [displaySelected, dispatchLive]);

  const handleRulerVsSun = useCallback(() => {
    if (!displaySelected) return;
    dispatchLive({ type: "SET_RULER_ENABLED", value: true });
    dispatchLive({
      type: "SET_RULER_A",
      value: {
        kind: "body",
        id: displaySelected.id,
        name: displaySelected.name,
      },
    });
    dispatchLive({
      type: "SET_RULER_B",
      value: { kind: "sun", name: "Sun" },
    });
  }, [displaySelected, dispatchLive]);

  const handleCopyLink = useCallback(async () => {
    const neoId =
      displaySelected && isAsteroid(displaySelected)
        ? isSentrySceneId(displaySelected.id)
          ? null
          : displaySelected.id
        : null;
    const state: OrbitUrlState = {
      mode: "live",
      view: viewScale,
      date: approachDate,
      neo: neoId,
      compare: compareIds,
      hazardous: showHazardous,
      sentry: sentryBriefDes,
      issFocus: issFocus && showIss,
    };
    const ok = await copyShareUrl(state);
    setCopyLinkStatus(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyLinkStatus("idle"), 2000);
  }, [
    displaySelected,
    viewScale,
    approachDate,
    compareIds,
    showHazardous,
    sentryBriefDes,
    issFocus,
    showIss,
  ]);

  return {
    copyLinkStatus,
    handleRulerVsEarth,
    handleRulerVsSun,
    handleCopyLink,
  };
}
