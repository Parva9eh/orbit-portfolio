import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  Suspense,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { Asteroid, CelestialItem, Planet } from "@shared";
import {
  formatExportSummary,
  formatMiss,
  formatRulerDistance,
  isAsteroid,
  mergeAsteroidWithSbdb,
  sampleOrbitPath,
} from "@shared";
import ThreeDScene, {
  type CompareOrbitSpec,
} from "../components/ThreeDScene";
import { useApiData } from "../hooks/useApiData";
import { useSbdbOrbit } from "../hooks/useSbdbOrbit";
import { useIssPosition } from "../hooks/useIssPosition";
import { useSentryWatchlist } from "../hooks/useSentryWatchlist";
import { useSentryDetail } from "../hooks/useSentryDetail";
import { useDonkiSolar } from "../hooks/useDonkiSolar";
import { site, MISSION_STEPS, type MissionStepId } from "../content/site";
import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import type { GuidedTourId } from "../components/mission/GuidedTours";
import type { SbdbOrbitResult, SentryWatchItem } from "@shared";
import { designationForSbdb } from "@shared";
import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  initialLiveMissionState,
  liveMissionReducer,
} from "../mission/liveMissionState";
import { toThreePath } from "../lib/vec3";
import {
  asteroidFromSentrySbdb,
  isSentrySceneId,
  sentrySceneId,
} from "../lib/sentryBody";
import MissionTopBar, {
  type ViewMode,
} from "../components/mission/MissionTopBar";
import MissionDock from "../components/mission/MissionDock";
import LiveNeoPanel from "../components/mission/LiveNeoPanel";
import MissionStatusBar from "../components/mission/MissionStatusBar";
import VizControls, {
  captureCanvasScreenshot,
} from "../components/mission/VizControls";
import { FrameloopController, SimTicker } from "../sim/SimContext";
import { useSimActions, useSimSettings } from "../sim/useSim";
import { SceneBackdrop } from "../components/ThreeDScene";
import { qualitySettings, scalePosition } from "../sim/simUtils";
import { closestAsteroid, sortAsteroidsByMiss } from "../lib/neoSort";
import {
  COMPARE_COLORS,
  copyShareUrl,
  parseOrbitUrl,
  writeOrbitUrl,
  type OrbitUrlState,
} from "../lib/urlState";

const STEP_IDS = MISSION_STEPS.map((s) => s.id);

