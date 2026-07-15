import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import type { PaginatedResponse } from "@shared";
import { getApiBaseUrl } from "../lib/apiBase";

export type UseApiDataOptions = {
  cache?: boolean;
  retry?: number;
  /** When false, skip fetch (keeps prior data if any). */
  enabled?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
  /** Client memory TTL in ms (default 5 min). */
  ttlMs?: number;
};

type CacheEntry<T> = {
  data: PaginatedResponse<T>;
  expiresAt: number;
};

const API_CACHE = new Map<string, CacheEntry<unknown>>();
/** Share one in-flight request per cache key (React StrictMode / dual hooks). */
const INFLIGHT = new Map<string, Promise<PaginatedResponse<unknown>>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;
const REQUEST_TIMEOUT_MS = 15_000;

/** Stable serialize params for cache keys (sorted keys). */
function stableParamsKey(
  params: Record<string, string | number | boolean | undefined> | undefined
): string {
  const normalized: Record<string, string | number | boolean> = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
  };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      normalized[k] = v;
    }
  }
  return JSON.stringify(
    Object.keys(normalized)
      .sort()
      .reduce<Record<string, string | number | boolean>>((acc, key) => {
        acc[key] = normalized[key];
        return acc;
      }, {})
  );
}

function getCached<T>(key: string): PaginatedResponse<T> | undefined {
  const entry = API_CACHE.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    API_CACHE.delete(key);
    return undefined;
  }
  // Touch for simple LRU: re-insert moves to Map end
  API_CACHE.delete(key);
  API_CACHE.set(key, entry as CacheEntry<unknown>);
  return entry.data;
}

function setCached<T>(
  key: string,
  data: PaginatedResponse<T>,
  ttlMs: number
): void {
  API_CACHE.set(key, {
    data: data as PaginatedResponse<unknown>,
    expiresAt: Date.now() + ttlMs,
  } as CacheEntry<unknown>);

  while (API_CACHE.size > MAX_CACHE_ENTRIES) {
    const oldest = API_CACHE.keys().next().value;
    if (oldest === undefined) break;
    API_CACHE.delete(oldest);
  }
}

export function useApiData<T>(
  endpoint: string,
  options: UseApiDataOptions = {}
): {
  data: PaginatedResponse<T> | null;
  loading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isDev = import.meta.env.MODE === "development";
  const fullUrl = `${getApiBaseUrl()}${endpoint}`;

  const paramsKey = useMemo(
    () => stableParamsKey(options.params),
    [options.params]
  );

  const resolvedParams = useMemo(() => {
    return JSON.parse(paramsKey) as Record<string, string | number | boolean>;
  }, [paramsKey]);

  const cacheKey = `${fullUrl}?${paramsKey}`;
  const useCache = options.cache !== false;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const retryDefault = options.retry ?? (isDev ? 0 : 3);
  const enabled = options.enabled !== false;
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const id = ++requestId.current;
    const cached = useCache ? getCached<T>(cacheKey) : undefined;

    if (cached?.data) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchData = async (retries: number): Promise<void> => {
      try {
        let pending = INFLIGHT.get(cacheKey) as
          | Promise<PaginatedResponse<T>>
          | undefined;

        if (!pending) {
          pending = axios
            .get<PaginatedResponse<T>>(fullUrl, {
              params: resolvedParams,
              timeout: REQUEST_TIMEOUT_MS,
            })
            .then((res) => res.data)
            .finally(() => {
              INFLIGHT.delete(cacheKey);
            });
          INFLIGHT.set(
            cacheKey,
            pending as Promise<PaginatedResponse<unknown>>
          );
        }

        const result = await pending;
        if (!isMounted || id !== requestId.current) return;

        if (result && Array.isArray(result.data)) {
          setData(result);
          if (useCache) {
            setCached(cacheKey, result, ttlMs);
          }
        } else {
          setError(new Error("Invalid API response"));
        }
      } catch (err) {
        if (!isMounted || id !== requestId.current) return;
        if (retries > 0) {
          console.warn("API call failed, retrying...", err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await fetchData(retries - 1);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted && id === requestId.current) {
          setLoading(false);
        }
      }
    };

    void fetchData(retryDefault);

    return () => {
      isMounted = false;
    };
  }, [
    cacheKey,
    fullUrl,
    resolvedParams,
    retryDefault,
    useCache,
    enabled,
    ttlMs,
  ]);

  return { data, loading, error };
}
