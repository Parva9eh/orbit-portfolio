import { Router, type Request, type Response } from "express";
import axios from "axios";
import { cache, setJsonCache } from "../lib/cache.ts";
import type { DonkiSolarBadge } from "../lib/astroServices.ts";

const router = Router();

router.get("/donki/solar", async (_req: Request, res: Response) => {
  const key = "donki_solar_v1";
  const cached = cache.get<DonkiSolarBadge>(key);
  if (cached) {
    setJsonCache(res, cached.degraded ? 120 : 1800, "HIT");
    res.json(cached);
    return;
  }

  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    const quiet: DonkiSolarBadge = {
      active: false,
      level: "quiet",
      label: "Solar: quiet (no API key)",
      detail: "Set NASA_API_KEY for live DONKI flares / geomagnetic storms",
      flares24h: 0,
      gstMaxKp: null,
      source: "NASA DONKI (unavailable)",
      degraded: true,
    };
    cache.set(key, quiet, 300);
    setJsonCache(res, 300, "MISS");
    res.json(quiet);
    return;
  }

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const [flaresRes, gstRes] = await Promise.all([
      axios
        .get<Array<{ classType?: string; beginTime?: string }>>(
          `https://api.nasa.gov/DONKI/FLR?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${encodeURIComponent(apiKey)}`,
          { timeout: 12_000, validateStatus: (s) => s >= 200 && s < 500 }
        )
        .catch(() => ({ data: [] as Array<{ classType?: string }> })),
      axios
        .get<
          Array<{
            allKpIndex?: Array<{ kpIndex?: number }>;
          }>
        >(
          `https://api.nasa.gov/DONKI/GST?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${encodeURIComponent(apiKey)}`,
          { timeout: 12_000, validateStatus: (s) => s >= 200 && s < 500 }
        )
        .catch(() => ({ data: [] as Array<{ allKpIndex?: Array<{ kpIndex?: number }> }> })),
    ]);

    const flares = Array.isArray(flaresRes.data) ? flaresRes.data : [];
    const gst = Array.isArray(gstRes.data) ? gstRes.data : [];
    let maxKp: number | null = null;
    for (const g of gst) {
      for (const k of g.allKpIndex ?? []) {
        const v = Number(k.kpIndex);
        if (Number.isFinite(v)) maxKp = maxKp == null ? v : Math.max(maxKp, v);
      }
    }
    const mClass = flares.filter((f) =>
      String(f.classType ?? "").toUpperCase().startsWith("M")
    ).length;
    const xClass = flares.filter((f) =>
      String(f.classType ?? "").toUpperCase().startsWith("X")
    ).length;

    let level: DonkiSolarBadge["level"] = "quiet";
    if (xClass > 0 || (maxKp != null && maxKp >= 6)) level = "storm";
    else if (mClass > 0 || flares.length >= 3 || (maxKp != null && maxKp >= 4))
      level = "elevated";

    const badge: DonkiSolarBadge = {
      active: level !== "quiet",
      level,
      label:
        level === "storm"
          ? "Solar: storm watch"
          : level === "elevated"
            ? "Solar: elevated"
            : "Solar: quiet",
      detail: `${flares.length} flare(s) · ${mClass} M / ${xClass} X · max Kp ${
        maxKp != null ? maxKp.toFixed(1) : "—"
      } (48h)`,
      flares24h: flares.length,
      gstMaxKp: maxKp,
      source: "NASA DONKI",
    };
    cache.set(key, badge, 1800);
    setJsonCache(res, 1800, "MISS");
    res.json(badge);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.warn("DONKI error:", err.message);
    const soft: DonkiSolarBadge = {
      active: false,
      level: "quiet",
      label: "Solar: data offline",
      detail: "DONKI unreachable — solar badge paused",
      flares24h: 0,
      gstMaxKp: null,
      source: "NASA DONKI (unavailable)",
      degraded: true,
    };
    cache.set(key, soft, 120);
    setJsonCache(res, 120, "MISS");
    res.json(soft);
  }
});

export default router;
