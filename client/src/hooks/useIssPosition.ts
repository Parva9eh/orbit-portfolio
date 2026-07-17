import { useMemo } from "react";
import { DEFAULT_ISS, type IssPosition } from "@shared";
import { useApiResource } from "./useApiResource";

/**
 * Poll ISS when enabled. Seeds DEFAULT_ISS for the LEO ring immediately, but
 * UI should treat `source === "mock"` as "acquiring" — not live telemetry.
 */
export function useIssPosition(enabled: boolean): {
  /** Position for the scene (seed until first live sample) */
  iss: IssPosition | null;
  /** True once a non-mock network sample has arrived */
  isLive: boolean;
  /** True while enabled and still only showing the local seed */
  acquiring: boolean;
  loading: boolean;
  error: Error | null;
} {
  // timestampMs: 0 → age label is "seed", not "just now"
  const seed = useMemo<IssPosition>(
    () => ({ ...DEFAULT_ISS, timestampMs: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  );

  const { data, loading, error } = useApiResource<IssPosition>({
    path: "/iss",
    enabled,
    pollMs: 12_000,
    timeoutMs: 28_000,
    initialData: seed,
  });

  const iss = data;
  const isLive = Boolean(iss && iss.source !== "mock");
  const acquiring = Boolean(enabled && !isLive);

  return {
    iss,
    isLive,
    acquiring,
    loading: acquiring || loading,
    error,
  };
}
