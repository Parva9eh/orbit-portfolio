/**
 * P4 — deep-link query state for Mission Control.
 * Hash still owns story step (#briefing | #live | …).
 * Search params own Live briefing: mode, view, date, neo, compare, hazardous.
 */

import type { ViewMode } from "../components/mission/MissionTopBar";
import type { ViewScale } from "../sim/useSim";
import { todayIsoLocal } from "./dateUtils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type OrbitUrlState = {
  mode: ViewMode;
  view: ViewScale;
  date: string;
  /** Primary selected NEO id */
  neo: string | null;
  /** Up to 2 NEO ids for orbit compare (order = A, B) */
  compare: string[];
  hazardous: boolean;
  /** Sentry designation open in briefing / scene */
  sentry: string | null;
  /** Camera focus on ISS + Earth only */
  issFocus: boolean;
};

export const COMPARE_COLORS = {
  a: "#7eb8e8",
  b: "#e8b87e",
} as const;

export function defaultOrbitUrlState(): OrbitUrlState {
  return {
    mode: "story",
    view: "system",
    date: todayIsoLocal(),
    neo: null,
    compare: [],
    hazardous: false,
    sentry: null,
    issFocus: false,
  };
}

export function parseOrbitUrl(
  search = typeof window !== "undefined" ? window.location.search : ""
): Partial<OrbitUrlState> {
  const params = new URLSearchParams(
    search.startsWith("?") ? search : search ? `?${search}` : ""
  );
  const out: Partial<OrbitUrlState> = {};

  const mode = params.get("mode");
  if (mode === "live" || mode === "story") out.mode = mode;

  const view = params.get("view");
  if (view === "system" || view === "nearEarth") out.view = view;

  const date = params.get("date");
  if (date && ISO_DATE.test(date)) out.date = date;

  const neo = params.get("neo");
  if (neo) out.neo = neo;

  const compareRaw = params.get("compare");
  if (compareRaw) {
    out.compare = compareRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  const haz = params.get("hazardous");
  if (haz === "1" || haz === "true") out.hazardous = true;
  if (haz === "0" || haz === "false") out.hazardous = false;

  const sentry = params.get("sentry");
  if (sentry) out.sentry = sentry;

  const issFocus = params.get("issFocus");
  if (issFocus === "1" || issFocus === "true") out.issFocus = true;
  if (issFocus === "0" || issFocus === "false") out.issFocus = false;

  return out;
}

/** Build search string (no leading ?) for current briefing state. */
export function buildOrbitSearch(state: OrbitUrlState): string {
  const params = new URLSearchParams();
  if (state.mode === "live") {
    params.set("mode", "live");
    params.set("view", state.view);
    params.set("date", state.date);
    if (state.hazardous) params.set("hazardous", "1");
    if (state.neo) params.set("neo", state.neo);
    if (state.compare.length > 0) {
      params.set("compare", state.compare.join(","));
    }
    if (state.sentry) params.set("sentry", state.sentry);
    if (state.issFocus) params.set("issFocus", "1");
  } else if (state.mode === "story") {
    // Keep URL clean in story unless we want mode=story explicitly
    // Omit params for default story
  }
  return params.toString();
}

/**
 * Replace history entry search params; preserve hash.
 * Uses replaceState so scrubbing timeline doesn't spam history.
 */
export function writeOrbitUrl(state: OrbitUrlState): void {
  if (typeof window === "undefined") return;
  const search = buildOrbitSearch(state);
  const url = new URL(window.location.href);
  url.search = search ? `?${search}` : "";
  // Keep existing hash (mission step)
  window.history.replaceState({}, "", url.toString());
}

/** Full shareable URL for clipboard. */
export function buildShareUrl(state: OrbitUrlState, hash = "live"): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const search = buildOrbitSearch({ ...state, mode: "live" });
  url.search = search ? `?${search}` : "";
  url.hash = hash;
  return url.toString();
}

export async function copyShareUrl(state: OrbitUrlState): Promise<boolean> {
  try {
    const text = buildShareUrl(state);
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const text = buildShareUrl(state);
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/** Add/remove compare slot (max 2). Returns next list. */
export function toggleCompareId(
  current: string[],
  id: string
): string[] {
  if (current.includes(id)) {
    return current.filter((x) => x !== id);
  }
  if (current.length >= 2) {
    // Replace second slot (keep first as anchor)
    return [current[0], id];
  }
  return [...current, id];
}
