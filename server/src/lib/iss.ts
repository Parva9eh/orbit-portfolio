import axios from "axios";
import type { IssPosition } from "../../../shared/index.ts";
import {
  cache,
  ISS_TTL_SEC,
  ISS_TIMEOUT_MS,
  inflightIss,
} from "./cache.ts";

export async function fetchIssPosition(): Promise<IssPosition> {
  const key = "iss_now";
  const hit = cache.get<IssPosition>(key);
  if (hit) return hit;

  const pending = inflightIss.get(key) as Promise<IssPosition> | undefined;
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

