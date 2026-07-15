import { Router, type Request, type Response } from "express";
import { SENTRY_EDU_NOTE, type SentryDetail, type SentryWatchlist } from "../../../shared/index.ts";
import { cache, SENTRY_TTL_SEC, setJsonCache } from "../lib/cache.ts";
import { parseDesignation, parsePositiveInt } from "../lib/parseQuery.ts";
import {
  detailFromWatchItem,
  fetchSentryWatchlist,
  findWatchItemByDes,
  sentryFallback,
} from "../lib/sentry.ts";
import { axiosGetJson } from "../lib/http.ts";
import { SENTRY_TIMEOUT_MS } from "../lib/cache.ts";

const router = Router();

router.get("/sentry", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(40, parsePositiveInt(req.query.limit, 15));
    const key = `sentry_s_v2_${limit}`;
    const cached = cache.get<SentryWatchlist>(key);
    if (cached) {
      setJsonCache(res, cached.degraded ? 60 : SENTRY_TTL_SEC, "HIT");
      res.json(cached);
      return;
    }
    const list = await fetchSentryWatchlist(limit);
    // Always 200 — UI gets data even when CNEOS is 502 (degraded sample)
    setJsonCache(res, list.degraded ? 60 : SENTRY_TTL_SEC, "MISS");
    res.json(list);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("Sentry list error:", err.message ?? err);
    // Last resort — never leave the panel empty with hard 502
    const fb = sentryFallback(
      Math.min(40, parsePositiveInt(req.query.limit, 15)),
      err.message ?? "unexpected error"
    );
    setJsonCache(res, 60, "MISS");
    res.json(fb);
  }
});

router.get("/sentry/:des", async (req: Request, res: Response) => {
  const des = parseDesignation(req.params.des, 40);
  if (!des) {
    res.status(400).json({
      error: "Invalid designation",
      found: false,
      des: String(req.params.des ?? "").slice(0, 40),
      note: SENTRY_EDU_NOTE,
    });
    return;
  }
  const key = `sentry_o_v2_${des.toLowerCase()}`;
  const cached = cache.get<SentryDetail>(key);
  if (cached) {
    setJsonCache(res, cached.degraded ? 90 : SENTRY_TTL_SEC, "HIT");
    res.json(cached);
    return;
  }

  try {
    const body = await axiosGetJson<{
      summary?: {
        des?: string;
        fullname?: string;
        ip?: string;
        ps_cum?: string;
        ps_max?: string;
        ts_max?: string;
        diameter?: string;
        v_imp?: string;
        n_imp?: string;
        method?: string;
      };
      error?: string;
    }>(
      `https://ssd-api.jpl.nasa.gov/sentry.api?des=${encodeURIComponent(des)}`,
      SENTRY_TIMEOUT_MS,
      1
    );

    const sum = body.summary;
    if (!sum || body.error) {
      // Prefer watchlist/fallback summary over hard miss when CNEOS says not found
      // only if we have local data (e.g. degraded list)
      const local = findWatchItemByDes(des);
      if (local) {
        const d = detailFromWatchItem(
          local,
          body.error ?? "no mode-O summary"
        );
        cache.set(key, d, 120);
        setJsonCache(res, 120, "MISS");
        res.json(d);
        return;
      }
      const miss: SentryDetail = {
        found: false,
        des,
        message: body.error ?? "Not on Sentry list",
        note: SENTRY_EDU_NOTE,
      };
      cache.set(key, miss, 3600);
      setJsonCache(res, 3600, "MISS");
      res.json(miss);
      return;
    }

    const detail: SentryDetail = {
      found: true,
      des: sum.des ?? des,
      fullname: sum.fullname,
      ip: Number(sum.ip),
      psCum: Number(sum.ps_cum),
      psMax: Number(sum.ps_max),
      tsMax: Number(sum.ts_max),
      diameterKm: sum.diameter != null ? Number(sum.diameter) : null,
      vImp: sum.v_imp != null ? Number(sum.v_imp) : null,
      nImp: sum.n_imp != null ? Number(sum.n_imp) : null,
      method: sum.method ?? null,
      note: SENTRY_EDU_NOTE,
      degraded: false,
    };
    cache.set(key, detail, SENTRY_TTL_SEC);
    setJsonCache(res, SENTRY_TTL_SEC, "MISS");
    res.json(detail);
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      code?: string;
      response?: { status?: number };
    };
    const status = err.response?.status;
    const reason =
      status === 502 || status === 503
        ? `CNEOS API HTTP ${status}`
        : err.code === "ECONNABORTED"
          ? "CNEOS timeout"
          : err.message ?? "CNEOS unreachable";
    console.warn("Sentry detail live failed, using summary fallback:", reason);

    const local = findWatchItemByDes(des);
    if (local) {
      const d = detailFromWatchItem(local, reason);
      cache.set(key, d, 90);
      setJsonCache(res, 90, "MISS");
      res.json(d);
      return;
    }

    // Always 200 — client keeps briefing usable from list row data
    const soft: SentryDetail = {
      found: false,
      des,
      message: `Live Sentry detail unavailable (${reason}). Watchlist row data still shown.`,
      note: SENTRY_EDU_NOTE,
      degraded: true,
      degradedReason: reason,
    };
    cache.set(key, soft, 60);
    setJsonCache(res, 60, "MISS");
    res.json(soft);
  }
});

export default router;
