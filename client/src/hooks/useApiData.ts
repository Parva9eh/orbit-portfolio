import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import type { PaginatedResponse } from "@shared";

export type UseApiDataOptions = {
  cache?: boolean;
  retry?: number;
  params?: Record<string, string | number | boolean | undefined>;
};

type CacheEntry<T> = PaginatedResponse<T>;

const API_CACHE = new Map<string, CacheEntry<unknown>>();

function getBaseUrl(): string {
  const isDev = import.meta.env.MODE === "development";
  return (
    import.meta.env.VITE_API_URL ||
    (isDev ? "http://localhost:8000/api" : "/api")
  );
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
  const fullUrl = `${getBaseUrl()}${endpoint}`;

  const paramsKey = useMemo(
    () =>
      JSON.stringify({
        page: options.params?.page ?? 1,
        limit: options.params?.limit ?? 10,
        ...options.params,
      }),
    [options.params]
  );

  const resolvedParams = useMemo(() => {
    const parsed = JSON.parse(paramsKey) as Record<
      string,
      string | number | boolean
    >;
    return parsed;
  }, [paramsKey]);

  const cacheKey = `${fullUrl}${paramsKey}`;
  const useCache = options.cache !== false;
  const retryDefault = options.retry ?? (isDev ? 0 : 3);

  useEffect(() => {
    let isMounted = true;
    const shouldFetch = !API_CACHE.has(cacheKey) || !useCache;
    if (shouldFetch) setLoading(true);

    const fetchData = async (retries: number): Promise<void> => {
      if (!shouldFetch && isMounted) {
        const cached = API_CACHE.get(cacheKey) as
          | PaginatedResponse<T>
          | undefined;
        if (cached?.data) {
          setData(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await axios.get<PaginatedResponse<T>>(fullUrl, {
          headers: { "Cache-Control": "no-cache" },
          params: resolvedParams,
        });
        const result = res.data;
        if (isMounted && result && Array.isArray(result.data)) {
          setData(result);
          if (useCache) {
            API_CACHE.set(cacheKey, result as CacheEntry<unknown>);
          }
        } else if (isMounted) {
          setError(new Error("Invalid API response"));
        }
      } catch (err) {
        if (isMounted && retries > 0) {
          console.warn("API call failed, retrying...", err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await fetchData(retries - 1);
        } else if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchData(retryDefault);

    return () => {
      isMounted = false;
    };
  }, [cacheKey, fullUrl, resolvedParams, retryDefault, useCache]);

  return { data, loading, error };
}
