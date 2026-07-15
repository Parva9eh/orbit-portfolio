import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import axios from "axios";
import {
  asAsteroid,
  auToSceneRadius,
  hashString,
  makeCloseApproach,
  positionOnOrbit,
  type Asteroid,
  type OrbitElements,
  type PaginatedResponse,
  type Vec3,
} from "../../../shared/index.ts";
import {
  cache,
  FULL_TTL_SEC,
  NASA_TIMEOUT_MS,
  inflightCatalog,
} from "./cache.ts";

const DEG = Math.PI / 180;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, "../routes/data/astro-data.json");

type LegacyAsteroid = {
  name: string;
  position: Vec3;
  size: number;
  isHazardous?: boolean;
  id?: string;
};

type NasaNeo = {
  id?: string;
  neo_reference_id?: string;
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter?: {
    kilometers?: {
      estimated_diameter_min?: number;
      estimated_diameter_max?: number;
    };
  };
  close_approach_data?: Array<{
    close_approach_date?: string;
    close_approach_date_full?: string;
    epoch_date_close_approach?: number;
    miss_distance?: { kilometers?: string; astronomical?: string; lunar?: string };
    relative_velocity?: {
      kilometers_per_second?: string;
      kilometers_per_hour?: string;
    };
    orbiting_body?: string;
  }>;
};

export function orbitFromScatteredPosition(
  _position: Vec3,
  name: string
): OrbitElements {
  // Mock NEOs also live near 1 AU (same policy as live NASA feed)
  const earthA = auToSceneRadius(1.0);
  const h = hashString(name);
  const missOffset = 0.5 + (h % 40) / 12;
  const outward = (h & 1) === 0 ? 1 : -1;
  return {
    semiMajorAxis: earthA + outward * missOffset,
    eccentricity: (h % 10) / 100,
    inclination: (((h >> 5) % 20) - 8) * DEG,
    phase: 3.490658503988659 + (((h % 1800) / 1800) * 1.2 - 0.6),
    periodYears: 0.8 + (h % 50) / 100,
  };
}

export let mockAsteroidsMem: Asteroid[] | null = null;
let mockAsteroidsLoading: Promise<Asteroid[]> | null = null;

export function fallbackMockAsteroids(): Asteroid[] {
  return [
    asAsteroid({
      name: "(2025 OA3)",
      position: { x: 22, y: 4, z: 18 },
      size: 0.12,
      isHazardous: false,
      orbit: {
        semiMajorAxis: 28,
        eccentricity: 0.08,
        inclination: 0.12,
        phase: 0.8,
        periodYears: 2.1,
      },
      diameterKmMin: 0.08,
      diameterKmMax: 0.18,
      orbitSource: "mock",
      designation: "2025 OA3",
      approach: makeCloseApproach({
        dateIso: new Date().toISOString().slice(0, 10),
        missKm: 1_200_000,
        relativeVelocityKmS: 12.4,
      }),
    }),
    asAsteroid({
      name: "(2025 OX9)",
      position: { x: -30, y: -6, z: 25 },
      size: 0.2,
      isHazardous: true,
      orbit: {
        semiMajorAxis: 40,
        eccentricity: 0.15,
        inclination: 0.2,
        phase: 2.4,
        periodYears: 3.5,
      },
      diameterKmMin: 0.15,
      diameterKmMax: 0.35,
      orbitSource: "mock",
      designation: "2025 OX9",
      approach: makeCloseApproach({
        dateIso: new Date().toISOString().slice(0, 10),
        missKm: 420_000,
        relativeVelocityKmS: 18.1,
      }),
    }),
  ];
}

export async function loadMockAsteroids(): Promise<Asteroid[]> {
  if (mockAsteroidsMem) return mockAsteroidsMem;
  if (mockAsteroidsLoading) return mockAsteroidsLoading;

  mockAsteroidsLoading = (async () => {
    try {
      const data = await readFile(jsonPath, "utf8");
      const parsed = JSON.parse(data) as LegacyAsteroid[];
      mockAsteroidsMem = parsed.map((row) => {
        const orbit = orbitFromScatteredPosition(row.position, row.name);
        const position = positionOnOrbit(orbit, 0);
        const h = hashString(row.name);
        const missKm = 200_000 + (h % 80) * 50_000;
        const sizeKm = Math.max(row.size, 0.02);
        return asAsteroid({
          name: row.name,
          id: row.id,
          isHazardous: row.isHazardous,
          position,
          orbit,
          size: sizeKm,
          spinRate: 0.7 + (h % 20) / 20,
          diameterKmMin: sizeKm * 0.7,
          diameterKmMax: sizeKm,
          orbitSource: "mock",
          designation: row.name.replace(/[()]/g, "").trim(),
          approach: makeCloseApproach({
            dateIso: new Date().toISOString().slice(0, 10),
            missKm,
            relativeVelocityKmS: 8 + (h % 20) * 0.6,
          }),
        });
      });
      return mockAsteroidsMem;
    } catch (err) {
      console.error("Error reading mock data file:", err);
      mockAsteroidsMem = fallbackMockAsteroids();
      return mockAsteroidsMem;
    } finally {
      mockAsteroidsLoading = null;
    }
  })();

  return mockAsteroidsLoading;
}

