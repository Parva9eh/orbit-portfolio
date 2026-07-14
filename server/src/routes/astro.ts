import { Router, type Request, type Response } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  asAsteroid,
  asPlanet,
  auToSceneRadius,
  earthRadiiToDisplaySize,
  hashString,
  makeCloseApproach,
  orbitFromSbdbElements,
  positionOnOrbit,
  SENTRY_EDU_NOTE,
  type Asteroid,
  type IssPosition,
  type OrbitElements,
  type PaginatedResponse,
  type Planet,
  type SbdbOrbitResult,
  type SentryDetail,
  type SentryWatchItem,
  type SentryWatchlist,
  type Vec3,
} from "../../../shared/index.ts";

const router = Router();

/** Full NASA / mock catalogs — 1h. Page envelopes are short-lived or sliced on demand. */
const FULL_TTL_SEC = 3600;
const PAGE_TTL_SEC = 300;
const SBDB_TTL_SEC = 86_400; // 24h — orbital elements change rarely
const SENTRY_TTL_SEC = 6 * 3600; // 6h — risk list changes slowly
const ISS_TTL_SEC = 8; // short — live craft
const NASA_TIMEOUT_MS = 12_000;
const SBDB_TIMEOUT_MS = 10_000;
const ISS_TIMEOUT_MS = 6_000;
const SENTRY_TIMEOUT_MS = 18_000;
const MAX_PAGE_LIMIT = 50;

/**
 * useClones: false — we treat entries as immutable (no in-place mutation after set).
 * Avoids expensive deep clones on every get/set for NEO arrays.
 */
const cache = new NodeCache({
  stdTTL: FULL_TTL_SEC,
  checkperiod: 120,
  maxKeys: 500,
  useClones: false,
});

/** Coalesce concurrent cold misses for the same catalog key (prevents NASA stampede). */
const inflightCatalog = new Map<string, Promise<Asteroid[]>>();
const inflightSbdb = new Map<string, Promise<SbdbOrbitResult>>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, "data", "astro-data.json");

const DEG = Math.PI / 180;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Physical + visual seeds for the major planets (approx real values). */
type PlanetSeed = {
  name: string;
  au: number;
  earthRadii: number;
  periodYears: number;
  spinDays: number;
  tiltDeg: number;
  color: number;
  eccentricity: number;
  inclinationDeg: number;
  phaseDeg: number;
  hasRings?: boolean;
};

const PLANET_SEEDS: PlanetSeed[] = [
  {
    name: "Mercury",
    au: 0.387,
    earthRadii: 0.383,
    periodYears: 0.241,
    spinDays: 58.6,
    tiltDeg: 0.03,
    color: 0x8c7853,
    eccentricity: 0.206,
    inclinationDeg: 7.0,
    phaseDeg: 40,
  },
  {
    name: "Venus",
    au: 0.723,
    earthRadii: 0.949,
    periodYears: 0.615,
    spinDays: -243, // retrograde
    tiltDeg: 177.4,
    color: 0xffc649,
    eccentricity: 0.007,
    inclinationDeg: 3.4,
    phaseDeg: 120,
  },
  {
    name: "Earth",
    au: 1.0,
    earthRadii: 1.0,
    periodYears: 1.0,
    spinDays: 1,
    tiltDeg: 23.4,
    color: 0x6b93d6,
    eccentricity: 0.017,
    inclinationDeg: 0,
    phaseDeg: 200,
  },
  {
    name: "Mars",
    au: 1.524,
    earthRadii: 0.532,
    periodYears: 1.881,
    spinDays: 1.03,
    tiltDeg: 25.2,
    color: 0xc1440e,
    eccentricity: 0.093,
    inclinationDeg: 1.85,
    phaseDeg: 280,
  },
  {
    name: "Jupiter",
    au: 5.203,
    earthRadii: 11.21,
    periodYears: 11.86,
    spinDays: 0.41,
    tiltDeg: 3.1,
    color: 0xd8ca9d,
    eccentricity: 0.048,
    inclinationDeg: 1.3,
    phaseDeg: 15,
  },
  {
    name: "Saturn",
    au: 9.537,
    earthRadii: 9.45,
    periodYears: 29.46,
    spinDays: 0.45,
    tiltDeg: 26.7,
    color: 0xfad5a5,
    eccentricity: 0.054,
    inclinationDeg: 2.5,
    phaseDeg: 90,
    hasRings: true,
  },
  {
    name: "Uranus",
    au: 19.19,
    earthRadii: 4.01,
    periodYears: 84.01,
    spinDays: -0.72, // retrograde rotation sense
    tiltDeg: 97.8,
    color: 0x4fd0e3,
    eccentricity: 0.047,
    inclinationDeg: 0.77,
    phaseDeg: 160,
  },
  {
    name: "Neptune",
    au: 30.07,
    earthRadii: 3.88,
    periodYears: 164.8,
    spinDays: 0.67,
    tiltDeg: 28.3,
    color: 0x4b70dd,
    eccentricity: 0.009,
    inclinationDeg: 1.77,
    phaseDeg: 220,
  },
];

