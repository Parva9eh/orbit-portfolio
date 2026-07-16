import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";

export type UseApiResourceOptions<T> = {
  /** Path under API base, e.g. `/iss` or `/sentry` */
  path: string;
  enabled?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
  /** Poll interval; omit for one-shot fetch */
  pollMs?: number;
  timeoutMs?: number;
  /** Seed data while first fetch runs (or on error) */
  initialData?: T | null;
  /** Keep previous data when disabled (default true) */
  keepOnDisable?: boolean;
};

/**
 * Lightweight GET resource hook — shared enable/cancel/loading pattern for
 * ISS, Sentry, DONKI, etc. (paginated NeoWs stays on useApiData).
 */
export function useApiResource<T>(opts: UseApiResourceOptions<T>): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const {
    path,
    enabled = true,
    params,
    pollMs,
    timeoutMs = 12_000,
    initialData = null,
    keepOnDisable = true,
  } = opts;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);
  const paramsKey = JSON.stringify(params ?? {});

  const fetchOnce = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await axios.get<T>(`${getApiBaseUrl()}${path}`, {
        params,
        timeout: timeoutMs,
      });
      if (id !== reqId.current) return;
      setData(res.data);
      setError(null);
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      if (initialData != null) {
        setData((prev) => prev ?? initialData);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [path, paramsKey, timeoutMs, initialData]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      if (!keepOnDisable) setData(initialData);
      return;
    }

    // Seed for this path/params key so consumers never briefly see a prior resource.
    setData(initialData);

    void fetchOnce();

    if (pollMs && pollMs > 0) {
      const timer = window.setInterval(() => void fetchOnce(), pollMs);
      return () => {
        window.clearInterval(timer);
        reqId.current += 1;
      };
    }

    return () => {
      reqId.current += 1;
    };
  }, [enabled, fetchOnce, pollMs, keepOnDisable, initialData]);

  return { data, loading, error, refetch: fetchOnce };
}
