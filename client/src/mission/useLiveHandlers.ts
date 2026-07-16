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
    (next: number) => {
      dispatchLive({ type: "SET_PAGE", page: Math.max(1, next) });
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
      if (!v) dispatchLive({ type: "SET_ISS_FOCUS", value: false });
      else setViewScale("nearEarth");
    },
    [setViewScale, dispatchLive]
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
      }
    },
    [
      setViewScale,
      setCameraMode,
      dispatchLive,
      setSelectedItem,
      wipeSentryForIssFocus,
    ]
  );

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
    exportStatus: share.exportStatus,
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
    handleDismissSentryBrief,
    handleClearSelection,
    handleSentryLookupSbdb,
    handleShowIssChange,
    handleIssFocusChange,
    handleShowSentryChange,
    handleExportSummary: share.handleExportSummary,
    handleGuidedTour,
    handleRulerVsEarth: share.handleRulerVsEarth,
    handleRulerVsSun: share.handleRulerVsSun,
    handleCopyLink: share.handleCopyLink,
  };
}
