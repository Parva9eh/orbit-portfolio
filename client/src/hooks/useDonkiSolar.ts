import { useEffect, useState } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";

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

/** P6 — solar activity badge (DONKI, free NASA key). */
export function useDonkiSolar(enabled = true): {
  solar: DonkiSolarBadge | null;
  loading: boolean;
} {
  const [solar, setSolar] = useState<DonkiSolarBadge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    axios
      .get<DonkiSolarBadge>(`${getApiBaseUrl()}/donki/solar`, { timeout: 15_000 })
      .then((res) => {
        if (!cancelled) setSolar(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setSolar({
            active: false,
            level: "quiet",
            label: "Solar: offline",
            detail: "DONKI unreachable",
            flares24h: 0,
            gstMaxKp: null,
            source: "NASA DONKI (unavailable)",
            degraded: true,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { solar, loading };
}
