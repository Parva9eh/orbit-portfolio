import axios from "axios";
import type {
  IssGroundContext,
  IssPosition,
  IssTle,
  IssTrailSample,
  IssVisibility,
} from "../../../shared/index.ts";
import {
  cache,
  ISS_TTL_SEC,
  ISS_TIMEOUT_MS,
  ISS_ENRICH_TIMEOUT_MS,
  inflightIss,
} from "./cache.ts";

const WTIA = "https://api.wheretheiss.at/v1";
const ISS_NORAD = 25544;
const TLE_TTL_SEC = 3600;
const TRAIL_TTL_SEC = 90;
const GROUND_TTL_SEC = 60;
/** Fewer points = faster /positions call on a slow upstream */
const TRAIL_POINTS = 5;
/** Seconds between trail samples (~2 min × 5 ≈ 10 min arc) */
const TRAIL_STEP_SEC = 120;
const OPEN_NOTIFY_TTL_SEC = 6;

const CACHE_CORE = "iss_now_v2";
const CACHE_TLE = "iss_tle";
const CACHE_TRAIL = "iss_trail";
const CACHE_GROUND = "iss_ground";

type WtiaSatellite = {
  name?: string;
  id?: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  velocity?: number;
  visibility?: string;
  footprint?: number;
  timestamp?: number;
  solar_lat?: number;
  solar_lon?: number;
  units?: string;
};

type WtiaCoords = {
  latitude?: number;
  longitude?: number;
  timezone_id?: string;
  offset?: number;
  country_code?: string;
};

type WtiaTles = {
  requested_timestamp?: number;
  tle_timestamp?: number;
  header?: string;
  line1?: string;
  line2?: string;
  name?: string;
  id?: string;
};

function parseVisibility(raw: string | undefined): IssVisibility {
  const v = (raw ?? "").toLowerCase();
  if (v === "daylight" || v === "visible") return "daylight";
  if (v === "eclipsed" || v === "eclipse" || v === "shadow") return "eclipsed";
  return "unknown";
}

function parseTleInclinationDeg(line2: string | undefined): number | null {
  if (!line2) return null;
  const parts = line2.trim().split(/\s+/);
  const i = Number(parts[2]);
  return Number.isFinite(i) ? i : null;
}

function emptyExtras(): Pick<
  IssPosition,
  | "visibility"
  | "footprintKm"
  | "solarLat"
  | "solarLon"
  | "ground"
  | "trail"
  | "tle"
> {
  return {
    visibility: "unknown",
    footprintKm: null,
    solarLat: null,
    solarLon: null,
    ground: null,
    trail: [],
    tle: null,
  };
}

function readCachedExtras(): Pick<
  IssPosition,
  "ground" | "trail" | "tle"
> {
  return {
    ground: cache.get<IssGroundContext>(CACHE_GROUND) ?? null,
    trail: cache.get<IssTrailSample[]>(CACHE_TRAIL) ?? [],
    tle: cache.get<IssTle>(CACHE_TLE) ?? null,
  };
}

async function fetchTleIntoCache(): Promise<void> {
  if (cache.get<IssTle>(CACHE_TLE)) return;
  try {
    const r = await axios.get<WtiaTles>(
      `${WTIA}/satellites/${ISS_NORAD}/tles`,
      { timeout: ISS_ENRICH_TIMEOUT_MS }
    );
    const d = r.data;
    if (!d.line1 || !d.line2) return;
    const tle: IssTle = {
      header: d.header ?? d.name ?? "ISS (ZARYA)",
      line1: d.line1,
      line2: d.line2,
      inclinationDeg: parseTleInclinationDeg(d.line2),
      tleTimestampMs:
        d.tle_timestamp != null ? Number(d.tle_timestamp) * 1000 : null,
    };
    cache.set(CACHE_TLE, tle, TLE_TTL_SEC);
  } catch (e) {
    // Quiet after first warn per process window — still log once-ish
    console.warn(
      "[iss] TLE enrich failed:",
      e instanceof Error ? e.message : e
    );
  }
}

async function fetchGroundIntoCache(lat: number, lon: number): Promise<void> {
  const gKey = `${CACHE_GROUND}:${lat.toFixed(1)},${lon.toFixed(1)}`;
  if (cache.get<IssGroundContext>(gKey)) {
    cache.set(CACHE_GROUND, cache.get<IssGroundContext>(gKey)!, GROUND_TTL_SEC);
    return;
  }
  try {
    const r = await axios.get<WtiaCoords>(
      `${WTIA}/coordinates/${lat},${lon}`,
      { timeout: ISS_ENRICH_TIMEOUT_MS }
    );
    const d = r.data;
    const ground: IssGroundContext = {
      timezoneId: d.timezone_id ?? null,
      offsetHours:
        d.offset != null && Number.isFinite(d.offset) ? d.offset : null,
      countryCode: d.country_code ?? null,
    };
    cache.set(gKey, ground, GROUND_TTL_SEC);
    cache.set(CACHE_GROUND, ground, GROUND_TTL_SEC);
  } catch {
    /* soft */
  }
}

