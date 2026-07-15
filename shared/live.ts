/** P5 — free live / watchlist payloads (ISS + CNEOS Sentry). */

export type IssPosition = {
  lat: number;
  lon: number;
  /** km above Earth surface when known */
  altKm: number | null;
  velocityKmS: number | null;
  /** Unix ms when sample was taken */
  timestampMs: number;
  source: "wheretheiss.at" | "open-notify" | "mock";
};

/**
 * Seed until live /api/iss responds — ring + craft can mount immediately.
 * Kept in shared so hooks do not import from presentation components.
 */
export const DEFAULT_ISS: IssPosition = {
  lat: 28.5,
  lon: -80.6,
  altKm: 420,
  velocityKmS: 7.66,
  timestampMs: 0,
  source: "mock",
};

export type SentryWatchItem = {
  des: string;
  fullname: string;
  /** Cumulative impact probability (very small numbers) */
  ip: number;
  /** Palermo scale cumulative (more notable when larger / less negative) */
  psCum: number;
  /** Torino max (0–10); often 0 */
  tsMax: number;
  diameterKm: number | null;
  /** Year range string e.g. "2056-2113" */
  range: string | null;
  nImp: number | null;
  lastObs: string | null;
};

export type SentryWatchlist = {
  count: number;
  items: SentryWatchItem[];
  /** Educational disclaimer always echoed to clients */
  note: string;
  source: "CNEOS Sentry" | "CNEOS Sentry (cached sample)";
  /** True when live CNEOS was unreachable and we served a static sample */
  degraded?: boolean;
  /** Human reason when degraded */
  degradedReason?: string;
};

export type SentryDetail = {
  found: boolean;
  des: string;
  fullname?: string;
  ip?: number;
  psCum?: number;
  psMax?: number;
  tsMax?: number;
  diameterKm?: number | null;
  vImp?: number | null;
  nImp?: number | null;
  method?: string | null;
  message?: string;
  note: string;
  /** True when built from list/sample because live mode-O failed */
  degraded?: boolean;
  degradedReason?: string;
};

export const SENTRY_EDU_NOTE =
  "Educational only — Sentry lists theoretical impact possibilities with extremely small probabilities. Not an alarm or prediction of impact.";
