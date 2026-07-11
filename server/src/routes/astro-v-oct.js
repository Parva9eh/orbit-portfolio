const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const router = express.Router();
const fs = require("fs-extra");
const path = require("path");

// Module-level cache – created **once** when the file is loaded
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Construct the absolute path to the JSON file
const jsonPath = path.join(__dirname, "data", "astro-data.json");
const { readFile } = require("fs").promises;

const MOCK_ASTEROIDS = [
  {
    name: "(2025 OA3)",
    position: {
      x: 2.294431091658602,
      y: 12.391782763882041,
      z: 47.68721297270575,
    },
    size: 0.0616651765,
    isHazardous: false,
  },
  {
    name: "(2025 OX9)",
    position: {
      x: 20.41637399066333,
      y: 92.70702046216377,
      z: 76.8210688564157,
    },
    size: 0.062035456,
    isHazardous: false,
  },
];

const mockData = async () => {
  try {
    const data = await readFile(jsonPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading mock data file:", err);
  }
  return MOCK_ASTEROIDS;
};

// Realistic planet data (used only for colour & period)
const MOCK_PLANETS = [
  {
    name: "Mercury",
    distance: 0.39,
    size: 0.383,
    period: 0.24,
    color: 0x8c7853,
  },
  { name: "Venus", distance: 0.72, size: 0.949, period: 0.62, color: 0xffc649 },
  { name: "Earth", distance: 1.0, size: 1.0, period: 1.0, color: 0x6b93d6 },
  { name: "Mars", distance: 1.52, size: 0.532, period: 1.88, color: 0xc1440e },
  {
    name: "Jupiter",
    distance: 5.2,
    size: 11.209,
    period: 11.86,
    color: 0xd8ca9d,
  },
  {
    name: "Saturn",
    distance: 9.58,
    size: 9.449,
    period: 29.46,
    color: 0xfad5a5,
  },
  {
    name: "Uranus",
    distance: 19.22,
    size: 4.007,
    period: 84.01,
    color: 0x4fd0e3,
  },
  {
    name: "Neptune",
    distance: 30.07,
    size: 3.883,
    period: 164.8,
    color: 0x4b70dd,
  },
];

const mockPlanetData = () => MOCK_PLANETS;

const normalizePosition = (distance) => ({
  x: distance * 10, // 1 AU = 10 units
  y: 0,
  z: 0,
});

const processNeoData = (neos) =>
  neos.flat().map((neo) => {
    const distance =
      neo.close_approach_data[0]?.miss_distance?.kilometers / 1e6 || 0;
    return {
      name: neo.name,
      position: normalizePosition(distance),
      size: neo.estimated_diameter.kilometers.estimated_diameter_max,
      isHazardous: neo.is_potentially_hazardous_asteroid,
    };
  });

const processPlanetData = (planets) =>
  planets.map((p) => ({
    name: p.name,
    position: normalizePosition(p.distance),
    size: p.size / 10, // Earth = 1 unit
    period: p.period,
    color: p.color,
  }));

// ---------- /asteroids ----------
router.get("/asteroids", async (req, res) => {
  try {
    const {
      start_date,
      mock,
      page = 1,
      limit = 10,
      hazardous, // ← NEW
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const filterHazardous = hazardous === "true";

    // Cache keys
    const fullCacheKey = `asteroids_full_${start_date}_${mock || "real"}_${filterHazardous}`;
    const pageCacheKey = `asteroids_page_${start_date}_${mock || "real"}_${filterHazardous}_${pageNum}_${limitNum}`;

    // 1. Try page cache
    const cachedPage = cache.get(pageCacheKey);
    if (cachedPage) return res.json(cachedPage);

    // 2. Get full filtered dataset
    let fullData = cache.get(fullCacheKey);

    if (!fullData) {
      // Load raw data
      let rawData = [];
      if (mock === "true" || mock === "1") {
        rawData = await mockData();
      } else {
        const resp = await axios.get(
          `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start_date}&api_key=${process.env.NASA_API_KEY}`
        );
        rawData = processNeoData(Object.values(resp.data.near_earth_objects));
      }

      // APPLY HAZARDOUS FILTER HERE
      fullData = filterHazardous
        ? rawData.filter((a) => a.isHazardous)
        : rawData;

      cache.set(fullCacheKey, fullData, 3600); // 1 hour
    }

    // 3. Paginate with auto-fallback
    const totalItems = fullData.length;
    const totalPages = Math.ceil(totalItems / limitNum);

    if (totalItems === 0) {
      return res.json({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          limit: limitNum,
        },
      });
    }

    let currentPage = pageNum;
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start = (currentPage - 1) * limitNum;
    const paginated = fullData.slice(start, start + limitNum);

    const responseData = {
      data: paginated,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        limit: limitNum,
        totalHazardous: filterHazardous ? totalItems : undefined,
      },
    };

    cache.set(pageCacheKey, responseData, 300); // 5 min
    res.json(responseData);
  } catch (e) {
    console.error("API error:", e.message);
    res
      .status(e.response?.status === 429 ? 429 : 500)
      .json({ error: "API fetch failed" });
  }
});

// ---------- /planets ----------
router.get("/planets", async (req, res) => {
  try {
    const { page = 1, limit = 8 } = req.query;
    const cacheKey = `planets_${page}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const processed = processPlanetData(mockPlanetData());
    const totalItems = processed.length;
    const start = (page - 1) * limit;
    if (start >= totalItems)
      return res.status(400).json({ error: "Page out of range" });

    const paginated = processed.slice(start, start + limit);
    const responseData = {
      data: paginated,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        limit: parseInt(limit),
      },
    };
    cache.set(cacheKey, responseData, 300); // 5 min
    res.json(responseData);
  } catch (e) {
    console.error("Planet API error:", e.message);
    res.status(500).json({ error: "Planet fetch failed" });
  }
});

module.exports = router;
