import { Router } from "express";
import asteroids from "./asteroids.ts";
import planets from "./planets.ts";
import sbdb from "./sbdb.ts";
import iss from "./iss.ts";
import sentry from "./sentry.ts";
import donki from "./donki.ts";
import cacheStats from "./cacheStats.ts";

const router = Router();

router.use(asteroids);
router.use(planets);
router.use(sbdb);
router.use(iss);
router.use(sentry);
router.use(donki);
router.use(cacheStats);

export default router;
