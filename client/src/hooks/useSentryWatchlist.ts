import type { SentryWatchlist } from "@shared";
import { useApiResource } from "./useApiResource";

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
  const { data, loading, error } = useApiResource<SentryWatchlist>({
    path: "/sentry",
    enabled,
    params: { limit },
    timeoutMs: 15_000,
  });
  return { list: data, loading, error };
}
