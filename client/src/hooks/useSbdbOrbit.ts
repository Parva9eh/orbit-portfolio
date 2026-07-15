import { useEffect, useRef, useState } from "react";
import type { Asteroid, SbdbOrbitResult } from "@shared";
import { designationForSbdb } from "@shared";
import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";

/** Client memory of successful SBDB results (session). */
const SBDB_MEM = new Map<string, SbdbOrbitResult>();
const SBDB_INFLIGHT = new Map<string, Promise<SbdbOrbitResult>>();

/**
 * P3 — fetch JPL SBDB elements for the selected NEO (one call per designation).
 * Server caches 24h; client mem avoids repeat while switching selections.
 */
export function useSbdbOrbit(asteroid: Asteroid | null): {
  sbdb: SbdbOrbitResult | null;
  loading: boolean;
  error: Error | null;
} {
  const [sbdb, setSbdb] = useState<SbdbOrbitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);

  const asteroidId = asteroid?.id;
  const designation = asteroid?.designation;
  const name = asteroid?.name;
  const orbitSource = asteroid?.orbitSource;

  useEffect(() => {
    if (!asteroidId) {
      setSbdb(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (orbitSource === "sbdb") {
      setSbdb(null);
      setLoading(false);
      setError(null);
      return;
    }

    const sstr = designationForSbdb({
      designation,
      name: name ?? "",
    });
    if (!sstr) {
      setSbdb(null);
      setLoading(false);
      return;
    }

    const key = sstr.toLowerCase();
    const cached = SBDB_MEM.get(key);
    if (cached) {
      setSbdb(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setSbdb(null);

    const run = async () => {
      try {
        let pending = SBDB_INFLIGHT.get(key);
        if (!pending) {
          pending = axios
            .get<SbdbOrbitResult>(`${getApiBaseUrl()}/sbdb`, {
              params: { sstr },
              timeout: 12_000,
            })
            .then((res) => res.data)
            .finally(() => {
              SBDB_INFLIGHT.delete(key);
            });
          SBDB_INFLIGHT.set(key, pending);
        }

        const result = await pending;
        if (cancelled || id !== reqId.current) return;

        if (result?.found) {
          SBDB_MEM.set(key, result);
        }
        setSbdb(result ?? null);
      } catch (err) {
        if (cancelled || id !== reqId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setSbdb(null);
      } finally {
        if (!cancelled && id === reqId.current) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [asteroidId, designation, name, orbitSource]);

  return { sbdb, loading, error };
}
