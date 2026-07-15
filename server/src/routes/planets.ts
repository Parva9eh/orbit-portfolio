import { Router, type Request, type Response } from "express";
import type { PaginatedResponse, Planet } from "../../../shared/index.ts";
import { setJsonCache } from "../lib/cache.ts";
import { parseLimit, parsePositiveInt } from "../lib/parseQuery.ts";
import { ALL_PLANETS, EPHEMERIS_META } from "../lib/astroServices.ts";

const router = Router();

router.get("/planets", (req: Request, res: Response) => {
  try {
    const pageNum = parsePositiveInt(req.query.page, 1);
    const limitNum = parseLimit(req.query.limit, 8, 16);
    const totalItems = ALL_PLANETS.length;
    const start = (pageNum - 1) * limitNum;

    if (start >= totalItems) {
      res.status(400).json({ error: "Page out of range" });
      return;
    }

    // Static data — long browser + CDN cache; no NodeCache needed
    setJsonCache(res, 86_400, "BYPASS");
    res.json({
      data: ALL_PLANETS.slice(start, start + limitNum),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
        limit: limitNum,
      },
    } satisfies PaginatedResponse<Planet>);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("Planet API error:", err.message);
    res.status(500).json({ error: "Planet fetch failed" });
  }
});

router.get("/ephemeris/meta", (_req: Request, res: Response) => {
  setJsonCache(res, 86_400, "BYPASS");
  res.json(EPHEMERIS_META);
});

export default router;
