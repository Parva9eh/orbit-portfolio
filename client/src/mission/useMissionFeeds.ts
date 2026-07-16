import { useEffect, useMemo } from "react";
import type { Asteroid, CelestialItem, Planet } from "@shared";
import { isAsteroid } from "@shared";
import { useApiData } from "../hooks/useApiData";
import { useSbdbOrbit } from "../hooks/useSbdbOrbit";
import { useIssPosition } from "../hooks/useIssPosition";
import { useSentryWatchlist } from "../hooks/useSentryWatchlist";
import { useDonkiSolar } from "../hooks/useDonkiSolar";
import { closestAsteroid } from "../lib/neoSort";
import { useSimActions } from "../sim/useSim";
import { findAsteroidByRef } from "./findAsteroid";
import {
  closestSummaryLine,
  filterAsteroids,
} from "./liveDerived";
import type { LiveMissionState } from "./liveMissionState";
import type { MissionSession } from "./useMissionSession";

type FeedsArgs = {
  live: LiveMissionState;
  mode: MissionSession["mode"];
  showAsteroids: boolean;
  selectedItem: CelestialItem | null;
  setSelectedItem: MissionSession["setSelectedItem"];
  dispatchLive: MissionSession["dispatchLive"];
  pendingNeo: MissionSession["pendingNeo"];
  pendingCompare: MissionSession["pendingCompare"];
};

/**
 * Catalog + live upstream feeds (NeoWs, planets, SBDB, ISS, Sentry list, DONKI).
 * Sentry *detail* stays with handlers (depends on brief summary state).
 */
export function useMissionFeeds({
  live,
  mode,
  showAsteroids,
  selectedItem,
  setSelectedItem,
  dispatchLive,
  pendingNeo,
  pendingCompare,
}: FeedsArgs) {
  const { setCameraMode } = useSimActions();
  const isDev = import.meta.env.MODE === "development";
  const {
    approachDate,
    page,
    searchTerm,
    showHazardous,
    showIss,
    showSentry,
    maxMissLd,
    minDiameterM,
  } = live;

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
    [approachDate, page, isDev, showHazardous, showAsteroids]
  );

  const planetOpts = useMemo(
    () => ({
      cache: true as const,
      retry: isDev ? 0 : 3,
      params: { page: 1, limit: 8 },
    }),
    [isDev]
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
    dispatchLive({
      type: "SET_PAGE",
      page: asteroidsData.pagination.currentPage,
    });
  }, [asteroidsData, dispatchLive]);

  const filteredAsteroids = useMemo(
    () =>
      filterAsteroids(
        asteroidsData?.data,
        searchTerm,
        maxMissLd,
        minDiameterM
      ),
    [asteroidsData, searchTerm, maxMissLd, minDiameterM]
  );

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
  }, [asteroidsData, setCameraMode, setSelectedItem, dispatchLive, pendingNeo, pendingCompare]);

  const closest = useMemo(
    () => closestAsteroid(filteredAsteroids),
    [filteredAsteroids]
  );
  const closestSummary = useMemo(
    () => closestSummaryLine(closest),
    [closest]
  );

  const selectedAsteroid = useMemo(
    () => (selectedItem && isAsteroid(selectedItem) ? selectedItem : null),
    [selectedItem]
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

  const { solar } = useDonkiSolar(true);

  const loading = plLoad || (showAsteroids && astLoad);
  const error = plErr || (showAsteroids ? astErr : null);
  const totalPages = asteroidsData?.pagination?.totalPages ?? 1;
  const currentPage = asteroidsData?.pagination?.currentPage ?? page;

  return {
    asteroidsData,
    planetsData,
    filteredAsteroids,
    closest,
    closestSummary,
    selectedAsteroid,
    sbdb,
    sbdbLoading,
    sbdbError,
    iss,
    sentryList,
    sentryLoading,
    sentryError,
    solar,
    loading,
    error,
    totalPages,
    currentPage,
    astLoad,
  };
}

export type MissionFeeds = ReturnType<typeof useMissionFeeds>;
