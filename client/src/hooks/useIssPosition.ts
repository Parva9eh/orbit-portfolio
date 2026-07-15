import { useMemo } from "react";
import { DEFAULT_ISS, type IssPosition } from "@shared";
import { useApiResource } from "./useApiResource";

/**
 * P5 — poll ISS when enabled. Seeds DEFAULT_ISS immediately so the LEO ring
 * does not wait on the network.
 */
export function useIssPosition(enabled: boolean): {
  iss: IssPosition | null;
  loading: boolean;
  error: Error | null;
} {
  const seed = useMemo<IssPosition>(
    () => ({ ...DEFAULT_ISS, timestampMs: Date.now() }),
    // re-seed when re-enabled so timestamp is fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  );
  const { data, loading, error } = useApiResource<IssPosition>({
    path: "/iss",
    enabled,
    pollMs: 10_000,
    timeoutMs: 8_000,
    initialData: seed,
  });
  return { iss: data, loading, error };
}
