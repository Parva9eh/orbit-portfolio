import { Router, type Request, type Response } from "express";
import {
  cache,
  FULL_TTL_SEC,
  PAGE_TTL_SEC,
  SBDB_TTL_SEC,
  SENTRY_TTL_SEC,
  ISS_TTL_SEC,
  inflightCatalog,
  inflightSbdb,
  inflightIss,
  inflightSentry,
} from "../lib/cache.ts";
import { mockAsteroidsMem } from "../lib/neoCatalog.ts";

const router = Router();

router.get("/cache-stats", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const stats = cache.getStats();
  res.json({
    keys: cache.keys().length,
    maxKeys: 500,
    hits: stats.hits,
    misses: stats.misses,
    ksize: stats.ksize,
    vsize: stats.vsize,
    inflightCatalogs: inflightCatalog.size,
    inflightSbdb: inflightSbdb.size,
    inflightIss: inflightIss.size,
    inflightSentry: inflightSentry.size,
    mockLoaded: mockAsteroidsMem != null,
    fullTtlSec: FULL_TTL_SEC,
    pageTtlSec: PAGE_TTL_SEC,
    sbdbTtlSec: SBDB_TTL_SEC,
    sentryTtlSec: SENTRY_TTL_SEC,
    issTtlSec: ISS_TTL_SEC,
  });
});

export default router;
