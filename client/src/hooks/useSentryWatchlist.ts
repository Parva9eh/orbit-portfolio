import { useEffect, useRef, useState } from "react";
import axios from "axios";
import type { SentryWatchlist } from "@shared";

function getBaseUrl(): string {
  const isDev = import.meta.env.MODE === "development";
  return (
    import.meta.env.VITE_API_URL ||
    (isDev ? "http://localhost:8000/api" : "/api")
  );
}

/**
 * P5 — CNEOS Sentry summary (top-N by Palermo scale). Cached on server 6h.
 */
export function useSentryWatchlist(
  enabled: boolean,
  limit = 12
): {
  list: SentryWatchlist | null;
  loading: boolean;
  error: Error | null;
} {
  const [list, setList] = useState<SentryWatchlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const id = ++reqId.current;
    setLoading(true);

    axios
      .get<SentryWatchlist>(`${getBaseUrl()}/sentry`, {
        params: { limit },
        timeout: 15_000,
      })
      .then((res) => {
        if (cancelled || id !== reqId.current) return;
        setList(res.data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || id !== reqId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled && id === reqId.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, limit]);

  return { list, loading, error };
}