async function fetchTrailIntoCache(nowSec: number): Promise<void> {
  if (cache.get<IssTrailSample[]>(CACHE_TRAIL)) return;
  const stamps: number[] = [];
  for (let i = TRAIL_POINTS - 1; i >= 0; i--) {
    stamps.push(nowSec - i * TRAIL_STEP_SEC);
  }
  try {
    const r = await axios.get<WtiaSatellite[]>(
      `${WTIA}/satellites/${ISS_NORAD}/positions`,
      {
        params: { timestamps: stamps.join(",") },
        timeout: ISS_ENRICH_TIMEOUT_MS,
      }
    );
    const list = Array.isArray(r.data) ? r.data : [];
    const trail = list
      .map((d) => ({
        lat: Number(d.latitude),
        lon: Number(d.longitude),
        altKm: d.altitude != null ? Number(d.altitude) : null,
        timestampMs:
          d.timestamp != null ? Number(d.timestamp) * 1000 : Date.now(),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (trail.length) cache.set(CACHE_TRAIL, trail, TRAIL_TTL_SEC);
  } catch (e) {
    console.warn(
      "[iss] trail enrich failed:",
      e instanceof Error ? e.message : e
    );
  }
}

/** Background only — never awaited on the request critical path. */
function scheduleEnrichments(lat: number, lon: number, nowSec: number): void {
  void Promise.allSettled([
    fetchGroundIntoCache(lat, lon),
    fetchTrailIntoCache(nowSec),
    fetchTleIntoCache(),
  ]);
}

/**
 * Core position first (Where The ISS At). Trail / TLE / ground load in the
 * background into cache and appear on the next poll (~12s) so a slow WTIA
 * enrich path never blocks alt/vel/visibility.
 */
export async function fetchIssPosition(): Promise<IssPosition> {
  const hit = cache.get<IssPosition>(CACHE_CORE);
  if (hit) {
    // Refresh enrichments opportunistically while serving hot cache
    if (hit.source === "wheretheiss.at") {
      scheduleEnrichments(
        hit.lat,
        hit.lon,
        Math.floor(hit.timestampMs / 1000) || Math.floor(Date.now() / 1000)
      );
      // Merge latest enrichments into a shallow copy for this response
      const extras = readCachedExtras();
      return { ...hit, ...extras };
    }
    return hit;
  }

  const pending = inflightIss.get(CACHE_CORE) as
    | Promise<IssPosition>
    | undefined;
  if (pending) return pending;

  const load = (async (): Promise<IssPosition> => {
    try {
      try {
        const r = await axios.get<WtiaSatellite>(
          `${WTIA}/satellites/${ISS_NORAD}`,
          {
            params: { units: "kilometers" },
            timeout: ISS_TIMEOUT_MS,
            headers: { Accept: "application/json" },
          }
        );
        const d = r.data;
        const lat = Number(d.latitude);
        const lon = Number(d.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error("WTIA returned non-finite coordinates");
        }

        const timestampMs =
          d.timestamp != null ? Number(d.timestamp) * 1000 : Date.now();
        const nowSec =
          d.timestamp != null
            ? Number(d.timestamp)
            : Math.floor(Date.now() / 1000);

        // Kick enrichments — do not await (upstream is often >10s each)
        scheduleEnrichments(lat, lon, nowSec);

        const extras = readCachedExtras();
        const pos: IssPosition = {
          lat,
          lon,
          altKm: d.altitude != null ? Number(d.altitude) : null,
          velocityKmS:
            d.velocity != null ? Number(d.velocity) / 3600 : null,
          timestampMs,
          source: "wheretheiss.at",
          visibility: parseVisibility(d.visibility),
          footprintKm: d.footprint != null ? Number(d.footprint) : null,
          solarLat: d.solar_lat != null ? Number(d.solar_lat) : null,
          solarLon: d.solar_lon != null ? Number(d.solar_lon) : null,
          ...extras,
        };
        cache.set(CACHE_CORE, pos, ISS_TTL_SEC);
        return pos;
      } catch (e) {
        console.warn(
          "[iss] Where The ISS At failed, falling back to Open Notify:",
          e instanceof Error ? e.message : e
        );
      }

      const r2 = await axios.get<{
        iss_position?: { latitude?: string; longitude?: string };
        timestamp?: number;
      }>("http://api.open-notify.org/iss-now.json", {
        timeout: 8_000,
      });
      const lat = Number(r2.data.iss_position?.latitude);
      const lon = Number(r2.data.iss_position?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("Invalid ISS coordinates from Open Notify");
      }
      const pos: IssPosition = {
        lat,
        lon,
        altKm: null,
        velocityKmS: null,
        timestampMs:
          r2.data.timestamp != null
            ? Number(r2.data.timestamp) * 1000
            : Date.now(),
        source: "open-notify",
        ...emptyExtras(),
      };
      cache.set(CACHE_CORE, pos, OPEN_NOTIFY_TTL_SEC);
      return pos;
    } finally {
      inflightIss.delete(CACHE_CORE);
    }
  })();

  inflightIss.set(CACHE_CORE, load);
  return load;
}
