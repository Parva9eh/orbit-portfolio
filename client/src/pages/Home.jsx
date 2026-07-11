/*  src/pages/Home.jsx  */
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import ThreeDScene from "../components/ThreeDScene";
import { useApiData } from "../hooks/useApiData";
import { Canvas } from "@react-three/fiber";
import debounce from "lodash/debounce";

const Home = React.memo(() => {
  /* ------------------- STATE ------------------- */
  const [selectedItem, setSelectedItem] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().substring(0, 10),
  });
  const [showHazardous, setShowHazardous] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [showPlanets, setShowPlanets] = useState(false);
  const previousData = useRef(null);

  const isDev = import.meta.env.MODE === "development";

  /* ------------------- API OPTIONS ------------------- */
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
  console.log("planetsData", planetsData);
  /* ------------------- STORE PREVIOUS PAGE ------------------- */
  useEffect(() => {
    if (asteroidsData?.data) previousData.current = asteroidsData;
  }, [asteroidsData]);

  // Sync with server-corrected page
  useEffect(() => {
    const serverPage = asteroidsData?.pagination?.currentPage;
    if (serverPage != null && serverPage !== page) {
      setPage(serverPage);
    }
  }, [asteroidsData?.pagination?.currentPage]);

  // Optional: Keep URL in sync
  useEffect(() => {
    const url = new URL(window.location);
    if (url.searchParams.get("page") !== String(page)) {
      url.searchParams.set("page", String(page));
      window.history.replaceState({}, "", url);
    }
  }, [page]);

  /* ------------------- DEBOUNCED INPUTS ------------------- */
  const debouncedSetSearchTerm = useCallback(
    debounce((value) => {
      setSearchTerm(value);
      setPage(1);
    }, 300),
    []
  );

  const debouncedSetPage = useCallback(
    debounce((newPage) => setPage(newPage), 300),
    []
  );

  /* ------------------- FILTERED ASTEROIDS (current page only) ------------------- */
  const filteredAsteroids = useMemo(() => {
    const currentData = asteroidsData?.data || previousData.current?.data || [];
    if (!Array.isArray(currentData)) return [];

    return currentData.filter(
      (neo) => neo.name.toLowerCase().includes(searchTerm.toLowerCase())
      //(!showHazardous || neo.isHazardous)
    );
  }, [asteroidsData, previousData, searchTerm]);

  /* ------------------- ITEMS FOR 3D SCENE ------------------- */
  const sceneItems = useMemo(() => {
    const asteroids = filteredAsteroids;
    const planets = showPlanets ? planetsData?.data || [] : [];
    return [...asteroids, ...planets];
  }, [filteredAsteroids, planetsData, showPlanets]);

  /* ------------------- HANDLERS ------------------- */
  const handleItemClick = useCallback((item) => {
    requestAnimationFrame(() => setSelectedItem(item));
  }, []);

  const handleDateChange = useCallback((e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }, []);

  const loading = astLoad || plLoad;
  const error = astErr || plErr;

  if (error)
    return (
      <div className="text-center text-red-500 text-xl">
        Error: {error.message}
      </div>
    );
  console.log("Rendering Home.jsx with items:", sceneItems);
  console.log("filteredAsteroids:", filteredAsteroids);
  console.log("asteroidsData:", asteroidsData);

  return (
    <div className="min-h-screen w-full bg-custom-dark text-white flex flex-col md:flex-row">
      {/* ---------- 3-D CANVAS ---------- */}
      <div className="w-full md:w-3/4 h-[60vh] md:h-screen relative bg-black">
        <Canvas
          camera={{ position: [60, 80, 110], fov: 65, near: 0.1, far: 1000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          frameloop="demand"
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <span className="text-white text-xl">Loading...</span>
          </div>
        )}
      </div>

      {/* ---------- CONTROLS ---------- */}
      <div className="w-full md:w-1/4 h-[40vh] md:h-screen bg-custom-gray p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Astro Explorer</h2>

        <div className="mb-6">
          <h3 className="text-lg font-semibold">Filters</h3>

          <input
            type="text"
            placeholder="Search by name..."
            onChange={(e) => debouncedSetSearchTerm(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white mb-2"
          />

          <label className="flex items-center gap-2">
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="p-2 bg-gray-700 rounded text-white"
            />
          </label>

          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={showHazardous}
              onChange={() => setShowHazardous(!showHazardous)}
              className="h-5 w-5 text-custom-blue"
            />
            Show Hazardous Only
          </label>

          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={showPlanets}
              onChange={(e) => setShowPlanets(e.target.checked)}
              className="h-5 w-5 text-custom-blue"
            />
            Show Planets & Orbits
          </label>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Item Details</h3>

          {selectedItem ? (
            <div className="bg-gray-700 p-4 rounded-lg shadow-lg animate-fade-in">
              <h4 className="text-xl font-bold">{selectedItem.name}</h4>
              {selectedItem.isHazardous !== undefined && (
                <p>
                  Hazardous: {selectedItem.isHazardous ? "Yes [Warning]" : "No"}
                </p>
              )}
              <p>Size: {(selectedItem.size * 1000).toFixed(2)} m</p>
              <p>
                Position: X:{selectedItem.position.x.toFixed(2)} Y:
                {selectedItem.position.y.toFixed(2)} Z:
                {selectedItem.position.z.toFixed(2)}
              </p>
              <button
                onClick={() => setSelectedItem(null)}
                className="mt-4 px-4 py-2 bg-custom-blue rounded hover:bg-blue-700"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <p className="text-gray-400">Click an item to see details.</p>
          )}

          {/* LIST OF CURRENT ASTEROIDS (from 3D scene, no planets) */}
          <ul className="mt-4 space-y-2">
            {sceneItems
              .filter((item) => item.isHazardous !== undefined)
              .map((neo, i) => (
                <li
                  key={i}
                  className="p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
                  onClick={() => handleItemClick(neo)}
                >
                  {neo.name}
                  {neo.isHazardous && (
                    <span className="text-red-500">[Warning]</span>
                  )}
                </li>
              ))}
          </ul>

          {/* PAGINATION */}
          {asteroidsData?.pagination &&
            asteroidsData.pagination.totalPages > 1 && (
              <div className="mt-4 text-center">
                <p>
                  Page {page} of {asteroidsData.pagination.totalPages}
                </p>
                <button
                  onClick={() => debouncedSetPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-600 rounded mr-2 hover:bg-gray-500 disabled:bg-gray-400"
                >
                  Previous
                </button>
                <button
                  onClick={() => debouncedSetPage(page + 1)}
                  disabled={page === asteroidsData.pagination.totalPages}
                  className="px-4 py-2 bg-custom-blue rounded hover:bg-blue-700 disabled:bg-blue-400"
                >
                  Next
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
});

export default Home;
