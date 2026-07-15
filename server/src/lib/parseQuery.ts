import { MAX_PAGE_LIMIT } from "./cache.ts";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Designation / SBDB search string — allow only characters NASA/CNEOS accept.
 * Blocks path traversal, URL injection, and oversized junk even after encodeURIComponent.
 */
const SAFE_DES_RE = /^[A-Za-z0-9][A-Za-z0-9\s.\-_()+\/]{0,79}$/;

export function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parseLimit(
  value: unknown,
  fallback: number,
  max = MAX_PAGE_LIMIT
): number {
  return Math.min(max, parsePositiveInt(value, fallback));
}

export function queryFlag(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

/** YYYY-MM-DD or today — avoids bad NASA feed URLs. */
export function parseDateParam(value: unknown): string {
  const s = String(value ?? "").trim();
  if (ISO_DATE_RE.test(s)) {
    const t = Date.parse(s + "T00:00:00Z");
    if (Number.isFinite(t)) return s;
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseDesignation(value: unknown, maxLen = 80): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > maxLen) return null;
  if (!SAFE_DES_RE.test(raw)) return null;
  return raw;
}
