import type { Response } from "express";
import NodeCache from "node-cache";

/** Full NASA / mock catalogs — 1h. Page envelopes are short-lived or sliced on demand. */
export const FULL_TTL_SEC = 3600;
export const PAGE_TTL_SEC = 300;
export const SBDB_TTL_SEC = 86_400; // 24h — orbital elements change rarely
export const SENTRY_TTL_SEC = 6 * 3600; // 6h — risk list changes slowly
export const ISS_TTL_SEC = 12; // short — live craft (rich path is slower upstream)
export const NASA_TIMEOUT_MS = 12_000;
export const SBDB_TIMEOUT_MS = 10_000;
/** Where The ISS At is often slow (10–15s); keep above observed p95 */
export const ISS_TIMEOUT_MS = 18_000;
/** Enrichment calls (trail / coords / TLE) — fail soft without blocking forever */
export const ISS_ENRICH_TIMEOUT_MS = 10_000;
export const SENTRY_TIMEOUT_MS = 18_000;
export const MAX_PAGE_LIMIT = 50;

/**
 * useClones: false — we treat entries as immutable (no in-place mutation after set).
 * Avoids expensive deep clones on every get/set for NEO arrays.
 */
export const cache = new NodeCache({
  stdTTL: FULL_TTL_SEC,
  checkperiod: 120,
  maxKeys: 500,
  useClones: false,
});

/** Named inflight maps so /cache-stats can report sizes. */
export const inflightCatalog = new Map<string, Promise<unknown>>();
export const inflightSbdb = new Map<string, Promise<unknown>>();
export const inflightIss = new Map<string, Promise<unknown>>();
export const inflightSentry = new Map<string, Promise<unknown>>();

export function setJsonCache(
  res: Response,
  maxAgeSec: number,
  hit: "HIT" | "MISS" | "BYPASS"
): void {
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
  res.setHeader("X-Cache", hit);
}

/**
 * Coalesce concurrent cold misses for the same key (prevents upstream stampede).
 * Prefer this over open-coding Map get/set/finally in new loaders.
 */
export function withInflight<T>(
  map: Map<string, Promise<unknown>>,
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  const pending = map.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const load = (async (): Promise<T> => {
    try {
      return await loader();
    } finally {
      map.delete(key);
    }
  })();

  map.set(key, load);
  return load;
}
