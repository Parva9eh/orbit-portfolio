import { useState } from "react";

function MockupUI() {
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);

  // Mock asteroid data
  const mockAsteroids = [
    {
      name: "2023 AB",
      position: { x: 10, y: 5, z: -3 },
      size: 0.5,
      isHazardous: true,
    },
    {
      name: "2023 XY",
      position: { x: -5, y: 2, z: 8 },
      size: 0.3,
      isHazardous: false,
    },
    {
      name: "2023 PQ",
      position: { x: 15, y: -7, z: 0 },
      size: 0.7,
      isHazardous: false,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col md:flex-row">
      {/* Mock Canvas */}
      <div className="w-full md:w-3/4 h-[60vh] md:h-screen relative bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-400 rounded-full mx-auto mb-4 shadow-lg shadow-yellow-500/50" />{" "}
          {/* Sun */}
          <div className="flex justify-around">
            <div className="w-4 h-4 bg-red-500 rounded-full" />{" "}
            {/* Hazardous Asteroid */}
            <div className="w-4 h-4 bg-gray-500 rounded-full" />{" "}
            {/* Non-Hazardous Asteroid */}
          </div>
          <p className="mt-4 text-gray-400">
            Mock 3D Scene (Stars, Sun, Asteroids)
          </p>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-1/4 h-[40vh] md:h-screen bg-gray-800 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Astro Explorer</h2>

        {/* Filter Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Filter Asteroids</h3>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col">
              Start Date:
              <input
                type="date"
                defaultValue="2025-08-01"
                className="mt-1 p-2 bg-gray-700 rounded text-white"
                aria-label="Select start date for asteroid data"
                disabled
              />
            </label>
            <label className="flex flex-col">
              End Date:
              <input
                type="date"
                defaultValue="2025-08-31"
                className="mt-1 p-2 bg-gray-700 rounded text-white"
                aria-label="Select end date for asteroid data"
                disabled
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 text-blue-500"
                aria-label="Toggle hazardous asteroids only"
                disabled
              />
              Show Hazardous Only
            </label>
          </div>
        </div>

        {/* Asteroid Details */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Asteroid Details</h3>
          {selectedAsteroid ? (
            <div className="bg-gray-700 p-4 rounded-lg shadow-lg animate-fade-in">
              <h4 className="text-xl font-bold">{selectedAsteroid.name}</h4>
              <p>Hazardous: {selectedAsteroid.isHazardous ? "Yes" : "No"}</p>
              <p>Size: {(selectedAsteroid.size * 1000).toFixed(2)} meters</p>
              <p>
                Position: X: {selectedAsteroid.position.x.toFixed(2)}, Y:{" "}
                {selectedAsteroid.position.y.toFixed(2)}, Z:{" "}
                {selectedAsteroid.position.z.toFixed(2)}
              </p>
              <button
                onClick={() => setSelectedAsteroid(null)}
                className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Clear selected asteroid"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <p className="text-gray-400">Click an asteroid to see details.</p>
          )}
          <ul className="mt-4 space-y-2">
            {mockAsteroids.map((neo, i) => (
              <li
                key={i}
                className="p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                onClick={() => setSelectedAsteroid(neo)}
                role="button"
                tabIndex={0}
                aria-label={`Select asteroid ${neo.name}`}
                onKeyDown={(e) => e.key === "Enter" && setSelectedAsteroid(neo)}
              >
                {neo.name}{" "}
                {neo.isHazardous && <span className="text-red-500">⚠</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MockupUI;
