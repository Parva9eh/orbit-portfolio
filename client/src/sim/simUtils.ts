import { EARTH_YEAR_SECONDS } from "@shared";
import type { QualityPreset } from "./SimContext";

export function scalePosition(
  p: { x: number; y: number; z: number },
  trueScale: boolean,
): { x: number; y: number; z: number } {
  if (!trueScale) return p;
  const r = Math.hypot(p.x, p.y, p.z);
  if (r < 1e-6) return p;
  const factor = 1 + Math.pow(r / 20, 0.85) * 0.55;
  return { x: p.x * factor, y: p.y * factor, z: p.z * factor };
}

export function formatSimClock(simSeconds: number): {
  year: number;
  day: number;
  label: string;
} {
  const yearsFloat = Math.max(0, simSeconds) / EARTH_YEAR_SECONDS;
  const year = Math.floor(yearsFloat) + 1;
  const day = Math.floor((yearsFloat % 1) * 365.25) + 1;
  return {
    year,
    day,
    label: `Y${year} · D${day}`,
  };
}

export function qualitySettings(q: QualityPreset) {
  if (q === "low") {
    return {
      starCount: 900,
      beltCount: 160,
      bloomIntensity: 0.1,
      bloomThreshold: 0.92,
      enableShafts: false,
      enableScatter: false,
      enableGodFx: false,
      // Still show the sky plate on Low — cheap BackSide sphere
      enableMilkyWay: true,
      dprMax: 1,
      orbitSegments: 384,
      maxNeos: 8,
      planetSegments: 32,
      sunSegments: 48,
      orbitLineWidth: 0.7,
      vignetteDarkness: 0.35,
      exposure: 0.88,
    };
  }

  return {
    starCount: 11000,
    beltCount: 900,
    bloomIntensity: 0.42,
    bloomThreshold: 0.7,
    enableShafts: true,
    enableScatter: false,
    enableGodFx: true,
    enableMilkyWay: true,
    dprMax: 2,
    orbitSegments: 768,
    maxNeos: 28,
    planetSegments: 80,
    sunSegments: 128,
    orbitLineWidth: 0.95,
    vignetteDarkness: 0.5,
    exposure: 1.02,
  };
}

export function scaleSize(size: number, trueScale: boolean): number {
  return trueScale ? size * 0.72 : size * 1.22;
}
