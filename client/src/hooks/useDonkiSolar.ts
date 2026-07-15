import { useApiResource } from "./useApiResource";

export type DonkiSolarBadge = {
  active: boolean;
  level: "quiet" | "elevated" | "storm";
  label: string;
  detail: string;
  flares24h: number;
  gstMaxKp: number | null;
  source: string;
  degraded?: boolean;
};

const OFFLINE: DonkiSolarBadge = {
  active: false,
  level: "quiet",
  label: "Solar: offline",
  detail: "DONKI unreachable",
  flares24h: 0,
  gstMaxKp: null,
  source: "NASA DONKI (unavailable)",
  degraded: true,
};

/** P6 — solar activity badge (DONKI, free NASA key). */
export function useDonkiSolar(enabled = true): {
  solar: DonkiSolarBadge | null;
  loading: boolean;
} {
  const { data, loading, error } = useApiResource<DonkiSolarBadge>({
    path: "/donki/solar",
    enabled,
    timeoutMs: 15_000,
    initialData: null,
  });
  return {
    solar: error && !data ? OFFLINE : data,
    loading,
  };
}
