import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { DEFAULT_ISS, type IssPosition } from "@shared";
import { getApiBaseUrl } from "../lib/apiBase";

/**
 * P5 — poll ISS when enabled. Seeds DEFAULT_ISS immediately so the LEO ring
 * does not wait on the network.
 */
export function useIssPosition(enabled: boolean): {
  iss: IssPosition | null;
  loading: boolean;
  error: Error | null;
} {
  const [iss, setIss] = useState<IssPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      // Keep last sample optional; clear so re-enable re-seeds
      return;
    }

    // Immediate placeholder so scene can draw ring + craft without waiting
    setIss((prev) => prev ?? { ...DEFAULT_ISS, timestampMs: Date.now() });

    let cancelled = false;

    const tick = async () => {
      const id = ++reqId.current;
      try {
        setLoading(true);
        const res = await axios.get<IssPosition>(`${getApiBaseUrl()}/iss`, {
          timeout: 8_000,
        });
        if (cancelled || id !== reqId.current) return;
        setIss(res.data);
        setError(null);
      } catch (err) {
        if (cancelled || id !== reqId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        // Keep DEFAULT_ISS / last good — do not clear to null
        setIss((prev) => prev ?? { ...DEFAULT_ISS, timestampMs: Date.now() });
      } finally {
        if (!cancelled && id === reqId.current) setLoading(false);
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return { iss, loading, error };
}