function buildPlanet(seed: PlanetSeed): Planet {
  const semiMajorAxis = auToSceneRadius(seed.au);
  const orbit: OrbitElements = {
    semiMajorAxis,
    eccentricity: seed.eccentricity,
    inclination: seed.inclinationDeg * DEG,
    phase: seed.phaseDeg * DEG,
    periodYears: seed.periodYears,
  };
  const position = positionOnOrbit(orbit, 0);
  return asPlanet({
    name: seed.name,
    position,
    size: earthRadiiToDisplaySize(seed.earthRadii),
    earthRadii: seed.earthRadii,
    period: seed.periodYears,
    color: seed.color,
    orbit,
    spinDays: seed.spinDays,
    axialTilt: seed.tiltDeg * DEG,
    hasRings: seed.hasRings,
  });
}

function orbitFromScatteredPosition(
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

/** Mock file is static — load once for process lifetime (not re-read per request). */
let mockAsteroidsMem: Asteroid[] | null = null;
let mockAsteroidsLoading: Promise<Asteroid[]> | null = null;

function fallbackMockAsteroids(): Asteroid[] {
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

async function loadMockAsteroids(): Promise<Asteroid[]> {
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

/** Planets never change — build once at module load. */
const ALL_PLANETS: Planet[] = PLANET_SEEDS.map(buildPlanet);

const EPHEMERIS_META = {
  source: "mean-elements",
  frame: "ecliptic-of-date (approx J2000-style)",
  note: "Planet orbits use semi-major axis, eccentricity, inclination, and mean period. Positions are for visualization, not navigation-grade ephemerides.",
  references: [
    "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
    "https://ssd.jpl.nasa.gov/horizons/",
  ],
  bodies: PLANET_SEEDS.map((p) => ({
    name: p.name,
    au: p.au,
    periodYears: p.periodYears,
    eccentricity: p.eccentricity,
    inclinationDeg: p.inclinationDeg,
    spinDays: p.spinDays,
    tiltDeg: p.tiltDeg,
  })),
} as const;

/**
 * NASA NEO feed = Near-Earth Objects (approach Earth), not main-belt rocks.
 * Place them in a shell around ~1 AU (Earth's orbit) with miss distance as
 * a small radial offset — scientifically honest and easier to read.
 *
 * Also maps NeoWs close-approach + diameter fields for Body Inspector (P1).
 * Scene orbits remain approx until SBDB (P3).
 */
function processNeoData(neos: NasaNeo[][]): Asteroid[] {
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

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseLimit(value: unknown, fallback: number, max = MAX_PAGE_LIMIT): number {
  return Math.min(max, parsePositiveInt(value, fallback));
}

function queryFlag(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

/** YYYY-MM-DD or today — avoids bad NASA feed URLs. */
function parseDateParam(value: unknown): string {
  const s = String(value ?? "").trim();
  if (ISO_DATE_RE.test(s)) {
    const t = Date.parse(s + "T00:00:00Z");
    if (Number.isFinite(t)) return s;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Designation / SBDB search string — allow only characters NASA/CNEOS accept.
 * Blocks path traversal, URL injection, and oversized junk even after encodeURIComponent.
 */
const SAFE_DES_RE = /^[A-Za-z0-9][A-Za-z0-9\s.\-_()+/]{0,79}$/;

function parseDesignation(value: unknown, maxLen = 80): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > maxLen) return null;
  if (!SAFE_DES_RE.test(raw)) return null;
  return raw;
}

function setJsonCache(
  res: Response,
  maxAgeSec: number,
  hit: "HIT" | "MISS" | "BYPASS"
): void {
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
  res.setHeader("X-Cache", hit);
}

/**
 * Raw (unfiltered) NEO catalog for a date. Cached 1h + inflight-coalesced so
 * concurrent page/filter requests share one NASA (or mock) load.
 */
async function getRawAsteroidCatalog(
  startDate: string,
  useMock: boolean
): Promise<Asteroid[]> {
  // v5 = approach + diameter fields for Body Inspector (P1)
  const rawKey = `neo_raw_v5_${startDate}_${useMock ? "m" : "r"}`;
  const hit = cache.get<Asteroid[]>(rawKey);
  if (hit) return hit;

  const pending = inflightCatalog.get(rawKey);
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

function paginateAsteroids(
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

router.get("/asteroids", async (req: Request, res: Response) => {
  try {
    const start_date = parseDateParam(req.query.start_date);
    const useMock = queryFlag(req.query.mock);
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parseLimit(req.query.limit, 10);
    const filterHazardous = queryFlag(req.query.hazardous);

    // Page envelope cache (cheap hits for repeated same page)
    const pageCacheKey = `neo_page_v5_${start_date}_${useMock ? "m" : "r"}_${filterHazardous}_${pageNum}_${limitNum}`;
    const cachedPage = cache.get<PaginatedResponse<Asteroid>>(pageCacheKey);
    if (cachedPage) {
      setJsonCache(res, PAGE_TTL_SEC, "HIT");
      res.json(cachedPage);
      return;
    }

    // Raw catalog is shared across pages + hazardous filter
    const rawData = await getRawAsteroidCatalog(start_date, useMock);
    const totalHazardous = rawData.reduce(
      (n, a) => n + (a.isHazardous ? 1 : 0),
      0
    );
    const fullData = filterHazardous
      ? rawData.filter((a) => a.isHazardous)
      : rawData;

    const responseData = paginateAsteroids(
      fullData,
      pageNum,
      limitNum,
      totalHazardous
    );

    cache.set(pageCacheKey, responseData, PAGE_TTL_SEC);
    setJsonCache(res, PAGE_TTL_SEC, "MISS");
    res.json(responseData);
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      code?: string;
      response?: { status?: number };
    };
    console.error("API error:", err.message ?? err);
    const status =
      err.response?.status === 429
        ? 429
        : err.code === "ECONNABORTED"
          ? 504
          : 500;
    res.status(status).json({
      error:
        status === 429
          ? "NASA rate limit — try again shortly"
          : status === 504
            ? "Upstream timeout"
            : "API fetch failed",
    });
  }
});

router.get("/planets", (req: Request, res: Response) => {
  try {
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parseLimit(req.query.limit, 8, 16);
    const totalItems = ALL_PLANETS.length;
    const start = (pageNum - 1) * limitNum;

    if (start >= totalItems) {
      res.status(400).json({ error: "Page out of range" });
      return;
    }

    // Static data — long browser + CDN cache; no NodeCache needed
    setJsonCache(res, 86_400, "BYPASS");
    res.json({
      data: ALL_PLANETS.slice(start, start + limitNum),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
        limit: limitNum,
      },
    } satisfies PaginatedResponse<Planet>);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("Planet API error:", err.message);
    res.status(500).json({ error: "Planet fetch failed" });
  }
});

/**
 * Mean Keplerian-style elements used by the visualizer.
 * Not live JPL Horizons ephemerides — documented for portfolio honesty.
 * For true sky positions, wire JPL Horizons / SPICE offline and swap this payload.
 */
router.get("/ephemeris/meta", (_req: Request, res: Response) => {
  setJsonCache(res, 86_400, "BYPASS");
  res.json(EPHEMERIS_META);
});

type SbdbUpstream = {
  code?: number;
  message?: string;
  object?: {
    des?: string;
    fullname?: string;
    shortname?: string;
    neo?: boolean;
    pha?: boolean;
    orbit_class?: { name?: string; code?: string };
  };
  orbit?: {
    moid?: string | number;
    elements?: Array<{ name?: string; value?: string | number | null }>;
  };
  list?: Array<{ pdes?: string; name?: string }>;
};

/**
 * P3 — JPL SBDB lookup (free, no key). One designation → cached 24h.
 * GET /api/sbdb?sstr=2015%20AB
 */
async function fetchSbdb(sstr: string): Promise<SbdbOrbitResult> {
  const key = `sbdb_v1_${sstr.toLowerCase()}`;
  const hit = cache.get<SbdbOrbitResult>(key);
  if (hit) return hit;

  const pending = inflightSbdb.get(key);
  if (pending) return pending;

  const load = (async (): Promise<SbdbOrbitResult> => {
    try {
      const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(
        sstr
      )}&full-prec=0`;
      const resp = await axios.get<SbdbUpstream>(url, {
        timeout: SBDB_TIMEOUT_MS,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      const body = resp.data;

      // Multi-match — try first pdes if present
      if (body.list?.length && !body.object) {
        const first = body.list[0]?.pdes;
        if (first && first.toLowerCase() !== sstr.toLowerCase()) {
          const nested = await fetchSbdb(first);
          cache.set(key, nested, SBDB_TTL_SEC);
          return nested;
        }
        const multi: SbdbOrbitResult = {
          found: false,
          query: sstr,
          message: body.message ?? "Multiple objects matched",
        };
        cache.set(key, multi, 600);
        return multi;
      }

      if (!body.object || !body.orbit?.elements) {
        const miss: SbdbOrbitResult = {
          found: false,
          query: sstr,
          message: body.message ?? "Object not found in SBDB",
        };
        // Short cache for misses so typos don't hammer JPL
        cache.set(key, miss, 600);
        return miss;
      }

      const mapped = orbitFromSbdbElements(body.orbit.elements);
      if (!mapped) {
        const bad: SbdbOrbitResult = {
          found: false,
          query: sstr,
          message: "SBDB response missing semi-major axis",
        };
        cache.set(key, bad, 600);
        return bad;
      }

      const moidRaw = body.orbit.moid;
      const moidAu =
        moidRaw != null && moidRaw !== ""
          ? Number(moidRaw)
          : undefined;

      const result: SbdbOrbitResult = {
        found: true,
        query: sstr,
        designation: body.object.des ?? sstr,
        fullname: body.object.fullname ?? body.object.shortname,
        orbit: mapped.orbit,
        aAu: mapped.aAu,
        e: mapped.e,
        iDeg: mapped.iDeg,
        periodDays: mapped.periodDays,
        periodYears: mapped.periodYears,
        moidAu: Number.isFinite(moidAu) ? moidAu : undefined,
        pha: body.object.pha,
        neo: body.object.neo,
        orbitClass: body.object.orbit_class?.name,
      };
      cache.set(key, result, SBDB_TTL_SEC);
      return result;
    } finally {
      inflightSbdb.delete(key);
    }
  })();

  inflightSbdb.set(key, load);
  return load;
}

router.get("/sbdb", async (req: Request, res: Response) => {
  try {
    const raw = parseDesignation(req.query.sstr ?? req.query.des);
    if (!raw) {
      res.status(400).json({
        error:
          "Query sstr required (max 80 chars; letters, digits, spaces, . - _ ( ) + /)",
      });
      return;
    }

    const cacheKey = `sbdb_v1_${raw.toLowerCase()}`;
    const cached = cache.get<SbdbOrbitResult>(cacheKey);
    if (cached) {
      setJsonCache(res, cached.found ? SBDB_TTL_SEC : 600, "HIT");
      res.json(cached);
      return;
    }

    const result = await fetchSbdb(raw);
    setJsonCache(res, result.found ? SBDB_TTL_SEC : 600, "MISS");
    res.json(result);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("SBDB error:", err.message ?? err);
    res.status(err.code === "ECONNABORTED" ? 504 : 502).json({
      error: "SBDB fetch failed",
      found: false,
      query: parseDesignation(req.query.sstr) ?? "",
    });
  }
});

/* ------------------------------------------------------------------ */
/*  P5 — ISS (free) + CNEOS Sentry watchlist (free)                    */
/* ------------------------------------------------------------------ */

const inflightIss = new Map<string, Promise<IssPosition>>();
const inflightSentry = new Map<string, Promise<SentryWatchlist>>();

async function fetchIssPosition(): Promise<IssPosition> {
  const key = "iss_now";
  const hit = cache.get<IssPosition>(key);
  if (hit) return hit;

  const pending = inflightIss.get(key);
  if (pending) return pending;

  const load = (async (): Promise<IssPosition> => {
    try {
      // Prefer HTTPS Where The ISS At
      try {
        const r = await axios.get<{
          latitude: number;
          longitude: number;
          altitude?: number;
          velocity?: number;
          timestamp?: number;
        }>("https://api.wheretheiss.at/v1/satellites/25544", {
          timeout: ISS_TIMEOUT_MS,
        });
        const d = r.data;
        const pos: IssPosition = {
          lat: Number(d.latitude),
          lon: Number(d.longitude),
          altKm: d.altitude != null ? Number(d.altitude) : null,
          velocityKmS:
            d.velocity != null ? Number(d.velocity) / 3600 : null, // km/h → km/s
          timestampMs:
            d.timestamp != null
              ? Number(d.timestamp) * 1000
              : Date.now(),
          source: "wheretheiss.at",
        };
        if (Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
          cache.set(key, pos, ISS_TTL_SEC);
          return pos;
        }
      } catch {
        /* fall through to Open Notify */
      }

      // Open Notify (HTTP) — free, no key
      const r2 = await axios.get<{
        iss_position?: { latitude?: string; longitude?: string };
        timestamp?: number;
      }>("http://api.open-notify.org/iss-now.json", {
        timeout: ISS_TIMEOUT_MS,
      });
      const lat = Number(r2.data.iss_position?.latitude);
      const lon = Number(r2.data.iss_position?.longitude);
      const pos: IssPosition = {
        lat,
        lon,
        altKm: 420, // typical LEO — Open Notify does not provide altitude
        velocityKmS: null,
        timestampMs:
          r2.data.timestamp != null
            ? Number(r2.data.timestamp) * 1000
            : Date.now(),
        source: "open-notify",
      };
      if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) {
        throw new Error("Invalid ISS coordinates");
      }
      cache.set(key, pos, ISS_TTL_SEC);
      return pos;
    } finally {
      inflightIss.delete(key);
    }
  })();

  inflightIss.set(key, load);
  return load;
}

router.get("/iss", async (_req: Request, res: Response) => {
  try {
    const hit = cache.get<IssPosition>("iss_now");
    if (hit) {
      setJsonCache(res, ISS_TTL_SEC, "HIT");
      res.json(hit);
      return;
    }
    const pos = await fetchIssPosition();
    setJsonCache(res, ISS_TTL_SEC, "MISS");
    res.json(pos);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("ISS error:", err.message ?? err);
    res.status(err.code === "ECONNABORTED" ? 504 : 502).json({
      error: "ISS position unavailable",
    });
  }
});

type SentryRow = {
  des?: string;
  fullname?: string;
  ip?: string | number;
  ps_cum?: string | number;
  ts_max?: string | number;
  diameter?: string | number;
  range?: string;
  n_imp?: string | number;
  last_obs?: string;
};

function mapSentryRow(row: SentryRow): SentryWatchItem {
  const ip = Number(row.ip);
  const psCum = Number(row.ps_cum);
  const tsMax = Number(row.ts_max);
  const diameter = Number(row.diameter);
  const nImp = Number(row.n_imp);
  return {
    des: String(row.des ?? ""),
    fullname: String(row.fullname ?? row.des ?? ""),
    ip: Number.isFinite(ip) ? ip : 0,
    psCum: Number.isFinite(psCum) ? psCum : -99,
    tsMax: Number.isFinite(tsMax) ? tsMax : 0,
    diameterKm: Number.isFinite(diameter) ? diameter : null,
    range: row.range ?? null,
    nImp: Number.isFinite(nImp) ? nImp : null,
    lastObs: row.last_obs ?? null,
  };
}

/**
 * Static educational sample used when ssd-api.jpl.nasa.gov is down (common 502).
 * Values are illustrative of typical Sentry summary fields — not live risk data.
 */
const SENTRY_FALLBACK_ITEMS: SentryWatchItem[] = [
  {
    des: "1979 XB",
    fullname: "(1979 XB)",
    ip: 8.9e-7,
    psCum: -2.75,
    tsMax: 0,
    diameterKm: 0.66,
    range: "2056-2113",
    nImp: 5,
    lastObs: "1979-12-15",
  },
  {
    des: "2000 SG344",
    fullname: "(2000 SG344)",
    ip: 1.1e-4,
    psCum: -3.1,
    tsMax: 0,
    diameterKm: 0.037,
    range: "2068-2113",
    nImp: 100,
    lastObs: "2000-10-30",
  },
  {
    des: "2010 RF12",
    fullname: "(2010 RF12)",
    ip: 4.7e-2,
    psCum: -3.0,
    tsMax: 0,
    diameterKm: 0.007,
    range: "2095-2117",
    nImp: 50,
    lastObs: "2010-09-10",
  },
  {
    des: "99942",
    fullname: "99942 Apophis (2004 MN4)",
    ip: 0,
    psCum: -6.5,
    tsMax: 0,
    diameterKm: 0.34,
    range: "—",
    nImp: 0,
    lastObs: "2021-03-10",
  },
  {
    des: "2015 XJ351",
    fullname: "(2015 XJ351)",
    ip: 2.0e-6,
    psCum: -4.2,
    tsMax: 0,
    diameterKm: 0.12,
    range: "2070-2115",
    nImp: 8,
    lastObs: "2015-12-12",
  },
];

function sentryFallback(limit: number, reason: string): SentryWatchlist {
  const items = SENTRY_FALLBACK_ITEMS.slice(0, Math.max(1, limit));
  return {
    count: items.length,
    items,
    note: SENTRY_EDU_NOTE,
    source: "CNEOS Sentry (cached sample)",
    degraded: true,
    degradedReason: reason,
  };
}

const JPL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ORBIT-portfolio/1.0 (educational; contact local-dev)",
};

async function axiosGetJson<T>(
  url: string,
  timeout: number,
  retries = 1
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await axios.get<T>(url, {
        timeout,
        headers: JPL_HEADERS,
        // Accept 2xx only as success; 502/503 from nginx throw for retry
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return resp.data;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 400 + i * 400));
      }
    }
  }
  throw lastErr;
}

/** Last good live list (survives short outages better than TTL-only). */
let lastGoodSentry: SentryWatchlist | null = null;

async function fetchSentryWatchlist(limit: number): Promise<SentryWatchlist> {
  const key = `sentry_s_v2_${limit}`;
  const hit = cache.get<SentryWatchlist>(key);
  if (hit && !hit.degraded) return hit;

  const pending = inflightSentry.get(key);
  if (pending) return pending;

  const load = (async (): Promise<SentryWatchlist> => {
    try {
      // Mode S — summary of all Sentry objects
      const body = await axiosGetJson<{
        count?: number;
        data?: SentryRow[];
        signature?: unknown;
      }>("https://ssd-api.jpl.nasa.gov/sentry.api", SENTRY_TIMEOUT_MS, 1);

      const rows = (body.data ?? []).map(mapSentryRow).filter((r) => r.des);
      if (rows.length === 0) {
        throw new Error("Sentry returned empty data");
      }
      // More notable first: higher (less negative) Palermo scale
      rows.sort((a, b) => b.psCum - a.psCum);
      const items = rows.slice(0, limit);
      const list: SentryWatchlist = {
        count: items.length,
        items,
        note: SENTRY_EDU_NOTE,
        source: "CNEOS Sentry",
        degraded: false,
      };
      cache.set(key, list, SENTRY_TTL_SEC);
      lastGoodSentry = list;
      return list;
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        code?: string;
        response?: { status?: number };
      };
      const status = err.response?.status;
      const reason =
        status === 502 || status === 503
          ? `CNEOS API HTTP ${status} (upstream gateway)`
          : err.code === "ECONNABORTED"
            ? "CNEOS API timeout"
            : err.message ?? "CNEOS API unreachable";
      console.warn("Sentry live fetch failed, using fallback:", reason);

      // Prefer last good live payload over static sample
      if (lastGoodSentry?.items?.length) {
        const reused: SentryWatchlist = {
          ...lastGoodSentry,
          items: lastGoodSentry.items.slice(0, limit),
          count: Math.min(lastGoodSentry.items.length, limit),
          degraded: true,
          degradedReason: `${reason} · showing last successful fetch`,
          source: "CNEOS Sentry (cached sample)",
        };
        cache.set(key, reused, 120);
        return reused;
      }

      const fb = sentryFallback(limit, reason);
      // Short cache so we retry live soon
      cache.set(key, fb, 90);
      return fb;
    } finally {
      inflightSentry.delete(key);
    }
  })();

  inflightSentry.set(key, load);
  return load;
}

router.get("/sentry", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(40, parsePositiveInt(req.query.limit, 15));
    const key = `sentry_s_v2_${limit}`;
    const cached = cache.get<SentryWatchlist>(key);
    if (cached) {
      setJsonCache(res, cached.degraded ? 60 : SENTRY_TTL_SEC, "HIT");
      res.json(cached);
      return;
    }
    const list = await fetchSentryWatchlist(limit);
    // Always 200 — UI gets data even when CNEOS is 502 (degraded sample)
    setJsonCache(res, list.degraded ? 60 : SENTRY_TTL_SEC, "MISS");
    res.json(list);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("Sentry list error:", err.message ?? err);
    // Last resort — never leave the panel empty with hard 502
    const fb = sentryFallback(
      Math.min(40, parsePositiveInt(req.query.limit, 15)),
      err.message ?? "unexpected error"
    );
    setJsonCache(res, 60, "MISS");
    res.json(fb);
  }
});

function detailFromWatchItem(
  item: SentryWatchItem,
  reason: string
): SentryDetail {
  return {
    found: true,
    des: item.des,
    fullname: item.fullname,
    ip: item.ip,
    psCum: item.psCum,
    tsMax: item.tsMax,
    diameterKm: item.diameterKm,
    nImp: item.nImp,
    note: SENTRY_EDU_NOTE,
    degraded: true,
    degradedReason: reason,
    message: "Detail from watchlist summary (live CNEOS mode-O unavailable)",
  };
}

function findWatchItemByDes(des: string): SentryWatchItem | null {
  const q = des.toLowerCase().replace(/[()]/g, "").trim();
  const pools: SentryWatchItem[] = [
    ...(lastGoodSentry?.items ?? []),
    ...SENTRY_FALLBACK_ITEMS,
  ];
  return (
    pools.find(
      (it) =>
        it.des.toLowerCase() === q ||
        it.des.toLowerCase().replace(/[()]/g, "") === q ||
        it.fullname.toLowerCase().includes(q)
    ) ?? null
  );
}

router.get("/sentry/:des", async (req: Request, res: Response) => {
  const des = parseDesignation(req.params.des, 40);
  if (!des) {
    res.status(400).json({
      error: "Invalid designation",
      found: false,
      des: String(req.params.des ?? "").slice(0, 40),
      note: SENTRY_EDU_NOTE,
    });
    return;
  }
  const key = `sentry_o_v2_${des.toLowerCase()}`;
  const cached = cache.get<SentryDetail>(key);
  if (cached) {
    setJsonCache(res, cached.degraded ? 90 : SENTRY_TTL_SEC, "HIT");
    res.json(cached);
    return;
  }

  try {
    const body = await axiosGetJson<{
      summary?: {
        des?: string;
        fullname?: string;
        ip?: string;
        ps_cum?: string;
        ps_max?: string;
        ts_max?: string;
        diameter?: string;
        v_imp?: string;
        n_imp?: string;
        method?: string;
      };
      error?: string;
    }>(
      `https://ssd-api.jpl.nasa.gov/sentry.api?des=${encodeURIComponent(des)}`,
      SENTRY_TIMEOUT_MS,
      1
    );

    const sum = body.summary;
    if (!sum || body.error) {
      // Prefer watchlist/fallback summary over hard miss when CNEOS says not found
      // only if we have local data (e.g. degraded list)
      const local = findWatchItemByDes(des);
      if (local) {
        const d = detailFromWatchItem(
          local,
          body.error ?? "no mode-O summary"
        );
        cache.set(key, d, 120);
        setJsonCache(res, 120, "MISS");
        res.json(d);
        return;
      }
      const miss: SentryDetail = {
        found: false,
        des,
        message: body.error ?? "Not on Sentry list",
        note: SENTRY_EDU_NOTE,
      };
      cache.set(key, miss, 3600);
      setJsonCache(res, 3600, "MISS");
      res.json(miss);
      return;
    }

    const detail: SentryDetail = {
      found: true,
      des: sum.des ?? des,
      fullname: sum.fullname,
      ip: Number(sum.ip),
      psCum: Number(sum.ps_cum),
      psMax: Number(sum.ps_max),
      tsMax: Number(sum.ts_max),
      diameterKm: sum.diameter != null ? Number(sum.diameter) : null,
      vImp: sum.v_imp != null ? Number(sum.v_imp) : null,
      nImp: sum.n_imp != null ? Number(sum.n_imp) : null,
      method: sum.method ?? null,
      note: SENTRY_EDU_NOTE,
      degraded: false,
    };
    cache.set(key, detail, SENTRY_TTL_SEC);
    setJsonCache(res, SENTRY_TTL_SEC, "MISS");
    res.json(detail);
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      code?: string;
      response?: { status?: number };
    };
    const status = err.response?.status;
    const reason =
      status === 502 || status === 503
        ? `CNEOS API HTTP ${status}`
        : err.code === "ECONNABORTED"
          ? "CNEOS timeout"
          : err.message ?? "CNEOS unreachable";
    console.warn("Sentry detail live failed, using summary fallback:", reason);

    const local = findWatchItemByDes(des);
    if (local) {
      const d = detailFromWatchItem(local, reason);
      cache.set(key, d, 90);
      setJsonCache(res, 90, "MISS");
      res.json(d);
      return;
    }

    // Always 200 — client keeps briefing usable from list row data
    const soft: SentryDetail = {
      found: false,
      des,
      message: `Live Sentry detail unavailable (${reason}). Watchlist row data still shown.`,
      note: SENTRY_EDU_NOTE,
      degraded: true,
      degradedReason: reason,
    };
    cache.set(key, soft, 60);
    setJsonCache(res, 60, "MISS");
    res.json(soft);
  }
});

/* ------------------------------------------------------------------ */
/*  P6 — DONKI solar activity badge (free NASA key)                      */
/* ------------------------------------------------------------------ */

export type DonkiSolarBadge = {
  active: boolean;
  level: "quiet" | "elevated" | "storm";
  label: string;
  detail: string;
  flares24h: number;
  gstMaxKp: number | null;
  source: "NASA DONKI" | "NASA DONKI (unavailable)";
  degraded?: boolean;
};

router.get("/donki/solar", async (_req: Request, res: Response) => {
  const key = "donki_solar_v1";
  const cached = cache.get<DonkiSolarBadge>(key);
  if (cached) {
    setJsonCache(res, cached.degraded ? 120 : 1800, "HIT");
    res.json(cached);
    return;
  }

  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    const quiet: DonkiSolarBadge = {
      active: false,
      level: "quiet",
      label: "Solar: quiet (no API key)",
      detail: "Set NASA_API_KEY for live DONKI flares / geomagnetic storms",
      flares24h: 0,
      gstMaxKp: null,
      source: "NASA DONKI (unavailable)",
      degraded: true,
    };
    cache.set(key, quiet, 300);
    setJsonCache(res, 300, "MISS");
    res.json(quiet);
    return;
  }

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const [flaresRes, gstRes] = await Promise.all([
      axios
        .get<Array<{ classType?: string; beginTime?: string }>>(
          `https://api.nasa.gov/DONKI/FLR?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${encodeURIComponent(apiKey)}`,
          { timeout: 12_000, validateStatus: (s) => s >= 200 && s < 500 }
        )
        .catch(() => ({ data: [] as Array<{ classType?: string }> })),
      axios
        .get<
          Array<{
            allKpIndex?: Array<{ kpIndex?: number }>;
          }>
        >(
          `https://api.nasa.gov/DONKI/GST?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${encodeURIComponent(apiKey)}`,
          { timeout: 12_000, validateStatus: (s) => s >= 200 && s < 500 }
        )
        .catch(() => ({ data: [] as Array<{ allKpIndex?: Array<{ kpIndex?: number }> }> })),
    ]);

    const flares = Array.isArray(flaresRes.data) ? flaresRes.data : [];
    const gst = Array.isArray(gstRes.data) ? gstRes.data : [];
    let maxKp: number | null = null;
    for (const g of gst) {
      for (const k of g.allKpIndex ?? []) {
        const v = Number(k.kpIndex);
        if (Number.isFinite(v)) maxKp = maxKp == null ? v : Math.max(maxKp, v);
      }
    }
    const mClass = flares.filter((f) =>
      String(f.classType ?? "").toUpperCase().startsWith("M")
    ).length;
    const xClass = flares.filter((f) =>
      String(f.classType ?? "").toUpperCase().startsWith("X")
    ).length;

    let level: DonkiSolarBadge["level"] = "quiet";
    if (xClass > 0 || (maxKp != null && maxKp >= 6)) level = "storm";
    else if (mClass > 0 || flares.length >= 3 || (maxKp != null && maxKp >= 4))
      level = "elevated";

    const badge: DonkiSolarBadge = {
      active: level !== "quiet",
      level,
      label:
        level === "storm"
          ? "Solar: storm watch"
          : level === "elevated"
            ? "Solar: elevated"
            : "Solar: quiet",
      detail: `${flares.length} flare(s) · ${mClass} M / ${xClass} X · max Kp ${
        maxKp != null ? maxKp.toFixed(1) : "—"
      } (48h)`,
      flares24h: flares.length,
      gstMaxKp: maxKp,
      source: "NASA DONKI",
    };
    cache.set(key, badge, 1800);
    setJsonCache(res, 1800, "MISS");
    res.json(badge);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.warn("DONKI error:", err.message);
    const soft: DonkiSolarBadge = {
      active: false,
      level: "quiet",
      label: "Solar: data offline",
      detail: "DONKI unreachable — solar badge paused",
      flares24h: 0,
      gstMaxKp: null,
      source: "NASA DONKI (unavailable)",
      degraded: true,
    };
    cache.set(key, soft, 120);
    setJsonCache(res, 120, "MISS");
    res.json(soft);
  }
});

/**
 * Debug / ops: NodeCache hit rates + key counts (no payload data).
 * Useful when verifying NEO cache behaviour during demos.
 */
router.get("/cache-stats", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const stats = cache.getStats();
  res.json({
    keys: cache.keys().length,
    maxKeys: 500,
    hits: stats.hits,
    misses: stats.misses,
    ksize: stats.ksize,
    vsize: stats.vsize,
    inflightCatalogs: inflightCatalog.size,
    inflightSbdb: inflightSbdb.size,
    inflightIss: inflightIss.size,
    inflightSentry: inflightSentry.size,
    mockLoaded: mockAsteroidsMem != null,
    fullTtlSec: FULL_TTL_SEC,
    pageTtlSec: PAGE_TTL_SEC,
    sbdbTtlSec: SBDB_TTL_SEC,
    sentryTtlSec: SENTRY_TTL_SEC,
    issTtlSec: ISS_TTL_SEC,
  });
});

export default router;
