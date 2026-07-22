import { useCallback, useEffect, useMemo, useState, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { CelestialItem } from "@shared";
import { formatMiss, isAsteroid, isPlanet } from "@shared";
import ThreeDScene from "../components/ThreeDScene";
import type { MissionStepId } from "../content/site";
import type { LiveMissionTools } from "./LiveMissionContext";
import { isSentrySceneId } from "../lib/sentryBody";
import type { ViewMode } from "../components/mission/MissionTopBar";
import { FrameloopController, SimTicker } from "../sim/SimContext";
import { useSimActions, useSimSettings } from "../sim/useSim";
import { SceneBackdrop } from "../components/scene/SceneBackdrop";
import { qualitySettings } from "../sim/simUtils";
import { writeOrbitUrl, type OrbitUrlState } from "../lib/urlState";
import {
  buildCompareOrbits,
  buildSceneItems,
  rulerApproachMissLabel,
  rulerStatusLabel,
} from "./liveDerived";
import { useMissionSession } from "./useMissionSession";
import { useMissionFeeds } from "./useMissionFeeds";
import { useLiveHandlers } from "./useLiveHandlers";

export type MissionControlModel = {
  liveTools: LiveMissionTools;
  canvas: ReactNode;
  shell: {
    brand: string;
    step: MissionStepId;
    mode: ViewMode;
    onStepChange: (s: MissionStepId) => void;
    onModeChange: (m: ViewMode) => void;
    onEnterLive: () => void;
    /** Enable Live tools without forcing step 03 (mobile NEO tools chip). */
    onEnsureLiveMode: () => void;
    liveToolsOpen: boolean;
    status: {
      loading: boolean;
      error: Error | null;
      selectedItem: CelestialItem | null;
      /** Desktop hover chip (null when not hovering) */
      hoverTip: { text: string; kind: "planet" | "neo" | "pha" } | null;
      iss: import("@shared").IssPosition | null;
      showIss: boolean;
      issFocus: boolean;
      solar: import("../hooks/useDonkiSolar").DonkiSolarBadge | null;
      rulerLabel: string | null;
    };
  };
};

/**
 * Mission Control composer: session (nav/state) + feeds (data) + handlers +
 * scene/shell assembly. Page component only mounts provider + shell.
 */
export function useMissionControlModel(): MissionControlModel {
  const { setTrueScale } = useSimActions();
  const { viewScale, trueScale, quality } = useSimSettings();
  const q = qualitySettings(quality);

  const session = useMissionSession();
  const {
    siteBrand,
    step,
    mode,
    setMode,
    selectedItem,
    setSelectedItem,
    live,
    dispatchLive,
    liveToolsOpen,
    showAsteroids,
    goToStep,
    enterLive,
    ensureLiveMode,
    handleModeChange,
    pendingNeo,
    pendingCompare,
    pendingSentry,
    setCameraMode,
    setViewScale,
  } = session;

  const {
    approachDate,
    showPlanets,
    compareIds,
    showIss,
    issFocus,
    showHazardous,
    sentryBriefDes,
    rulerEnabled,
    rulerA,
    rulerB,
    rulerSceneDist,
  } = live;

  const feeds = useMissionFeeds({
    live,
    mode,
    showAsteroids,
    selectedItem,
    setSelectedItem,
    dispatchLive,
    pendingNeo,
    pendingCompare,
  });

  const {
    asteroidsData,
    planetsData,
    filteredAsteroids,
    closestSummary,
    sbdb,
    sbdbLoading,
    sbdbError,
    iss,
    issLive,
    issAcquiring,
    sentryList,
    sentryLoading,
    sentryError,
    solar,
    loading,
    error,
    totalItems,
    pageLimit,
    totalPages,
    currentPage,
    pagePending,
    astLoad,
    catalogError,
    refetchAsteroids,
  } = feeds;

  const handlers = useLiveHandlers({
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
  });

  const {
    displaySelected,
    copyLinkStatus,
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
    handleDismissSentryBrief,
    handleClearSelection,
    handleSentryLookupSbdb,
    handleShowIssChange,
    handleIssFocusChange,
    handleShowSentryChange,
    handleGuidedTour,
    handleRulerVsEarth,
    handleRulerVsSun,
    handleCopyLink,
  } = handlers;

  const [hoverItem, setHoverItem] = useState<CelestialItem | null>(null);

  const handleItemHover = useCallback((item: CelestialItem | null) => {
    setHoverItem(item);
  }, []);

  const hoverTip = useMemo(() => {
    if (!hoverItem) return null;
    if (displaySelected && hoverItem.id === displaySelected.id) return null;
    if (isAsteroid(hoverItem)) {
      const miss = hoverItem.approach
        ? formatMiss(hoverItem.approach.missLd, hoverItem.approach.missKm, {
            compact: true,
          })
        : null;
      const pha = hoverItem.isHazardous;
      const text = miss
        ? `${hoverItem.name} · miss ${miss}${pha ? " · PHA" : ""}`
        : `${hoverItem.name}${pha ? " · PHA" : ""}`;
      return { text, kind: pha ? ("pha" as const) : ("neo" as const) };
    }
    if (isPlanet(hoverItem)) {
      return {
        text: `${hoverItem.name} · planet · click to focus`,
        kind: "planet" as const,
      };
    }
    return null;
  }, [hoverItem, displaySelected]);

  const rulerApproachMiss = useMemo(
    () =>
      rulerApproachMissLabel(
        rulerA,
        rulerB,
        asteroidsData?.data ?? [],
        sentrySceneBody
      ),
    [rulerA, rulerB, asteroidsData, sentrySceneBody]
  );

  const rulerLabel = useMemo(
    () => rulerStatusLabel(rulerEnabled, rulerSceneDist),
    [rulerEnabled, rulerSceneDist]
  );

  const sceneItems = useMemo(
    () =>
      buildSceneItems({
        showPlanets,
        showAsteroids,
        planets: planetsData?.data ?? [],
        filteredAsteroids,
        displaySelected,
        sentrySceneBody,
      }),
    [
      filteredAsteroids,
      planetsData,
      showPlanets,
      showAsteroids,
      displaySelected,
      sentrySceneBody,
    ]
  );

  const compareOrbits = useMemo(
    () =>
      buildCompareOrbits({
        compareIds,
        catalog: asteroidsData?.data ?? [],
        displaySelected,
        orbitSegments: q.orbitSegments,
        trueScale,
      }),
    [compareIds, asteroidsData, displaySelected, q.orbitSegments, trueScale]
  );

  // Sync deep-link search params (live briefing only)
  useEffect(() => {
    const neoId =
      displaySelected && isAsteroid(displaySelected)
        ? isSentrySceneId(displaySelected.id)
          ? null
          : displaySelected.id
        : null;
    const sentryDes =
      sentryBriefDes ??
      (displaySelected &&
      isAsteroid(displaySelected) &&
      isSentrySceneId(displaySelected.id)
        ? displaySelected.designation ??
          displaySelected.id.replace(/^sentry:/, "")
        : null);
    const state: OrbitUrlState = {
      mode,
      view: viewScale,
      date: approachDate,
      neo: neoId,
      compare: compareIds,
      hazardous: showHazardous,
      sentry: sentryDes,
      issFocus: issFocus && showIss,
    };
    writeOrbitUrl(state);
  }, [
    mode,
    viewScale,
    approachDate,
    displaySelected,
    compareIds,
    showHazardous,
    sentryBriefDes,
    issFocus,
    showIss,
  ]);

  const liveTools: LiveMissionTools = useMemo(
    () => ({
      live,
      dispatchLive,
      selectedItem: displaySelected,
      onClearSelection: handleClearSelection,
      onSelectItem: handleItemClick,
      asteroids: filteredAsteroids,
      catalogAsteroids: asteroidsData?.data ?? [],
      closestSummary,
      totalItems,
      pageLimit,
      totalPages,
      currentPage,
      pagePending,
      loading: astLoad || pagePending,
      catalogError: catalogError ?? null,
      onRetryCatalog: () => refetchAsteroids(),
      onUseDemoCatalog: () => {
        dispatchLive({ type: "SET_FORCE_MOCK", value: true });
      },
      sbdb: sbdb ?? null,
      sbdbLoading,
      sbdbError: sbdbError ?? null,
      onToggleCompare: handleToggleCompare,
      onClearCompare: handleClearCompare,
      onRemoveCompare: handleRemoveCompare,
      onCopyLink: handleCopyLink,
      copyLinkStatus,
      iss: iss ?? null,
      issLive,
      issAcquiring,
      onShowIssChange: handleShowIssChange,
      onIssFocusChange: handleIssFocusChange,
      sentryList: sentryList ?? null,
      sentryLoading,
      sentryError: sentryError ?? null,
      onSentryPickDes: handleSentryPickDes,
      onShowSentryChange: handleShowSentryChange,
      sentryBriefSummary,
      sentryDetail,
      sentryDetailLoading,
      sentryDetailError,
      onDismissSentryBrief: handleDismissSentryBrief,
      onSentryLookupSbdb: handleSentryLookupSbdb,
      sentrySbdbHint: sbdbHint,
      rulerApproachMiss: rulerApproachMiss ?? null,
      onRulerVsEarth: handleRulerVsEarth,
      onRulerVsSun: handleRulerVsSun,
      onGuidedTour: handleGuidedTour,
      onSelectDate: handleSelectDate,
      onHazardousChange: handleHazardousChange,
      onPageChange: (p: number) => handlePageChange(p, totalPages),
      onSearchChange: handleSearchChange,
    }),
    [
      live,
      dispatchLive,
      displaySelected,
      handleClearSelection,
      handleItemClick,
      filteredAsteroids,
      asteroidsData,
      closestSummary,
      totalItems,
      pageLimit,
      totalPages,
      currentPage,
      pagePending,
      astLoad,
      catalogError,
      refetchAsteroids,
      handlePageChange,
      sbdb,
      sbdbLoading,
      sbdbError,
      handleToggleCompare,
      handleClearCompare,
      handleRemoveCompare,
      handleCopyLink,
      copyLinkStatus,
      iss,
      issLive,
      issAcquiring,
      handleShowIssChange,
      handleIssFocusChange,
      sentryList,
      sentryLoading,
      sentryError,
      handleSentryPickDes,
      handleShowSentryChange,
      sentryBriefSummary,
      sentryDetail,
      sentryDetailLoading,
      sentryDetailError,
      handleDismissSentryBrief,
      handleSentryLookupSbdb,
      sbdbHint,
      rulerApproachMiss,
      handleRulerVsEarth,
      handleRulerVsSun,
      handleGuidedTour,
      handleSelectDate,
      handleHazardousChange,
      handlePageChange,
      handleSearchChange,
    ]
  );

  const canvas = (
    <>
      <Canvas
        camera={{ position: [48, 52, 88], fov: 48, near: 0.1, far: 2500 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl, scene }) => {
          // Sync first paint — avoid white/default clear before SceneBackdrop
          const c = "#010308";
          gl.setClearColor(c, 1);
          scene.background = null; // SceneBackdrop owns background color
          gl.setClearColor(c, 1);
        }}
        className="!absolute inset-0 bg-[#010308]"
        style={{ background: "#010308" }}
      >
        <SceneBackdrop />
        <SimTicker />
        <FrameloopController />
        <Suspense fallback={null}>
          <ThreeDScene
            items={sceneItems}
            onItemClick={handleItemClick}
            onItemHover={handleItemHover}
            selectedItem={displaySelected}
            showPlanets={showPlanets}
            planetsData={planetsData?.data ?? []}
            compareOrbits={compareOrbits}
            showIss={showIss && mode === "live"}
            iss={iss}
            issFocus={issFocus && showIss && mode === "live"}
            measureAId={
              rulerEnabled && rulerA
                ? rulerA.kind === "sun"
                  ? "sun"
                  : rulerA.id
                : null
            }
            measureBId={
              rulerEnabled && rulerB
                ? rulerB.kind === "sun"
                  ? "sun"
                  : rulerB.id
                : null
            }
            onMeasureDistance={(d) =>
              dispatchLive({ type: "SET_RULER_DIST", value: d })
            }
          />
        </Suspense>
      </Canvas>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
          <span className="text-white/90 text-sm tracking-wide">
            Receiving telemetry…
          </span>
        </div>
      )}
    </>
  );

  return {
    liveTools,
    canvas,
    shell: {
      brand: siteBrand,
      step,
      mode,
      onStepChange: goToStep,
      onModeChange: handleModeChange,
      onEnterLive: enterLive,
      onEnsureLiveMode: ensureLiveMode,
      liveToolsOpen,
      status: {
        loading,
        error,
        selectedItem: displaySelected,
        hoverTip,
        iss: iss ?? null,
        showIss: showIss && mode === "live",
        issFocus,
        solar: solar ?? null,
        rulerLabel: rulerLabel ?? null,
      },
    },
  };
}
