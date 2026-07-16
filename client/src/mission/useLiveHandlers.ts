import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import axios from "axios";
import type {
  Asteroid,
  CelestialItem,
  Planet,
  SbdbOrbitResult,
  SentryWatchItem,
  SentryWatchlist,
} from "@shared";
import { designationForSbdb, formatExportSummary, isAsteroid } from "@shared";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  asteroidFromSentrySbdb,
  isSentrySceneId,
  sentrySceneId,
} from "../lib/sentryBody";
import { copyShareUrl, type OrbitUrlState } from "../lib/urlState";
import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import type { GuidedTourId } from "../components/mission/GuidedTours";
import type { ViewMode } from "../components/mission/MissionTopBar";
import type { MissionStepId } from "../content/site";
import { useSentryDetail } from "../hooks/useSentryDetail";
import { closestAsteroid } from "../lib/neoSort";
import type { LiveMissionAction, LiveMissionState } from "./liveMissionState";
import { findAsteroidByRef } from "./findAsteroid";
import { resolveDisplaySelected } from "./liveDerived";
import type { ViewScale } from "../sim/useSim";
import type { PaginatedResponse } from "@shared";

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
 * Live UI handlers + ephemeral Sentry/copy/export state.
 * Owns useSentryDetail (depends on brief summary).
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

  const {
    approachDate,
    showHazardous,
    compareIds,
    showIss,
    issFocus,
    sentryBriefDes,
    rulerEnabled,
    rulerA,
    rulerB,
  } = live;

  const [copyLinkStatus, setCopyLinkStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [sentryBriefSummary, setSentryBriefSummary] =
    useState<SentryWatchItem | null>(null);
  const [sbdbHint, setSbdbHint] = useState<string | null>(null);
  /** Synthetic body from Sentry+SBDB drawn in the scene */
  const [sentrySceneBody, setSentrySceneBody] = useState<Asteroid | null>(null);
  const [exportStatus, setExportStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");


  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const {
    detail: sentryDetail,
    loading: sentryDetailLoading,
    error: sentryDetailError,
  } = useSentryDetail(sentryBriefDes, sentryBriefSummary);

  const displaySelected = useMemo(
    () => resolveDisplaySelected(selectedItem, sbdb, sentrySceneBody),
    [selectedItem, sbdb, sentrySceneBody]
  );

  const handleItemClick = useCallback(
    (item: CelestialItem) => {
      // P6 ruler: pick A then B before normal selection
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
        // Still select for inspector context
      }

      // Switching to a normal body clears any Sentry-only inject
      if (isAsteroid(item) && !isSentrySceneId(item.id)) {
        setSentrySceneBody(null);
        dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
        setSentryBriefSummary(null);
        setSbdbHint(null);
      }
      setSelectedItem(item);
      if (!rulerEnabled) setCameraMode("focus");
      dispatchLive({ type: "SET_ISS_FOCUS", value: false });
      window.dispatchEvent(new Event("orbit-sfx-click"));
      if (mode !== "live") {
        setMode("live");
        goToStep("live");
      }
    },
    [mode, goToStep, setCameraMode, rulerEnabled, rulerA, rulerB],
  );

  const handleSelectDate = useCallback((iso: string) => {
    dispatchLive({ type: "SET_DATE", date: iso });
    dispatchLive({ type: "SET_PAGE", page: 1 });
    setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
  }, []);

  const handleHazardousChange = useCallback((value: boolean) => {
    dispatchLive({ type: "SET_HAZARDOUS", value: value });
    dispatchLive({ type: "SET_PAGE", page: 1 });
    dispatchLive({ type: "SET_SEARCH", value: "" });
    setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
  }, []);

  const handlePageChange = useCallback((next: number) => {
    dispatchLive({ type: "SET_PAGE", page: Math.max(1, next) });
    setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    dispatchLive({ type: "SET_SEARCH", value });
  }, []);

  const handleToggleCompare = useCallback(() => {
    if (!displaySelected || !isAsteroid(displaySelected)) return;
    dispatchLive({ type: "TOGGLE_COMPARE", id: displaySelected.id });
  }, [displaySelected]);

  const handleClearCompare = useCallback(() => {
    dispatchLive({ type: "CLEAR_COMPARE" });
  }, []);

  const handleRemoveCompare = useCallback((id: string) => {
    dispatchLive({ type: "REMOVE_COMPARE", id });
  }, []);

  /** Fetch SBDB and inject a synthetic body into the 3D scene. */
  const promoteSentryToScene = useCallback(
    async (des: string, summary: SentryWatchItem | null) => {
      const sstr = designationForSbdb({
        designation: des,
        name: summary?.fullname ?? des,
      });
      setSbdbHint("Looking up JPL SBDB and drawing orbit…");
      try {
        const res = await axios.get<SbdbOrbitResult>(`${apiBase}/sbdb`, {
          params: { sstr },
          timeout: 12_000,
        });
        const data = res.data;
        if (!data.found || !data.orbit) {
          setSbdbHint(data.message ?? "Not found in SBDB — cannot draw orbit.");
          return null;
        }
        const body = asteroidFromSentrySbdb(des, data, summary);
        if (!body) {
          setSbdbHint("Could not build scene body from SBDB.");
          return null;
        }
        setSentrySceneBody(body);
        setSelectedItem(body);
        setCameraMode("focus");
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        setViewScale("system"); // SBDB orbits are heliocentric — System view is honest
        setSbdbHint(
          `Drawn in scene · SBDB a=${data.aAu?.toFixed(3)} au · e=${data.e?.toFixed(3)} · System view recommended`,
        );
        return body;
      } catch {
        setSbdbHint("SBDB lookup failed — try again later.");
        return null;
      }
    },
    [apiBase, setCameraMode, setViewScale],
  );

  const handleSentryPickDes = useCallback(
    (des: string) => {
      const pool = [
        ...(asteroidsData?.data ?? []),
        ...(sentrySceneBody ? [sentrySceneBody] : []),
      ];
      const found =
        findAsteroidByRef(pool, des) ||
        findAsteroidByRef(pool, sentrySceneId(des));
      if (found) {
        dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
        setSentryBriefSummary(null);
        setSbdbHint(null);
        setSelectedItem(found);
        setCameraMode("focus");
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        return;
      }
      // Soft briefing + auto-promote to scene via SBDB (production path)
      const summary =
        sentryList?.items.find(
          (it) =>
            it.des.toLowerCase() === des.toLowerCase() ||
            it.fullname.toLowerCase().includes(des.toLowerCase()),
        ) ?? null;
      setSentryBriefSummary(summary);
      dispatchLive({ type: "SET_SENTRY_BRIEF", des: des });
      setSbdbHint(null);
      void promoteSentryToScene(des, summary);
    },
    [
      asteroidsData,
      sentryList,
      sentrySceneBody,
      setCameraMode,
      promoteSentryToScene,
    ],
  );

  // Deep-link ?sentry=DES — open Sentry + promote once
  useEffect(() => {
    if (!pendingSentry.current || mode !== "live") return;
    const des = pendingSentry.current;
    pendingSentry.current = null;
    dispatchLive({ type: "SET_SENTRY", show: true });
    handleSentryPickDes(des);
  }, [mode, handleSentryPickDes]);

  /** Full reset when leaving Sentry briefing / unselecting a Sentry-only body */
  const resetSentryState = useCallback(() => {
    dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
    setSentryBriefSummary(null);
    setSbdbHint(null);
    setSentrySceneBody(null);
    setSelectedItem((cur) => {
      if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) return null;
      return cur;
    });
  }, []);

  const handleDismissSentryBrief = useCallback(() => {
    resetSentryState();
  }, [resetSentryState]);

  const handleClearSelection = useCallback(() => {
    setSelectedItem((cur) => {
      if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) {
        // Clearing a Sentry-only selection = full reset
        dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
        setSentryBriefSummary(null);
        setSbdbHint(null);
        setSentrySceneBody(null);
        return null;
      }
      return null;
    });
  }, []);

  const handleSentryLookupSbdb = useCallback(() => {
    if (!sentryBriefDes) return;
    void promoteSentryToScene(sentryBriefDes, sentryBriefSummary);
  }, [sentryBriefDes, sentryBriefSummary, promoteSentryToScene]);

  const handleShowIssChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_ISS", show: v });
      if (!v) dispatchLive({ type: "SET_ISS_FOCUS", value: false });
      else {
        setViewScale("nearEarth");
      }
    },
    [setViewScale],
  );

  const handleIssFocusChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_ISS_FOCUS", value: v });
      if (v) {
        dispatchLive({ type: "SET_ISS", show: true });
        setViewScale("nearEarth");
        setCameraMode("tour");
        // Leaving Sentry selection when entering ISS focus
        setSelectedItem(null);
        dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
        setSentryBriefSummary(null);
        setSbdbHint(null);
        setSentrySceneBody(null);
      }
    },
    [setViewScale, setCameraMode],
  );

  const handleShowSentryChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_SENTRY", show: v });
      if (!v) {
        // Closing Sentry panel = full reset of Sentry inject
        dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
        setSentryBriefSummary(null);
        setSbdbHint(null);
        setSentrySceneBody(null);
        setSelectedItem((cur) => {
          if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) return null;
          return cur;
        });
      }
    },
    [],
  );

  const handleExportSummary = useCallback(async () => {
    if (!displaySelected || !isAsteroid(displaySelected)) return;
    const a = displaySelected;
    const text = formatExportSummary({
      name: a.name,
      designation: a.designation,
      isHazardous: a.isHazardous,
      approach: a.approach,
      diameterKmMin: a.diameterKmMin,
      diameterKmMax: a.diameterKmMax,
      sizeKm: a.size,
      orbitSource: a.orbitSource,
      e: a.orbit.eccentricity,
      iDeg: (a.orbit.inclination * 180) / Math.PI,
      periodYears: a.orbit.periodYears,
      aAu: sbdb?.found ? sbdb.aAu : undefined,
    });
    try {
      await navigator.clipboard.writeText(text);
      setExportStatus("copied");
    } catch {
      setExportStatus("failed");
    }
    window.setTimeout(() => setExportStatus("idle"), 2000);
  }, [displaySelected, sbdb]);

  const handleGuidedTour = useCallback(
    (id: GuidedTourId) => {
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
      }
    },
    [
      goToStep,
      setViewScale,
      setCameraMode,
      filteredAsteroids,
      planetsData,
      handleIssFocusChange,
      setTrueScale,
      trueScale,
    ],
  );

  const handleRulerVsEarth = useCallback(() => {
    if (!displaySelected || !isAsteroid(displaySelected)) return;
    dispatchLive({ type: "SET_RULER_ENABLED", value: true });
    dispatchLive({ type: "SET_RULER_A", value: {
      kind: "body",
      id: displaySelected.id,
      name: displaySelected.name,
    } });
    dispatchLive({ type: "SET_RULER_B", value: { kind: "body", id: "planet:Earth", name: "Earth" } });
  }, [displaySelected]);

  const handleRulerVsSun = useCallback(() => {
    if (!displaySelected) return;
    dispatchLive({ type: "SET_RULER_ENABLED", value: true });
    dispatchLive({ type: "SET_RULER_A", value: {
      kind: "body",
      id: displaySelected.id,
      name: displaySelected.name,
    } });
    dispatchLive({ type: "SET_RULER_B", value: { kind: "sun", name: "Sun" } });
  }, [displaySelected]);

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
    viewScale,
    approachDate,
    compareIds,
    showHazardous,
    sentryBriefDes,
    issFocus,
    showIss,
  ]);


  return {
    displaySelected,
    copyLinkStatus,
    sentryBriefSummary,
    sbdbHint,
    sentrySceneBody,
    exportStatus,
    sentryDetail: sentryDetail ?? null,
    sentryDetailLoading,
    sentryDetailError: sentryDetailError ?? null,
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
    handleExportSummary,
    handleGuidedTour,
    handleRulerVsEarth,
    handleRulerVsSun,
    handleCopyLink,
  };
}
