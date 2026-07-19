import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  Asteroid,
  CelestialItem,
  Planet,
  SbdbOrbitResult,
  SentryWatchlist,
} from "@shared";
import { isAsteroid } from "@shared";
import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import type { ViewMode } from "../components/mission/MissionTopBar";
import type { MissionStepId } from "../content/site";
import type { LiveMissionAction, LiveMissionState } from "./liveMissionState";
import { resolveDisplaySelected } from "./liveDerived";
import type { ViewScale } from "../sim/useSim";
import type { PaginatedResponse } from "@shared";
import { useSentryLive } from "./useSentryLive";
import { useShareAndRuler } from "./useShareAndRuler";
import { useGuidedTour } from "./useGuidedTour";

export type LiveHandlersArgs = {
  live: LiveMissionState;
  dispatchLive: Dispatch<LiveMissionAction>;
  mode: ViewMode;
  setMode: Dispatch<SetStateAction<ViewMode>>;
  goToStep: (step: MissionStepId) => void;
  setCameraMode: (mode: "free" | "tour" | "focus") => void;
  setViewScale: (v: ViewScale) => void;
  setTrueScale: (v: boolean) => void;
  viewScale: ViewScale;
  trueScale: boolean;
  selectedItem: CelestialItem | null;
  setSelectedItem: Dispatch<SetStateAction<CelestialItem | null>>;
  asteroidsData: PaginatedResponse<Asteroid> | null | undefined;
  planetsData: PaginatedResponse<Planet> | null | undefined;
  filteredAsteroids: Asteroid[];
  sbdb: SbdbOrbitResult | null | undefined;
  sentryList: SentryWatchlist | null | undefined;
  pendingSentry: MutableRefObject<string | null>;
};

/**
 * Live UI handlers composer: selection/filters/ISS + sentry + share/ruler + tours.
 */
