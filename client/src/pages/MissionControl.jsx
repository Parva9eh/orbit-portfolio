import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Canvas } from "@react-three/fiber";
import debounce from "lodash/debounce";
import ThreeDScene from "../components/ThreeDScene";
import { useApiData } from "../hooks/useApiData";
import { site, MISSION_STEPS } from "../content/site";
import MissionTopBar from "../components/mission/MissionTopBar";
import MissionDock from "../components/mission/MissionDock";
import LiveNeoPanel from "../components/mission/LiveNeoPanel";
import MissionStatusBar from "../components/mission/MissionStatusBar";

const STEP_IDS = MISSION_STEPS.map((s) => s.id);

function readStepFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  return STEP_IDS.includes(hash) ? hash : "briefing";
}

const MissionControl = React.memo(function MissionControl() {
  const [step, setStep] = useState(readStepFromHash);
  const [mode, setMode] = useState(() =>
    readStepFromHash() === "live" ? "live" : "story"
  );
  const [selectedItem, setSelectedItem] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().substring(0, 10),
  });
  const [showHazardous, setShowHazardous] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [showPlanets, setShowPlanets] = useState(true);
  const previousData = useRef(null);

  const isDev = import.meta.env.MODE === "development";
  const liveToolsOpen = mode === "live";

  const goToStep = useCallback((next) => {
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
    (nextMode) => {
      setMode(nextMode);
      if (nextMode === "live") goToStep("live");
    },
    [goToStep]
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

  const asteroidOpts = useMemo(
    () => ({
      cache: true,
      retry: isDev ? 0 : 3,
      params: {
        start_date: dateRange.start,
        page,
        mock: isDev,
        limit: 10,
        hazardous: showHazardous,
      },
    }),
    [dateRange.start, page, isDev, showHazardous]
  );

  const planetOpts = useMemo(
    () => ({
      cache: true,
      retry: isDev ? 0 : 3,
      params: { page: 1, limit: 8 },
    }),
    [isDev]
  );

  const {
    data: asteroidsData,
    loading: astLoad,
    error: astErr,
  } = useApiData("/asteroids", asteroidOpts);

  const {
    data: planetsData,
    loading: plLoad,
    error: plErr,
  } = useApiData("/planets", planetOpts);

  useEffect(() => {
    if (asteroidsData?.data) previousData.current = asteroidsData;
  }, [asteroidsData]);

  useEffect(() => {
    const serverPage = asteroidsData?.pagination?.currentPage;
    if (serverPage != null && serverPage !== page) {
      setPage(serverPage);
    }
  }, [asteroidsData?.pagination?.currentPage, page]);

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((value) => {
        setSearchTerm(value);
        setPage(1);
      }, 300),
    []
  );

  useEffect(() => () => debouncedSetSearchTerm.cancel(), [debouncedSetSearchTerm]);

  const filteredAsteroids = useMemo(() => {
    const currentData =
      asteroidsData?.data || previousData.current?.data || [];
    if (!Array.isArray(currentData)) return [];
    const q = searchTerm.toLowerCase();
    return currentData.filter((neo) =>
      (neo.name || "").toLowerCase().includes(q)
    );
  }, [asteroidsData, searchTerm]);

  const sceneItems = useMemo(() => {
    const planets = showPlanets ? planetsData?.data || [] : [];
    return [...filteredAsteroids, ...planets];
  }, [filteredAsteroids, planetsData, showPlanets]);

  const handleItemClick = useCallback(
    (item) => {
      requestAnimationFrame(() => setSelectedItem(item));
      if (mode !== "live") {
        setMode("live");
        goToStep("live");
      }
    },
    [mode, goToStep]
  );

  const handleDateChange = useCallback((e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }, []);

  const loading = astLoad || plLoad;
  const error = astErr || plErr;
  const totalPages = asteroidsData?.pagination?.totalPages || 1;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12] text-white">
      {/* Full-bleed 3D */}
      <div className="absolute inset-0 bg-black">
        <Canvas
          camera={{ position: [60, 80, 110], fov: 65, near: 0.1, far: 1000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          className="!absolute inset-0"
        >
          <ThreeDScene
            items={sceneItems}
            onItemClick={handleItemClick}
            selectedItem={selectedItem}
            showPlanets={showPlanets}
            planetsData={planetsData?.data || []}
          />
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

      {liveToolsOpen && (
        <LiveNeoPanel
          searchInput={searchTerm}
          onSearchChange={debouncedSetSearchTerm}
          dateStart={dateRange.start}
          onDateChange={handleDateChange}
          showHazardous={showHazardous}
          onHazardousChange={setShowHazardous}
          showPlanets={showPlanets}
          onPlanetsChange={setShowPlanets}
          selectedItem={selectedItem}
          onClearSelection={() => setSelectedItem(null)}
          onSelectItem={handleItemClick}
          asteroids={filteredAsteroids}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <MissionStatusBar loading={loading} error={error} mode={mode} />
    </div>
  );
});

export default MissionControl;