function readStepFromHash(): MissionStepId {
  const hash = window.location.hash.replace(/^#/, "");
  return STEP_IDS.includes(hash as MissionStepId)
    ? (hash as MissionStepId)
    : "briefing";
}

function findAsteroidByRef(
  list: Asteroid[],
  ref: string
): Asteroid | undefined {
  const q = ref.trim().toLowerCase();
  return list.find(
    (a) =>
      a.id.toLowerCase() === q ||
      a.designation?.toLowerCase() === q ||
      a.name.replace(/[()]/g, "").trim().toLowerCase() === q ||
      a.name.toLowerCase() === q,
  );
}

const MissionControl = React.memo(function MissionControl() {
  const { setCameraMode, setViewScale, setTrueScale } = useSimActions();
  const { viewScale, trueScale, quality } = useSimSettings();
  const q = qualitySettings(quality);

  const initialUrl = useMemo(() => parseOrbitUrl(), []);

  const [step, setStep] = useState<MissionStepId>(() => {
    const fromHash = readStepFromHash();
    if (initialUrl.mode === "live") return "live";
    return fromHash;
  });
  const [mode, setMode] = useState<ViewMode>(() => {
    if (initialUrl.mode === "live" || initialUrl.mode === "story") {
      return initialUrl.mode;
    }
    return readStepFromHash() === "live" ? "live" : "story";
  });
  const [selectedItem, setSelectedItem] = useState<CelestialItem | null>(null);
  const [live, dispatchLive] = useReducer(
    liveMissionReducer,
    initialUrl,
    initialLiveMissionState,
  );
  const {
    approachDate,
    page,
    searchTerm,
    showHazardous,
    showPlanets,
    compareIds,
    showIss,
    issFocus,
    showSentry,
    sentryBriefDes,
    maxMissLd,
    minDiameterM,
    rulerEnabled,
    rulerA,
    rulerB,
    rulerSceneDist,
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

  /** Apply deep-link neo/compare after feed loads */
  const pendingNeo = useRef<string | null>(initialUrl.neo ?? null);
  const pendingCompare = useRef<string[]>(initialUrl.compare ?? []);
  const pendingSentry = useRef<string | null>(initialUrl.sentry ?? null);
  const urlBootDone = useRef(false);

  const isDev = import.meta.env.MODE === "development";
  const liveToolsOpen = mode === "live";
  const showAsteroids = mode === "live";

  // Apply view from deep link once on boot
  useEffect(() => {
    if (urlBootDone.current) return;
    urlBootDone.current = true;
    if (initialUrl.mode === "live") {
      setMode("live");
      setStep("live");
      setViewScale(initialUrl.view ?? "nearEarth");
      setCameraMode("tour");
      if (initialUrl.issFocus) {
        dispatchLive({ type: "SET_ISS", show: true, focus: true });
        setViewScale("nearEarth");
      }
      if (initialUrl.sentry) {
        dispatchLive({ type: "SET_SENTRY", show: true, briefDes: initialUrl.sentry });
      }
    } else if (initialUrl.view) {
      setViewScale(initialUrl.view);
    }
  }, [initialUrl, setViewScale, setCameraMode]);

  const goToStep = useCallback((next: MissionStepId) => {
    if (!STEP_IDS.includes(next)) return;
    setStep(next);
    if (next === "live") setMode("live");
    const url = new URL(window.location.href);
    url.hash = next;
    window.history.replaceState({}, "", url);
  }, []);

  const enterLive = useCallback(() => {
    setMode("live");
    goToStep("live");
  }, [goToStep]);

  const handleModeChange = useCallback(
    (nextMode: ViewMode) => {
      setMode(nextMode);
      if (nextMode === "live") {
        goToStep("live");
        setViewScale("nearEarth");
        setCameraMode("tour");
      } else {
        setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
        dispatchLive({ type: "CLEAR_COMPARE" });
        setViewScale("system");
        setCameraMode("tour");
        if (step === "live") goToStep("briefing");
      }
    },
    [goToStep, step, setViewScale, setCameraMode],
  );

  useEffect(() => {
    const onHash = () => {
      const s = readStepFromHash();
      setStep(s);
      if (s === "live") setMode("live");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // popstate: re-read search (back/forward with shared links)
  useEffect(() => {
    const onPop = () => {
      const p = parseOrbitUrl();
      if (p.mode === "live" || p.mode === "story") setMode(p.mode);
      if (p.date) dispatchLive({ type: "SET_DATE", date: p.date });
      if (p.view) setViewScale(p.view);
      if (p.hazardous != null) dispatchLive({ type: "SET_HAZARDOUS", value: p.hazardous });
      if (p.compare) dispatchLive({ type: "SET_COMPARE", ids: p.compare });
      if (p.neo) pendingNeo.current = p.neo;
      else setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setViewScale]);

  const asteroidOpts = useMemo(
    () => ({
      cache: true as const,
      retry: isDev ? 0 : 3,
      enabled: showAsteroids,
      params: {
        start_date: approachDate,
        page,
        mock: isDev ? "true" : "false",
        limit: 25,
        ...(showHazardous ? { hazardous: "true" as const } : {}),
      },
    }),
    [approachDate, page, isDev, showHazardous, showAsteroids],
  );

  const planetOpts = useMemo(
    () => ({
      cache: true as const,
      retry: isDev ? 0 : 3,
      params: { page: 1, limit: 8 },
    }),
    [isDev],
  );

  const {
    data: asteroidsData,
    loading: astLoad,
    error: astErr,
  } = useApiData<Asteroid>("/asteroids", asteroidOpts);

  const {
    data: planetsData,
    loading: plLoad,
    error: plErr,
  } = useApiData<Planet>("/planets", planetOpts);

  useEffect(() => {
    if (!asteroidsData?.pagination) return;
    const serverPage = asteroidsData.pagination.currentPage;
    dispatchLive({ type: "SET_PAGE", page: serverPage });
  }, [asteroidsData]);

  const filteredAsteroids = useMemo(() => {
    let list = asteroidsData?.data ?? [];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((neo) => (neo.name || "").toLowerCase().includes(q));
    }
    if (maxMissLd != null) {
      list = list.filter(
        (neo) =>
          neo.approach?.missLd != null && neo.approach.missLd <= maxMissLd
      );
    }
    if (minDiameterM != null) {
      const minKm = minDiameterM / 1000;
      list = list.filter((neo) => {
        const d = neo.diameterKmMax ?? neo.diameterKmMin ?? neo.size;
        return d != null && d >= minKm;
      });
    }
    return sortAsteroidsByMiss(list);
  }, [asteroidsData, searchTerm, maxMissLd, minDiameterM]);

  // Resolve deep-link neo + compare when catalog arrives
  useEffect(() => {
    const list = asteroidsData?.data ?? [];
    if (list.length === 0) return;

    if (pendingNeo.current) {
      const found = findAsteroidByRef(list, pendingNeo.current);
      if (found) {
        setSelectedItem(found);
        setCameraMode("focus");
      }
      pendingNeo.current = null;
    }

    if (pendingCompare.current.length > 0) {
      const resolved = pendingCompare.current
        .map((id) => findAsteroidByRef(list, id)?.id)
        .filter((id): id is string => Boolean(id))
        .slice(0, 2);
      if (resolved.length) dispatchLive({ type: "SET_COMPARE", ids: resolved });
      pendingCompare.current = [];
    }
  }, [asteroidsData, setCameraMode]);

  const closest = useMemo(
    () => closestAsteroid(filteredAsteroids),
    [filteredAsteroids],
  );

  const closestSummary = useMemo(() => {
    if (!closest) return null;
    const miss = closest.approach
      ? formatMiss(closest.approach.missLd, closest.approach.missKm, {
          compact: true,
        })
      : "—";
    return `${closest.name} @ ${miss}`;
  }, [closest]);

  const selectedAsteroid = useMemo(
    () =>
      selectedItem && isAsteroid(selectedItem) ? selectedItem : null,
    [selectedItem],
  );

  const {
    sbdb,
    loading: sbdbLoading,
    error: sbdbError,
  } = useSbdbOrbit(selectedAsteroid);

  const issEnabled = showIss && mode === "live";
  const { iss } = useIssPosition(issEnabled);
  const {
    list: sentryList,
    loading: sentryLoading,
    error: sentryError,
  } = useSentryWatchlist(showSentry && mode === "live", 12);

  const {
    detail: sentryDetail,
    loading: sentryDetailLoading,
    error: sentryDetailError,
  } = useSentryDetail(sentryBriefDes, sentryBriefSummary);

  const { solar } = useDonkiSolar(true);

  const rulerApproachMiss = useMemo(() => {
    if (!rulerA || !rulerB) return null;
    const ids = [rulerA, rulerB];
    const neoEnd = ids.find(
      (p) => p.kind === "body" && p.id !== "planet:Earth"
    );
    const earthEnd = ids.find(
      (p) =>
        (p.kind === "body" && p.id === "planet:Earth") ||
        p.name === "Earth"
    );
    if (!neoEnd || !earthEnd || neoEnd.kind !== "body") return null;
    const pool = [
      ...(asteroidsData?.data ?? []),
      ...(sentrySceneBody ? [sentrySceneBody] : []),
    ];
    const neo = pool.find((a) => a.id === neoEnd.id);
    if (!neo?.approach) return null;
    return formatMiss(neo.approach.missLd, neo.approach.missKm);
  }, [rulerA, rulerB, asteroidsData, sentrySceneBody]);

  const rulerLabel = useMemo(() => {
    if (!rulerEnabled || rulerSceneDist == null) return null;
    return formatRulerDistance(rulerSceneDist).label;
  }, [rulerEnabled, rulerSceneDist]);

  const displaySelected = useMemo((): CelestialItem | null => {
    if (!selectedItem) return null;
    if (!isAsteroid(selectedItem)) return selectedItem;
    // Prefer synthetic Sentry body if selected
    if (
      sentrySceneBody &&
      selectedItem.id === sentrySceneBody.id
    ) {
      return sentrySceneBody;
    }
    if (!sbdb?.found) return selectedItem;
    return mergeAsteroidWithSbdb(selectedItem, sbdb);
  }, [selectedItem, sbdb, sentrySceneBody]);

  const sceneItems = useMemo((): CelestialItem[] => {
    const planets = showPlanets ? planetsData?.data ?? [] : [];
    let neos = showAsteroids ? [...filteredAsteroids] : [];
    if (
      displaySelected &&
      isAsteroid(displaySelected) &&
      displaySelected.orbitSource === "sbdb"
    ) {
      neos = neos.map((n) =>
        n.id === displaySelected.id ? displaySelected : n,
      );
    }
    // Inject Sentry-only body (not on NeoWs page) into the scene
    if (
      sentrySceneBody &&
      !neos.some((n) => n.id === sentrySceneBody.id)
    ) {
      neos = [...neos, sentrySceneBody];
    }
    return [...neos, ...planets];
  }, [
    filteredAsteroids,
    planetsData,
    showPlanets,
    showAsteroids,
    displaySelected,
    sentrySceneBody,
  ]);

  /** P4 compare orbit polylines for the scene */
  const compareOrbits = useMemo((): CompareOrbitSpec[] => {
    if (compareIds.length === 0) return [];
    const pool = asteroidsData?.data ?? [];
    const colors = [COMPARE_COLORS.a, COMPARE_COLORS.b] as const;
    const out: CompareOrbitSpec[] = [];
    for (let i = 0; i < compareIds.length; i++) {
      const id = compareIds[i];
      let a = pool.find((x) => x.id === id);
      if (
        displaySelected &&
        isAsteroid(displaySelected) &&
        displaySelected.id === id
      ) {
        a = displaySelected;
      }
      if (!a) continue;
      out.push({
        id: a.id,
        name: a.name,
        hazardous: a.isHazardous,
        color: colors[i] ?? COMPARE_COLORS.a,
        points: toThreePath(
          sampleOrbitPath(a.orbit, q.orbitSegments).map((pt) =>
            scalePosition(pt, trueScale),
          ),
        ),
      });
    }
    return out;
  }, [
    compareIds,
    asteroidsData,
    displaySelected,
    q.orbitSegments,
    trueScale,
  ]);

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
        ? displaySelected.designation ?? displaySelected.id.replace(/^sentry:/, "")
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

  const apiBase = useMemo(() => getApiBaseUrl(), []);

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
    displaySelected,
    compareIds,
    showHazardous,
    sentryBriefDes,
    issFocus,
    showIss,
  ]);

  const loading = plLoad || (showAsteroids && astLoad);
  const error = plErr || (showAsteroids ? astErr : null);
  const totalPages = asteroidsData?.pagination?.totalPages ?? 1;
  const currentPage = asteroidsData?.pagination?.currentPage ?? page;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12] text-white">
      <div className="absolute inset-0 bg-black">
        <Canvas
          camera={{ position: [48, 52, 88], fov: 48, near: 0.1, far: 2500 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor("#010308", 1);
          }}
          className="!absolute inset-0 bg-[#010308]"
        >
          <SceneBackdrop />
          <SimTicker />
          <FrameloopController />
          <Suspense fallback={null}>
            <ThreeDScene
              items={sceneItems}
              onItemClick={handleItemClick}
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
              onMeasureDistance={(d) => dispatchLive({ type: "SET_RULER_DIST", value: d })}
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
      </div>

      <MissionTopBar
        brand={site.brand}
        step={step}
        mode={mode}
        onStepChange={goToStep}
        onModeChange={handleModeChange}
      />

      <MissionDock
        step={step}
        onStepChange={goToStep}
        onEnterLive={enterLive}
      />

      {/*
        Chrome stack:
        - Mobile: Live Neo above dock; viz controls bottom-center
        - Desktop: right rail — Live Neo flexes above VizControls (bottom-right)
      */}
      <div
        className="absolute z-30 pointer-events-none inset-0
          md:inset-auto md:right-4 md:top-16 md:bottom-14 md:w-[min(320px,90vw)]
          md:flex md:flex-col md:gap-2"
      >
        {liveToolsOpen && (
          <div
            className="pointer-events-auto
              absolute left-3 right-3 bottom-[calc(42vh+3.5rem)] h-[min(38vh,calc(100dvh-14rem))]
              md:static md:left-auto md:right-auto md:bottom-auto md:h-auto
              md:flex-1 md:min-h-0"
          >
            <LiveNeoPanel
              embedded
              searchInput={searchTerm}
              onSearchChange={handleSearchChange}
              dateStart={approachDate}
              onSelectDate={handleSelectDate}
              showHazardous={showHazardous}
              onHazardousChange={handleHazardousChange}
              showPlanets={showPlanets}
              onPlanetsChange={(v) => dispatchLive({ type: "SET_SHOW_PLANETS", value: v })}
              selectedItem={displaySelected}
              onClearSelection={handleClearSelection}
              onSelectItem={handleItemClick}
              asteroids={filteredAsteroids}
              catalogAsteroids={asteroidsData?.data ?? []}
              closestSummary={closestSummary}
              page={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              loading={astLoad}
              sbdb={sbdb}
              sbdbLoading={sbdbLoading}
              sbdbError={sbdbError}
              compareIds={compareIds}
              onToggleCompare={handleToggleCompare}
              onClearCompare={handleClearCompare}
              onRemoveCompare={handleRemoveCompare}
              onCopyLink={handleCopyLink}
              copyLinkStatus={copyLinkStatus}
              showIss={showIss}
              onShowIssChange={handleShowIssChange}
              iss={iss}
              issFocus={issFocus}
              onIssFocusChange={handleIssFocusChange}
              showSentry={showSentry}
              onShowSentryChange={handleShowSentryChange}
              sentryList={sentryList}
              sentryLoading={sentryLoading}
              sentryError={sentryError}
              onSentryPickDes={handleSentryPickDes}
              sentryBriefDes={sentryBriefDes}
              sentryBriefSummary={sentryBriefSummary}
              sentryDetail={sentryDetail}
              sentryDetailLoading={sentryDetailLoading}
              sentryDetailError={sentryDetailError}
              onDismissSentryBrief={handleDismissSentryBrief}
              onSentryLookupSbdb={handleSentryLookupSbdb}
              sentrySbdbHint={sbdbHint}
              onExportSummary={handleExportSummary}
              exportStatus={exportStatus}
              maxMissLd={maxMissLd}
              onMaxMissLdChange={(v) => dispatchLive({ type: "SET_MAX_MISS_LD", value: v })}
              minDiameterM={minDiameterM}
              onMinDiameterMChange={(v) => dispatchLive({ type: "SET_MIN_DIAMETER_M", value: v })}
              rulerEnabled={rulerEnabled}
              onRulerEnabledChange={(v) => dispatchLive({ type: "SET_RULER_ENABLED", value: v })}
              rulerA={rulerA}
              rulerB={rulerB}
              rulerSceneDist={rulerSceneDist}
              rulerApproachMiss={rulerApproachMiss}
              onRulerClear={() => {
                dispatchLive({ type: "SET_RULER_A", value: null });
                dispatchLive({ type: "SET_RULER_B", value: null });
                dispatchLive({ type: "SET_RULER_DIST", value: null });
              }}
              onRulerVsEarth={handleRulerVsEarth}
              onRulerVsSun={handleRulerVsSun}
              onGuidedTour={handleGuidedTour}
            />
          </div>
        )}
        <div
          className={`pointer-events-auto
            absolute bottom-12 left-1/2 -translate-x-1/2 max-w-[min(92vw,300px)]
            md:static md:translate-x-0 md:left-auto md:bottom-auto md:max-w-none md:shrink-0
            ${liveToolsOpen ? "" : "md:mt-auto md:self-end md:w-[min(300px,90vw)]"}`}
        >
          <VizControls embedded onScreenshot={captureCanvasScreenshot} />
        </div>
      </div>

      <MissionStatusBar
        loading={loading}
        error={error}
        mode={mode}
        selectedItem={displaySelected}
        iss={iss}
        showIss={showIss && mode === "live"}
        issFocus={issFocus}
        solar={solar}
        rulerLabel={rulerLabel}
      />
    </div>
  );
});

export default MissionControl;