export function useLiveHandlers(args: LiveHandlersArgs) {
  const {
    live,
    dispatchLive,
    mode,
    setMode,
    goToStep,
    setCameraMode,
    setViewScale,
    setTrueScale,
    viewScale,
    trueScale,
    selectedItem,
    setSelectedItem,
    asteroidsData,
    planetsData,
    filteredAsteroids,
    sbdb,
    sentryList,
    pendingSentry,
  } = args;

  const { rulerEnabled, rulerA, rulerB } = live;

  const sentry = useSentryLive({
    live,
    dispatchLive,
    mode,
    setCameraMode,
    setViewScale,
    setSelectedItem,
    asteroidsData,
    sentryList,
    pendingSentry,
  });

  const {
    sentryBriefSummary,
    sbdbHint,
    sentrySceneBody,
    sentryDetail,
    sentryDetailLoading,
    sentryDetailError,
    handleSentryPickDes,
    handleDismissSentryBrief,
    handleClearSelection,
    handleSentryLookupSbdb,
    handleShowSentryChange,
    clearSentryOnCatalogSelect,
    wipeSentryForIssFocus,
  } = sentry;

  const displaySelected = useMemo(
    () => resolveDisplaySelected(selectedItem, sbdb, sentrySceneBody),
    [selectedItem, sbdb, sentrySceneBody]
  );

  const share = useShareAndRuler({
    live,
    dispatchLive,
    displaySelected,
    sbdb,
    viewScale,
  });

  const handleItemClick = useCallback(
    (item: CelestialItem) => {
      if (rulerEnabled) {
        const ep: RulerEndpoint = {
          kind: "body",
          id: item.id,
          name: item.name,
        };
        if (!rulerA || (rulerA && rulerB)) {
          dispatchLive({ type: "SET_RULER_A", value: ep });
          dispatchLive({ type: "SET_RULER_B", value: null });
          dispatchLive({ type: "SET_RULER_DIST", value: null });
        } else if (
          rulerA.kind === "sun" ||
          (rulerA.kind === "body" && rulerA.id !== item.id)
        ) {
          dispatchLive({ type: "SET_RULER_B", value: ep });
        }
      }

      clearSentryOnCatalogSelect(item);
      setSelectedItem(item);
      if (!rulerEnabled) setCameraMode("focus");
      dispatchLive({ type: "SET_ISS_FOCUS", value: false });
      window.dispatchEvent(new Event("orbit-sfx-click"));
      if (mode !== "live") {
        setMode("live");
        goToStep("live");
      }
    },
    [
      mode,
      goToStep,
      setCameraMode,
      rulerEnabled,
      rulerA,
      rulerB,
      dispatchLive,
      setSelectedItem,
      setMode,
      clearSentryOnCatalogSelect,
    ]
  );

  /** Free camera + system overview framing (clear Inspect / leave ISS·Sentry). */
  const restoreSystemHome = useCallback(() => {
    setCameraMode("free");
    setViewScale("system");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("orbit-camera-home"));
    }
  }, [setCameraMode, setViewScale]);

  /**
   * Close Inspect: drop selection, free the camera, return to system overview.
   * Better than leaving Focus mode stuck at the last dolly pose.
   */
  const handleClearSelectionHome = useCallback(() => {
    handleClearSelection();
    dispatchLive({ type: "SET_ISS_FOCUS", value: false });
    restoreSystemHome();
  }, [handleClearSelection, dispatchLive, restoreSystemHome]);

  const handleSelectDate = useCallback(
    (iso: string) => {
      dispatchLive({ type: "SET_DATE", date: iso });
      dispatchLive({ type: "SET_PAGE", page: 1 });
      setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
    },
    [dispatchLive, setSelectedItem]
  );

  const handleHazardousChange = useCallback(
    (value: boolean) => {
      dispatchLive({ type: "SET_HAZARDOUS", value });
      dispatchLive({ type: "SET_PAGE", page: 1 });
      dispatchLive({ type: "SET_SEARCH", value: "" });
      setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
    },
    [dispatchLive, setSelectedItem]
  );

  const handlePageChange = useCallback(
    (next: number, totalPages?: number) => {
      let p = Math.max(1, Math.floor(next) || 1);
      if (totalPages != null && totalPages > 0) {
        p = Math.min(p, totalPages);
      }
      dispatchLive({ type: "SET_PAGE", page: p });
      setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
    },
    [dispatchLive, setSelectedItem]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      dispatchLive({ type: "SET_SEARCH", value });
    },
    [dispatchLive]
  );

  const handleToggleCompare = useCallback(() => {
    if (!displaySelected || !isAsteroid(displaySelected)) return;
    dispatchLive({ type: "TOGGLE_COMPARE", id: displaySelected.id });
  }, [displaySelected, dispatchLive]);

  const handleClearCompare = useCallback(() => {
    dispatchLive({ type: "CLEAR_COMPARE" });
  }, [dispatchLive]);

  const handleRemoveCompare = useCallback(
    (id: string) => {
      dispatchLive({ type: "REMOVE_COMPARE", id });
    },
    [dispatchLive]
  );

  const handleShowIssChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_ISS", show: v });
      if (!v) {
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        restoreSystemHome();
      } else {
        setViewScale("nearEarth");
      }
    },
    [setViewScale, dispatchLive, restoreSystemHome]
  );

  const handleIssFocusChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_ISS_FOCUS", value: v });
      if (v) {
        dispatchLive({ type: "SET_ISS", show: true });
        setViewScale("nearEarth");
        setCameraMode("tour");
        setSelectedItem(null);
        wipeSentryForIssFocus();
      } else {
        // Leave tight ISS framing; if ISS layer is still on stay near-Earth free,
        // otherwise return to system home.
        setCameraMode("free");
        if (!live.showIss) {
          restoreSystemHome();
        }
      }
    },
    [
      setViewScale,
      setCameraMode,
      dispatchLive,
      setSelectedItem,
      wipeSentryForIssFocus,
      live.showIss,
      restoreSystemHome,
    ]
  );

  const handleShowSentryChangeHome = useCallback(
    (v: boolean) => {
      handleShowSentryChange(v);
      if (!v) {
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        restoreSystemHome();
      }
    },
    [handleShowSentryChange, dispatchLive, restoreSystemHome]
  );

  const handleDismissSentryBriefHome = useCallback(() => {
    handleDismissSentryBrief();
    restoreSystemHome();
  }, [handleDismissSentryBrief, restoreSystemHome]);

  const { handleGuidedTour } = useGuidedTour({
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
  });

  return {
    displaySelected,
    copyLinkStatus: share.copyLinkStatus,
    sentryBriefSummary,
    sbdbHint,
    sentrySceneBody,
    sentryDetail,
    sentryDetailLoading,
    sentryDetailError,
    handleItemClick,
    handleSelectDate,
    handleHazardousChange,
    handlePageChange,
    handleSearchChange,
    handleToggleCompare,
    handleClearCompare,
    handleRemoveCompare,
    handleSentryPickDes,
    handleDismissSentryBrief: handleDismissSentryBriefHome,
    handleClearSelection: handleClearSelectionHome,
    handleSentryLookupSbdb,
    handleShowIssChange,
    handleIssFocusChange,
    handleShowSentryChange: handleShowSentryChangeHome,
    handleGuidedTour,
    handleRulerVsEarth: share.handleRulerVsEarth,
    handleRulerVsSun: share.handleRulerVsSun,
    handleCopyLink: share.handleCopyLink,
  };
}