export function processNeoData(neos: NasaNeo[][]): Asteroid[] {
  const earthA = auToSceneRadius(1.0); // ~14 scene units
  return neos.flat().map((neo) => {
    const cad = neo.close_approach_data?.[0];
    const km = Number(cad?.miss_distance?.kilometers ?? 1e6);
    const au = Number(cad?.miss_distance?.astronomical ?? Number.NaN);
    const lunar = Number(cad?.miss_distance?.lunar ?? Number.NaN);
    const vRel = Number(cad?.relative_velocity?.kilometers_per_second ?? 0);
    const dateFull = cad?.close_approach_date_full ?? cad?.close_approach_date ?? "";
    const epochMs =
      typeof cad?.epoch_date_close_approach === "number"
        ? cad.epoch_date_close_approach
        : null;

    const diamMin = neo.estimated_diameter?.kilometers?.estimated_diameter_min;
    const diamMax =
      neo.estimated_diameter?.kilometers?.estimated_diameter_max ?? 0.05;

    const h = hashString(neo.name + (neo.id ?? ""));
    // Log miss distance → small offset from Earth's orbit (0.4 … 4.5 units)
    const missOffset = Math.min(4.5, Math.max(0.4, Math.log10(km + 10) * 0.55));
    const outward = (h & 1) === 0 ? 1 : -1;
    const semiMajorAxis = earthA + outward * missOffset;
    // Phase near Earth but spread so they don't stack on one point
    const phase =
      3.490658503988659 + // Earth seed phase (matches PLANET_SEEDS Earth)
      (((h % 2000) / 2000) * 1.4 - 0.7);
    const inclination = (((h >> 8) % 24) - 8) * DEG; // ~-8°..+16°
    const eccentricity = 0.02 + ((h >> 16) % 15) / 100; // 0.02–0.17
    const orbit: OrbitElements = {
      semiMajorAxis: Math.max(8, semiMajorAxis),
      eccentricity,
      inclination,
      phase,
      // Near-Earth periods ~0.7–1.4 years (not outer-system)
      periodYears: 0.75 + ((h >> 4) % 60) / 100,
    };
    const position = positionOnOrbit(orbit, 0);

    const approach = makeCloseApproach({
      dateIso: dateFull,
      epochMs,
      missKm: Number.isFinite(km) ? km : 1e6,
      missAu: Number.isFinite(au) ? au : undefined,
      relativeVelocityKmS: Number.isFinite(vRel) ? vRel : 0,
      orbitingBody: cad?.orbiting_body ?? "Earth",
    });
    // Prefer NeoWs lunar distance when present (more authoritative)
    if (Number.isFinite(lunar) && lunar > 0) {
      approach.missLd = lunar;
    }

    const designation = neo.name.replace(/[()]/g, "").trim();

    return asAsteroid({
      id: neo.neo_reference_id ?? neo.id ?? `asteroid:${neo.name}`,
      name: neo.name,
      position,
      size: diamMax || 0.05,
      isHazardous: neo.is_potentially_hazardous_asteroid,
      orbit,
      spinRate: 0.5 + ((h >> 4) % 25) / 20,
      diameterKmMin: diamMin,
      diameterKmMax: diamMax,
      approach,
      orbitSource: "approx",
      designation,
    });
  });
}

export async function getRawAsteroidCatalog(
  startDate: string,
  useMock: boolean
): Promise<Asteroid[]> {
  // v5 = approach + diameter fields for Body Inspector (P1)
  const rawKey = `neo_raw_v5_${startDate}_${useMock ? "m" : "r"}`;
  const hit = cache.get<Asteroid[]>(rawKey);
  if (hit) return hit;

  const pending = inflightCatalog.get(rawKey) as Promise<Asteroid[]> | undefined;
  if (pending) return pending;

  const load = (async (): Promise<Asteroid[]> => {
    try {
      let raw: Asteroid[];
      const apiKey = process.env.NASA_API_KEY;

      if (useMock || !apiKey) {
        if (!useMock && !apiKey) {
          console.warn(
            "NASA_API_KEY missing — serving mock asteroids for",
            startDate
          );
        }
        raw = await loadMockAsteroids();
      } else {
        const resp = await axios.get<{
          near_earth_objects: Record<string, NasaNeo[]>;
        }>(
          `https://api.nasa.gov/neo/rest/v1/feed?start_date=${encodeURIComponent(
            startDate
          )}&api_key=${encodeURIComponent(apiKey)}`,
          { timeout: NASA_TIMEOUT_MS, validateStatus: (s) => s >= 200 && s < 300 }
        );
        raw = processNeoData(Object.values(resp.data.near_earth_objects ?? {}));
      }

      cache.set(rawKey, raw, FULL_TTL_SEC);
      return raw;
    } finally {
      inflightCatalog.delete(rawKey);
    }
  })();

  inflightCatalog.set(rawKey, load);
  return load;
}

export function paginateAsteroids(
  fullData: Asteroid[],
  pageNum: number,
  limitNum: number,
  totalHazardous: number
): PaginatedResponse<Asteroid> {
  const totalItems = fullData.length;
  const totalPages = Math.ceil(totalItems / limitNum) || 0;

  if (totalItems === 0) {
    return {
      data: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        limit: limitNum,
        totalHazardous,
      },
    };
  }

  let currentPage = pageNum;
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * limitNum;
  return {
    data: fullData.slice(start, start + limitNum),
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      limit: limitNum,
      totalHazardous,
    },
  };
}

