import { Router, type Request, type Response } from "express";
import type { Asteroid, PaginatedResponse } from "../../../shared/index.ts";
import {
  cache,
  FULL_TTL_SEC,
  PAGE_TTL_SEC,
  setJsonCache,
} from "../lib/cache.ts";
import {
  parseDateParam,
  parseLimit,
  parsePositiveInt,
  queryFlag,
} from "../lib/parseQuery.ts";
import {
  getRawAsteroidCatalog,
  paginateAsteroids,
} from "../lib/neoCatalog.ts";

const router = Router();

router.get("/asteroids", async (req: Request, res: Response) => {
  try {
    const start_date = parseDateParam(req.query.start_date);
    const useMock = queryFlag(req.query.mock);
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parseLimit(req.query.limit, 10);
    const filterHazardous = queryFlag(req.query.hazardous);

    // Page envelope cache (cheap hits for repeated same page)
    const pageCacheKey = `neo_page_v5_${start_date}_${useMock ? "m" : "r"}_${filterHazardous}_${pageNum}_${limitNum}`;
    const cachedPage = cache.get<PaginatedResponse<Asteroid>>(pageCacheKey);
    if (cachedPage) {
      setJsonCache(res, PAGE_TTL_SEC, "HIT");
      res.json(cachedPage);
      return;
    }

    // Raw catalog is shared across pages + hazardous filter
    const rawData = await getRawAsteroidCatalog(start_date, useMock);
    const totalHazardous = rawData.reduce(
      (n, a) => n + (a.isHazardous ? 1 : 0),
      0
    );
    const fullData = filterHazardous
      ? rawData.filter((a) => a.isHazardous)
      : rawData;

    const responseData = paginateAsteroids(
      fullData,
      pageNum,
      limitNum,
      totalHazardous
    );

    cache.set(pageCacheKey, responseData, PAGE_TTL_SEC);
    setJsonCache(res, PAGE_TTL_SEC, "MISS");
    res.json(responseData);
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      code?: string;
      response?: { status?: number };
    };
    console.error("API error:", err.message ?? err);
    const status =
      err.response?.status === 429
        ? 429
        : err.code === "ECONNABORTED"
          ? 504
          : 500;
    res.status(status).json({
      error:
        status === 429
          ? "NASA rate limit — try again shortly"
          : status === 504
            ? "Upstream timeout"
            : "API fetch failed",
    });
  }
});

export default router;
