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
  inflightIss,
} from "./cache.ts";

const WTIA = "https://api.wheretheiss.at/v1";
const ISS_NORAD = 25544;
const TLE_TTL_SEC = 3600;
const TRAIL_POINTS = 10;
/** Seconds between trail samples (~2 min × 10 ≈ 20 min arc) */
const TRAIL_STEP_SEC = 120;

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
  // "2 25544 51.6311 ..." → inclination at index 2
  const i = Number(parts[2]);
  return Number.isFinite(i) ? i : null;
}

async function fetchTle(): Promise<IssTle | null> {
  const key = "iss_tle";
  const hit = cache.get<IssTle>(key);
  if (hit) return hit;
  try {
    const r = await axios.get<WtiaTles>(`${WTIA}/satellites/${ISS_NORAD}/tles`, {
      timeout: ISS_TIMEOUT_MS,
    });
    const d = r.data;
    if (!d.line1 || !d.line2) return null;
    const tle: IssTle = {
      header: d.header ?? d.name ?? "ISS (ZARYA)",
      line1: d.line1,
      line2: d.line2,
      inclinationDeg: parseTleInclinationDeg(d.line2),
      tleTimestampMs:
        d.tle_timestamp != null ? Number(d.tle_timestamp) * 1000 : null,
    };
    cache.set(key, tle, TLE_TTL_SEC);
    return tle;
  } catch {
    return null;
  }
}

async function fetchGround(
  lat: number,
  lon: number
): Promise<IssGroundContext | null> {
  try {
    // API path is lat,lon per public docs title; both orders tried if needed
    const r = await axios.get<WtiaCoords>(
      `${WTIA}/coordinates/${lat},${lon}`,
      { timeout: ISS_TIMEOUT_MS }
    );
    const d = r.data;
    return {
      timezoneId: d.timezone_id ?? null,
      offsetHours: d.offset != null && Number.isFinite(d.offset) ? d.offset : null,
      countryCode: d.country_code ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchTrail(nowSec: number): Promise<IssTrailSample[]> {
  const stamps: number[] = [];
  for (let i = TRAIL_POINTS - 1; i >= 0; i--) {
    stamps.push(nowSec - i * TRAIL_STEP_SEC);
  }
  try {
    const r = await axios.get<WtiaSatellite[]>(
      `${WTIA}/satellites/${ISS_NORAD}/positions`,
      {
        params: { timestamps: stamps.join(",") },
        timeout: ISS_TIMEOUT_MS + 4000,
      }
    );
    const list = Array.isArray(r.data) ? r.data : [];
    return list
      .map((d) => ({
        lat: Number(d.latitude),
        lon: Number(d.longitude),
        altKm: d.altitude != null ? Number(d.altitude) : null,
        timestampMs:
          d.timestamp != null ? Number(d.timestamp) * 1000 : Date.now(),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  } catch {
    return [];
  }
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

export async function fetchIssPosition(): Promise<IssPosition> {
  const key = "iss_now_v2";
  const hit = cache.get<IssPosition>(key);
  if (hit) return hit;

  const pending = inflightIss.get(key) as Promise<IssPosition> | undefined;
  if (pending) return pending;

  const load = (async (): Promise<IssPosition> => {
    try {
      // Prefer HTTPS Where The ISS At (rich telemetry)
      try {
        const r = await axios.get<WtiaSatellite>(
          `${WTIA}/satellites/${ISS_NORAD}`,
          {
            params: { units: "kilometers" },
            timeout: ISS_TIMEOUT_MS,
          }
        );
        const d = r.data;
        const lat = Number(d.latitude);
        const lon = Number(d.longitude);
        const timestampMs =
          d.timestamp != null ? Number(d.timestamp) * 1000 : Date.now();
        const nowSec =
          d.timestamp != null
            ? Number(d.timestamp)
            : Math.floor(Date.now() / 1000);

        // Enrich in parallel (best-effort)
        const [ground, trail, tle] = await Promise.all([
          Number.isFinite(lat) && Number.isFinite(lon)
            ? fetchGround(lat, lon)
            : Promise.resolve(null),
          fetchTrail(nowSec),
          fetchTle(),
        ]);

        const pos: IssPosition = {
          lat,
          lon,
          altKm: d.altitude != null ? Number(d.altitude) : null,
          // API velocity is km/h when units=kilometers
          velocityKmS:
            d.velocity != null ? Number(d.velocity) / 3600 : null,
          timestampMs,
          source: "wheretheiss.at",
          visibility: parseVisibility(d.visibility),
          footprintKm: d.footprint != null ? Number(d.footprint) : null,
          solarLat: d.solar_lat != null ? Number(d.solar_lat) : null,
          solarLon: d.solar_lon != null ? Number(d.solar_lon) : null,
          ground,
          trail,
          tle,
        };
        if (Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
          cache.set(key, pos, ISS_TTL_SEC);
          return pos;
        }
      } catch {
        /* fall through to Open Notify */
      }

      // Open Notify (HTTP) — free, no key; sparse fields
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
        altKm: 420,
        velocityKmS: null,
        timestampMs:
          r2.data.timestamp != null
            ? Number(r2.data.timestamp) * 1000
            : Date.now(),
        source: "open-notify",
        ...emptyExtras(),
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
