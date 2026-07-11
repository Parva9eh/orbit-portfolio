import { Router, type Request, type Response } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  asAsteroid,
  asPlanet,
  type Asteroid,
  type Planet,
  type PaginatedResponse,
  type Vec3,
} from "../../../shared/index.ts";

const router = Router();
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, "data", "astro-data.json");

type LegacyAsteroid = {
  name: string;
  position: Vec3;
  size: number;
  isHazardous?: boolean;
  id?: string;
};

type NasaNeo = {
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    kilometers: { estimated_diameter_max: number };
  };
  close_approach_data: Array<{
    miss_distance?: { kilometers?: string };
  }>;
};

type PlanetSeed = {
  name: string;
  distance: number;
  size: number;
  period: number;
  color: number;
};

const MOCK_ASTEROIDS: LegacyAsteroid[] = [
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

const MOCK_PLANETS: PlanetSeed[] = [
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

const normalizePosition = (distance: number): Vec3 => ({
  x: distance * 10,
  y: 0,
  z: 0,
});

async function loadMockAsteroids(): Promise<Asteroid[]> {
  try {
    const data = await readFile(jsonPath, "utf8");
    const parsed = JSON.parse(data) as LegacyAsteroid[];
    return parsed.map((row) => asAsteroid(row));
  } catch (err) {
    console.error("Error reading mock data file:", err);
    return MOCK_ASTEROIDS.map((row) => asAsteroid(row));
  }
}

function processNeoData(neos: NasaNeo[][]): Asteroid[] {
  return neos.flat().map((neo) => {
    const km = neo.close_approach_data[0]?.miss_distance?.kilometers;
    const distance = km ? Number(km) / 1e6 : 0;
    return asAsteroid({
      name: neo.name,
      position: normalizePosition(distance),
      size: neo.estimated_diameter.kilometers.estimated_diameter_max,
      isHazardous: neo.is_potentially_hazardous_asteroid,
    });
  });
}

function processPlanetData(planets: PlanetSeed[]): Planet[] {
  return planets.map((p) =>
    asPlanet({
      name: p.name,
      position: normalizePosition(p.distance),
      size: p.size / 10,
      period: p.period,
      color: p.color,
    })
  );
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function queryFlag(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

router.get("/asteroids", async (req: Request, res: Response) => {
  try {
    const start_date = String(req.query.start_date ?? "");
    const mock = req.query.mock;
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parsePositiveInt(req.query.limit, 10);
    const filterHazardous = queryFlag(req.query.hazardous);

    const fullCacheKey = `asteroids_full_${start_date}_${String(mock ?? "real")}_${filterHazardous}`;
    const pageCacheKey = `asteroids_page_${start_date}_${String(mock ?? "real")}_${filterHazardous}_${pageNum}_${limitNum}`;

    const cachedPage = cache.get<PaginatedResponse<Asteroid>>(pageCacheKey);
    if (cachedPage) {
      res.json(cachedPage);
      return;
    }

    let fullData = cache.get<Asteroid[]>(fullCacheKey);

    if (!fullData) {
      let rawData: Asteroid[] = [];
      if (queryFlag(mock)) {
        rawData = await loadMockAsteroids();
      } else {
        const resp = await axios.get<{
          near_earth_objects: Record<string, NasaNeo[]>;
        }>(
          `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start_date}&api_key=${process.env.NASA_API_KEY}`
        );
        rawData = processNeoData(Object.values(resp.data.near_earth_objects));
      }

      fullData = filterHazardous
        ? rawData.filter((a) => a.isHazardous)
        : rawData;
      cache.set(fullCacheKey, fullData, 3600);
    }

    const totalItems = fullData.length;
    const totalPages = Math.ceil(totalItems / limitNum) || 0;

    if (totalItems === 0) {
      res.json({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          limit: limitNum,
        },
      } satisfies PaginatedResponse<Asteroid>);
      return;
    }

    let currentPage = pageNum;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * limitNum;
    const paginated = fullData.slice(start, start + limitNum);

    const responseData: PaginatedResponse<Asteroid> = {
      data: paginated,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        limit: limitNum,
        totalHazardous: filterHazardous ? totalItems : undefined,
      },
    };

    cache.set(pageCacheKey, responseData, 300);
    res.json(responseData);
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { status?: number } };
    console.error("API error:", err.message);
    res
      .status(err.response?.status === 429 ? 429 : 500)
      .json({ error: "API fetch failed" });
  }
});

router.get("/planets", async (req: Request, res: Response) => {
  try {
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parsePositiveInt(req.query.limit, 8);
    const cacheKey = `planets_${pageNum}_${limitNum}`;
    const cached = cache.get<PaginatedResponse<Planet>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const processed = processPlanetData(MOCK_PLANETS);
    const totalItems = processed.length;
    const start = (pageNum - 1) * limitNum;
    if (start >= totalItems) {
      res.status(400).json({ error: "Page out of range" });
      return;
    }

    const paginated = processed.slice(start, start + limitNum);
    const responseData: PaginatedResponse<Planet> = {
      data: paginated,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
        limit: limitNum,
      },
    };
    cache.set(cacheKey, responseData, 300);
    res.json(responseData);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("Planet API error:", err.message);
    res.status(500).json({ error: "Planet fetch failed" });
  }
});

export default router;
