import { Router, type Request, type Response } from "express";
import type { IssPosition } from "../../../shared/index.ts";
import { cache, ISS_TTL_SEC, setJsonCache } from "../lib/cache.ts";
import { fetchIssPosition } from "../lib/astroServices.ts";

const router = Router();

router.get("/iss", async (_req: Request, res: Response) => {
  try {
    const hit = cache.get<IssPosition>("iss_now");
    if (hit) {
      setJsonCache(res, ISS_TTL_SEC, "HIT");
      res.json(hit);
      return;
    }
    const pos = await fetchIssPosition();
    setJsonCache(res, ISS_TTL_SEC, "MISS");
    res.json(pos);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error("ISS error:", err.message ?? err);
    res.status(err.code === "ECONNABORTED" ? 504 : 502).json({
      error: "ISS position unavailable",
    });
  }
});

export default router;
