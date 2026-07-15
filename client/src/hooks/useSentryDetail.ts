import { useEffect, useRef, useState } from "react";
import axios from "axios";
import type { SentryDetail, SentryWatchItem } from "@shared";
import { SENTRY_EDU_NOTE } from "@shared";
import { getApiBaseUrl } from "../lib/apiBase";

function detailFromSummary(
  des: string,
  summary: SentryWatchItem | null | undefined,
  reason: string
): SentryDetail {
  if (summary) {
    return {
      found: true,
      des: summary.des || des,
      fullname: summary.fullname,
      ip: summary.ip,
      psCum: summary.psCum,
      tsMax: summary.tsMax,
      diameterKm: summary.diameterKm,
      nImp: summary.nImp,
      note: SENTRY_EDU_NOTE,
      degraded: true,
      degradedReason: reason,
      message: "Using watchlist summary — live CNEOS detail unavailable",
    };
  }
  return {
    found: false,
    des,
    note: SENTRY_EDU_NOTE,
    degraded: true,
    degradedReason: reason,
    message: reason,
  };
}

/**
 * Fetch Sentry mode-O detail. Never surfaces raw "502" to the UI when a
 * watchlist summary is available — builds a soft degraded detail instead.
 */
export function useSentryDetail(
  des: string | null,
  summary?: SentryWatchItem | null
): {
  detail: SentryDetail | null;
  loading: boolean;
  error: string | null;
} {
  const [detail, setDetail] = useState<SentryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!des) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    // Instant UI from list row while network runs
    if (summary) {
      setDetail(detailFromSummary(des, summary, "loading live detail…"));
    } else {
      setDetail(null);
    }

    axios
      .get<SentryDetail>(
        `${getApiBaseUrl()}/sentry/${encodeURIComponent(des)}`,
        { timeout: 15_000, validateStatus: (s) => s >= 200 && s < 500 }
      )
      .then((res) => {
        if (cancelled || id !== reqId.current) return;
        const data = res.data;
        if (res.status >= 400 || !data) {
          setDetail(
            detailFromSummary(
              des,
              summary,
              `Sentry detail HTTP ${res.status}`
            )
          );
          setError(null);
          return;
        }
        // Prefer live found detail; if not found but we have summary, keep summary
        if (!data.found && summary) {
          setDetail(
            detailFromSummary(
              des,
              summary,
              data.message ?? data.degradedReason ?? "detail not found"
            )
          );
        } else {
          setDetail(data);
        }
        setError(null);
      })
      .catch((err) => {
        if (cancelled || id !== reqId.current) return;
        const reason =
          axios.isAxiosError(err) && err.response?.status
            ? `CNEOS temporarily unavailable (HTTP ${err.response.status})`
            : axios.isAxiosError(err) && err.code === "ECONNABORTED"
              ? "Sentry detail timed out"
              : "Live Sentry detail unavailable";
        // Soft fallback — never show "Request failed with status code 502"
        setDetail(detailFromSummary(des, summary, reason));
        setError(null);
      })
      .finally(() => {
        if (!cancelled && id === reqId.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [des, summary?.des, summary?.psCum, summary?.ip]);

  return { detail, loading, error };
}
