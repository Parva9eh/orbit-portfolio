/** Display formatters for NEO briefing UI (client + optional server logs). */

import type { CloseApproach } from "./celestial";
import { LUNAR_DISTANCE_KM } from "./celestial";

export function kmToLd(km: number): number {
  return km / LUNAR_DISTANCE_KM;
}

/** Compact miss distance: "0.82 LD · 315 000 km" */
export function formatMiss(
  missLd: number,
  missKm: number,
  opts?: { compact?: boolean }
): string {
  const ld = Number.isFinite(missLd) ? missLd : kmToLd(missKm);
  const ldStr =
    ld >= 10 ? ld.toFixed(1) : ld >= 1 ? ld.toFixed(2) : ld.toFixed(3);
  const kmStr = formatDistanceKm(missKm);
  if (opts?.compact) return `${ldStr} LD`;
  return `${ldStr} LD · ${kmStr}`;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "—";
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)} M km`;
  if (km >= 10_000) return `${Math.round(km).toLocaleString("en-US")} km`;
  if (km >= 1) return `${km.toFixed(0)} km`;
  return `${(km * 1000).toFixed(0)} m`;
}

export function formatVelocityKmS(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(1)} km/s`;
}

/** Diameter range or single value in human units. */
export function formatDiameterKm(min?: number, max?: number, fallbackKm?: number): string {
  const lo = min ?? fallbackKm;
  const hi = max ?? fallbackKm;
  if (lo == null && hi == null) return "—";
  if (lo != null && hi != null && Math.abs(hi - lo) > 1e-9) {
    return `${formatOneDiameter(lo)} – ${formatOneDiameter(hi)}`;
  }
  return formatOneDiameter(hi ?? lo!);
}

function formatOneDiameter(km: number): string {
  if (km >= 1) return `${km.toFixed(2)} km`;
  if (km >= 0.001) return `${Math.round(km * 1000)} m`;
  return `${(km * 1e6).toFixed(0)} m`;
}

export function formatApproachDate(dateIso: string): string {
  if (!dateIso) return "—";
  // NeoWs often "2026-Jul-16 14:22" or ISO
  const t = Date.parse(dateIso.replace(/-/g, " "));
  if (Number.isFinite(t)) {
    return new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
  return dateIso;
}

/** One-line Earth-relative briefing for status bar / HUD. */
export function formatEarthRelativeLine(approach: CloseApproach): string {
  const miss = formatMiss(approach.missLd, approach.missKm);
  const vel = formatVelocityKmS(approach.relativeVelocityKmS);
  const date = approach.dateIso
    ? formatApproachDate(approach.dateIso).replace(" UTC", "")
    : "";
  const parts = [`miss ${miss}`, vel !== "—" ? vel : null, date || null].filter(
    Boolean
  );
  return parts.join(" · ");
}

/** AU of 1 (mean Earth–Sun). */
export const KM_PER_AU = 149_597_870.7;

/**
 * Approximate AU from scene separation.
 * Inverse of auToSceneRadius (scene ≈ 14 · au^0.55) — for visualization scale only.
 */
export function sceneDistToApproxAu(sceneDist: number): number {
  const d = Math.max(sceneDist, 1e-6);
  return Math.pow(d / 14, 1 / 0.55);
}

export function formatAu(au: number): string {
  if (!Number.isFinite(au) || au < 0) return "—";
  if (au >= 10) return `${au.toFixed(1)} au`;
  if (au >= 1) return `${au.toFixed(2)} au`;
  if (au >= 0.01) return `${au.toFixed(3)} au`;
  return `${au.toFixed(4)} au`;
}

/** Multi-unit distance line for the ruler. */
export function formatRulerDistance(sceneDist: number): {
  au: number;
  km: number;
  ld: number;
  label: string;
} {
  const au = sceneDistToApproxAu(sceneDist);
  const km = au * KM_PER_AU;
  const ld = km / LUNAR_DISTANCE_KM;
  const label = `${formatAu(au)} · ${formatDistanceKm(km)} · ${
    ld >= 10 ? ld.toFixed(1) : ld.toFixed(2)
  } LD`;
  return { au, km, ld, label };
}

/** Plain-text briefing for clipboard / portfolio demos (P6). */
export function formatExportSummary(input: {
  name: string;
  designation?: string;
  isHazardous?: boolean;
  approach?: CloseApproach;
  diameterKmMin?: number;
  diameterKmMax?: number;
  sizeKm?: number;
  orbitSource?: string;
  aAu?: number;
  e?: number;
  iDeg?: number;
  periodYears?: number;
}): string {
  const lines: string[] = [
    `ORBIT briefing — ${input.name}`,
    input.designation ? `Designation: ${input.designation}` : "",
    input.isHazardous != null
      ? `PHA: ${input.isHazardous ? "yes" : "no"}`
      : "",
  ].filter(Boolean);

  if (input.approach) {
    const a = input.approach;
    lines.push(
      `Close approach: ${formatApproachDate(a.dateIso)}`,
      `Miss: ${formatMiss(a.missLd, a.missKm)}`,
      `Relative velocity: ${formatVelocityKmS(a.relativeVelocityKmS)}`,
      a.orbitingBody ? `Orbiting body: ${a.orbitingBody}` : ""
    );
  }

  lines.push(
    `Diameter: ${formatDiameterKm(
      input.diameterKmMin,
      input.diameterKmMax,
      input.sizeKm
    )}`
  );

  if (input.orbitSource) {
    lines.push(`Orbit source: ${input.orbitSource}`);
  }
  if (input.aAu != null || input.e != null) {
    lines.push(
      [
        input.aAu != null ? `a=${input.aAu.toFixed(3)} au` : null,
        input.e != null ? `e=${input.e.toFixed(3)}` : null,
        input.iDeg != null ? `i=${input.iDeg.toFixed(1)}°` : null,
        input.periodYears != null
          ? `P=${input.periodYears.toFixed(2)} yr`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }

  lines.push(
    "",
    "Data: NASA NeoWs / JPL SBDB (as noted). Visualization only — not navigation-grade.",
    `Exported: ${new Date().toISOString()}`
  );
  return lines.filter((l) => l !== "").join("\n");
}
