import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import type { CelestialItem } from "@shared";
import { isAsteroid } from "@shared";
import { site, MISSION_STEPS, type MissionStepId } from "../content/site";
import type { ViewMode } from "../components/mission/MissionTopBar";
import { useSimActions } from "../sim/useSim";
import { parseOrbitUrl } from "../lib/urlState";
import {
  initialLiveMissionState,
  liveMissionReducer,
  type LiveMissionAction,
  type LiveMissionState,
} from "./liveMissionState";

const STEP_IDS = MISSION_STEPS.map((s) => s.id);

/** Phones: Near-Earth. Tablets + desktop: System (unless URL overrides). */
function defaultLiveView(): "system" | "nearEarth" {
  if (typeof window === "undefined") return "system";
  return window.matchMedia("(max-width: 767px)").matches
    ? "nearEarth"
    : "system";
}

export function readStepFromHash(): MissionStepId {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return "live";
  return STEP_IDS.includes(hash as MissionStepId)
    ? (hash as MissionStepId)
    : "live";
}

/**
 * Navigation + live reducer + selection + deep-link pending refs.
 * Default entry: Live (03) so recruiters see the orbit first.
 */
export function useMissionSession() {
  const { setCameraMode, setViewScale } = useSimActions();
  const initialUrl = useMemo(() => parseOrbitUrl(), []);

  const [step, setStep] = useState<MissionStepId>(() => {
    if (initialUrl.mode === "live") return "live";
    if (initialUrl.mode === "story") {
      const fromHash = readStepFromHash();
      return fromHash === "live" ? "briefing" : fromHash;
    }
    return readStepFromHash();
  });
  const [mode, setMode] = useState<ViewMode>(() => {
    if (initialUrl.mode === "live" || initialUrl.mode === "story") {
      return initialUrl.mode;
    }
    // Empty hash / Live step → Live NEO; other story steps stay Story until Enter live
    return readStepFromHash() === "live" ? "live" : "story";
  });
  const [selectedItem, setSelectedItem] = useState<CelestialItem | null>(null);
  const [live, dispatchLive] = useReducer(
    liveMissionReducer,
    initialUrl,
    initialLiveMissionState
  );

  const pendingNeo = useRef<string | null>(initialUrl.neo ?? null);
  const pendingCompare = useRef<string[]>(initialUrl.compare ?? []);
  const pendingSentry = useRef<string | null>(initialUrl.sentry ?? null);
  const urlBootDone = useRef(false);

  const liveToolsOpen = mode === "live";
  const showAsteroids = mode === "live";

  useEffect(() => {
    if (urlBootDone.current) return;
    urlBootDone.current = true;
    // Canonical empty URL → #live so share links match default entry
    if (!window.location.hash) {
      const url = new URL(window.location.href);
      url.hash = "live";
      window.history.replaceState({}, "", url);
    }
    const bootLive =
      initialUrl.mode === "live" ||
      (initialUrl.mode !== "story" && readStepFromHash() === "live");
    if (bootLive) {
      setMode("live");
      setStep("live");
      // Free cam by default — Tour is opt-in
      // View: System on tablet/desktop; Near-Earth on phones (URL can override)
      setViewScale(initialUrl.view ?? defaultLiveView());
      setCameraMode("free");
      if (initialUrl.issFocus) {
        dispatchLive({ type: "SET_ISS", show: true, focus: true });
        setViewScale("nearEarth");
      }
      if (initialUrl.sentry) {
        dispatchLive({
          type: "SET_SENTRY",
          show: true,
          briefDes: initialUrl.sentry,
        });
      }
    } else if (initialUrl.view) {
      setViewScale(initialUrl.view);
    }
  }, [initialUrl, setViewScale, setCameraMode]);

  const goToStep = useCallback((next: MissionStepId) => {
    if (!STEP_IDS.includes(next)) return;
    setStep(next);
    if (next === "live") {
      setMode("live");
    } else {
      // 01 / 02 / 04: content-first story sections
      setMode("story");
    }
    const url = new URL(window.location.href);
    url.hash = next;
    window.history.replaceState({}, "", url);
  }, []);

  const enterLive = useCallback(() => {
    setMode("live");
    goToStep("live");
    setViewScale(defaultLiveView());
    setCameraMode("free");
  }, [goToStep, setViewScale, setCameraMode]);

  /** Enable Live tools without leaving the current story step (mobile NEO tools chip). */
  const ensureLiveMode = useCallback(() => {
    setMode("live");
    setViewScale(defaultLiveView());
    setCameraMode("free");
  }, [setViewScale, setCameraMode]);

  const handleModeChange = useCallback(
    (nextMode: ViewMode) => {
      setMode(nextMode);
      if (nextMode === "live") {
        goToStep("live");
        setViewScale(defaultLiveView());
        setCameraMode("free");
      } else {
        setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
        dispatchLive({ type: "CLEAR_COMPARE" });
        setViewScale("system");
        setCameraMode("free");
        if (step === "live") goToStep("briefing");
      }
    },
    [goToStep, step, setViewScale, setCameraMode]
  );

  useEffect(() => {
    const onHash = () => {
      const s = readStepFromHash();
      setStep(s);
      if (s === "live") setMode("live");
      else setMode("story");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const p = parseOrbitUrl();
      if (p.mode === "live" || p.mode === "story") setMode(p.mode);
      if (p.date) dispatchLive({ type: "SET_DATE", date: p.date });
      if (p.view) setViewScale(p.view);
      if (p.hazardous != null)
        dispatchLive({ type: "SET_HAZARDOUS", value: p.hazardous });
      if (p.compare) dispatchLive({ type: "SET_COMPARE", ids: p.compare });
      if (p.neo) pendingNeo.current = p.neo;
      else setSelectedItem((cur) => (cur && isAsteroid(cur) ? null : cur));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setViewScale]);

  return {
    siteBrand: site.brand,
    step,
    mode,
    setMode,
    selectedItem,
    setSelectedItem,
    live,
    dispatchLive: dispatchLive as Dispatch<LiveMissionAction>,
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
  };
}

export type MissionSession = ReturnType<typeof useMissionSession>;
export type { LiveMissionState };
