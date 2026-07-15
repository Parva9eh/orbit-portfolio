import axios from "axios";
import {
  orbitFromSbdbElements,
  type SbdbOrbitResult,
} from "../../../shared/index.ts";
import {
  cache,
  SBDB_TTL_SEC,
  SBDB_TIMEOUT_MS,
  inflightSbdb,
} from "./cache.ts";

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
export async function fetchSbdb(sstr: string): Promise<SbdbOrbitResult> {
  const key = `sbdb_v1_${sstr.toLowerCase()}`;
  const hit = cache.get<SbdbOrbitResult>(key);
  if (hit) return hit;

  const pending = inflightSbdb.get(key) as Promise<SbdbOrbitResult> | undefined;
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

