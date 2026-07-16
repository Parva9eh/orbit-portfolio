import { useEffect, useMemo } from "react";
import type { Asteroid, SbdbOrbitResult } from "@shared";
import { designationForSbdb } from "@shared";
import { useApiResource } from "./useApiResource";

/** Client memory of successful SBDB results (session). */
const SBDB_MEM = new Map<string, SbdbOrbitResult>();

/**
 * P3 — fetch JPL SBDB elements for the selected NEO (one call per designation).
 * Server caches 24h; client mem avoids repeat while switching selections.
 * Uses shared useApiResource GET primitive.
 */
export function useSbdbOrbit(asteroid: Asteroid | null): {
  sbdb: SbdbOrbitResult | null;
  loading: boolean;
  error: Error | null;
} {
  const sstr = useMemo(() => {
    if (!asteroid) return null;
    if (asteroid.orbitSource === "sbdb") return null;
    return (
      designationForSbdb({
        designation: asteroid.designation,
        name: asteroid.name ?? "",
      }) || null
    );
  }, [
    asteroid?.id,
    asteroid?.designation,
    asteroid?.name,
    asteroid?.orbitSource,
  ]);

  const cacheKey = sstr?.toLowerCase() ?? "";

  // Stable seed per designation — re-read mem only when sstr changes (not after write).
  const seed = useMemo(
    () => (cacheKey ? SBDB_MEM.get(cacheKey) ?? null : null),
    [cacheKey]
  );

  const { data, loading, error } = useApiResource<SbdbOrbitResult>({
    path: "/sbdb",
    enabled: Boolean(sstr),
    params: sstr ? { sstr } : undefined,
    timeoutMs: 12_000,
    initialData: seed,
    keepOnDisable: false,
  });

  useEffect(() => {
    if (data?.found && cacheKey) {
      SBDB_MEM.set(cacheKey, data);
    }
  }, [data, cacheKey]);

  const sbdb = data ?? seed;

  return {
    sbdb,
    loading: Boolean(sstr) && loading && !seed && !data,
    error,
  };
}
