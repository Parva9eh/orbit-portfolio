import { Router, type Request, type Response } from "express";
import type { SbdbOrbitResult } from "../../../shared/index.ts";
import { cache, SBDB_TTL_SEC, setJsonCache } from "../lib/cache.ts";
import { parseDesignation } from "../lib/parseQuery.ts";
import { fetchSbdb } from "../lib/sbdb.ts";

const router = Router();

router.get("/sbdb", async (req: Request, res: Response) => {
  try {
    const raw = parseDesignation(req.query.sstr ?? req.query.des);
    if (!raw) {
      res.status(400).json({
        error:
          "Query sstr required (max 80 chars; letters, digits, spaces, . - _ ( ) + /)",
      });
      return;
    }

    const cacheKey = `sbdb_v1_${raw.toLowerCase()}`;
    const cached = cache.get<SbdbOrbitResult>(cacheKey);
    if (cached) {
      setJsonCache(res, cached.found ? SBDB_TTL_SEC : 600, "HIT");
      res.json(cached);
      return;
    }

    const result = await fetchSbdb(raw);
    setJsonCache(res, result.found ? SBDB_TTL_SEC : 600, "MISS");
    res.json(result);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("SBDB error:", err.message ?? err);
    res.status(err.code === "ECONNABORTED" ? 504 : 502).json({
      error: "SBDB fetch failed",
      found: false,
      query: parseDesignation(req.query.sstr) ?? "",
    });
  }
});

export default router;
