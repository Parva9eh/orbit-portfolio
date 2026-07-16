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
  SbdbOrbitResult,
  SentryWatchItem,
  SentryWatchlist,
} from "@shared";
import { designationForSbdb, isAsteroid } from "@shared";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  asteroidFromSentrySbdb,
  isSentrySceneId,
  sentrySceneId,
} from "../lib/sentryBody";
import { useSentryDetail } from "../hooks/useSentryDetail";
import type { LiveMissionAction, LiveMissionState } from "./liveMissionState";
import { findAsteroidByRef } from "./findAsteroid";
import type { ViewScale } from "../sim/useSim";
import type { PaginatedResponse } from "@shared";
import type { ViewMode } from "../components/mission/MissionTopBar";

export type SentryLiveArgs = {
  live: LiveMissionState;
  dispatchLive: Dispatch<LiveMissionAction>;
  mode: ViewMode;
  setCameraMode: (mode: "free" | "tour" | "focus") => void;
  setViewScale: (v: ViewScale) => void;
  setSelectedItem: Dispatch<SetStateAction<CelestialItem | null>>;
  asteroidsData: PaginatedResponse<Asteroid> | null | undefined;
  sentryList: SentryWatchlist | null | undefined;
  pendingSentry: MutableRefObject<string | null>;
};

/**
 * Sentry briefing + synthetic SBDB scene body + detail fetch.
 */
export function useSentryLive({
  live,
  dispatchLive,
  mode,
  setCameraMode,
  setViewScale,
  setSelectedItem,
  asteroidsData,
  sentryList,
  pendingSentry,
}: SentryLiveArgs) {
  const { sentryBriefDes } = live;

  const [sentryBriefSummary, setSentryBriefSummary] =
    useState<SentryWatchItem | null>(null);
  const [sbdbHint, setSbdbHint] = useState<string | null>(null);
  const [sentrySceneBody, setSentrySceneBody] = useState<Asteroid | null>(null);

  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const {
    detail: sentryDetail,
    loading: sentryDetailLoading,
    error: sentryDetailError,
  } = useSentryDetail(sentryBriefDes, sentryBriefSummary);

  const clearSentryInject = useCallback(() => {
    dispatchLive({ type: "SET_SENTRY_BRIEF", des: null });
    setSentryBriefSummary(null);
    setSbdbHint(null);
    setSentrySceneBody(null);
  }, [dispatchLive]);

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
        setViewScale("system");
        setSbdbHint(
          `Drawn in scene · SBDB a=${data.aAu?.toFixed(3)} au · e=${data.e?.toFixed(3)} · System view recommended`
        );
        return body;
      } catch {
        setSbdbHint("SBDB lookup failed — try again later.");
        return null;
      }
    },
    [apiBase, setCameraMode, setViewScale, setSelectedItem, dispatchLive]
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
        clearSentryInject();
        setSelectedItem(found);
        setCameraMode("focus");
        dispatchLive({ type: "SET_ISS_FOCUS", value: false });
        return;
      }
      const summary =
        sentryList?.items.find(
          (it) =>
            it.des.toLowerCase() === des.toLowerCase() ||
            it.fullname.toLowerCase().includes(des.toLowerCase())
        ) ?? null;
      setSentryBriefSummary(summary);
      dispatchLive({ type: "SET_SENTRY_BRIEF", des });
      setSbdbHint(null);
      void promoteSentryToScene(des, summary);
    },
    [
      asteroidsData,
      sentryList,
      sentrySceneBody,
      setCameraMode,
      promoteSentryToScene,
      clearSentryInject,
      setSelectedItem,
      dispatchLive,
    ]
  );

  // Deep-link ?sentry=DES — open Sentry + promote once
  useEffect(() => {
    if (!pendingSentry.current || mode !== "live") return;
    const des = pendingSentry.current;
    pendingSentry.current = null;
    dispatchLive({ type: "SET_SENTRY", show: true });
    handleSentryPickDes(des);
  }, [mode, handleSentryPickDes, pendingSentry, dispatchLive]);

  const resetSentryState = useCallback(() => {
    clearSentryInject();
    setSelectedItem((cur) => {
      if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) return null;
      return cur;
    });
  }, [clearSentryInject, setSelectedItem]);

  const handleDismissSentryBrief = useCallback(() => {
    resetSentryState();
  }, [resetSentryState]);

  const handleSentryLookupSbdb = useCallback(() => {
    if (!sentryBriefDes) return;
    void promoteSentryToScene(sentryBriefDes, sentryBriefSummary);
  }, [sentryBriefDes, sentryBriefSummary, promoteSentryToScene]);

  const handleShowSentryChange = useCallback(
    (v: boolean) => {
      dispatchLive({ type: "SET_SENTRY", show: v });
      if (!v) {
        clearSentryInject();
        setSelectedItem((cur) => {
          if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) return null;
          return cur;
        });
      }
    },
    [dispatchLive, clearSentryInject, setSelectedItem]
  );

  /** Clear inject when selecting a normal catalog body. */
  const clearSentryOnCatalogSelect = useCallback(
    (item: CelestialItem) => {
      if (isAsteroid(item) && !isSentrySceneId(item.id)) {
        clearSentryInject();
      }
    },
    [clearSentryInject]
  );

  /** Full Sentry reset (ISS focus entry, etc.). */
  const wipeSentryForIssFocus = useCallback(() => {
    clearSentryInject();
  }, [clearSentryInject]);

  const handleClearSelection = useCallback(() => {
    setSelectedItem((cur) => {
      if (cur && isAsteroid(cur) && isSentrySceneId(cur.id)) {
        clearSentryInject();
        return null;
      }
      return null;
    });
  }, [setSelectedItem, clearSentryInject]);

  return {
    sentryBriefSummary,
    sbdbHint,
    sentrySceneBody,
    sentryDetail: sentryDetail ?? null,
    sentryDetailLoading,
    sentryDetailError: sentryDetailError ?? null,
    handleSentryPickDes,
    handleDismissSentryBrief,
    handleClearSelection,
    handleSentryLookupSbdb,
    handleShowSentryChange,
    clearSentryOnCatalogSelect,
    wipeSentryForIssFocus,
  };
}

export type SentryLive = ReturnType<typeof useSentryLive>;
