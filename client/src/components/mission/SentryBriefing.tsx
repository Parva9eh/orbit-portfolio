import type { SentryDetail, SentryWatchItem } from "@shared";
import { SENTRY_EDU_NOTE } from "@shared";

type SentryBriefingProps = {
  des: string;
  /** Row from watchlist when available (instant UI before detail fetch) */
  summary?: SentryWatchItem | null;
  detail?: SentryDetail | null;
  loading?: boolean;
  error?: string | null;
  onDismiss: () => void;
  onLookupSbdb?: () => void;
  sbdbHint?: string | null;
};

function formatIp(ip: number | undefined): string {
  if (ip == null || !Number.isFinite(ip) || ip <= 0) return "—";
  return ip.toExponential(2);
}

/**
 * Soft in-panel briefing for a Sentry object that is not on today's NeoWs page.
 * Replaces browser alert() — production-safe, educational, non-alarmist.
 */
export default function SentryBriefing({
  des,
  summary,
  detail,
  loading = false,
  error = null,
  onDismiss,
  onLookupSbdb,
  sbdbHint = null,
}: SentryBriefingProps) {
  const title = detail?.fullname || summary?.fullname || des;
  const ip = detail?.ip ?? summary?.ip;
  const psCum = detail?.psCum ?? summary?.psCum;
  const tsMax = detail?.tsMax ?? summary?.tsMax;
  const diameterKm = detail?.diameterKm ?? summary?.diameterKm ?? null;
  const nImp = detail?.nImp ?? summary?.nImp;

  return (
    <div
      className="mb-2.5 rounded-lg border border-amber-500/25 bg-amber-950/30 p-2.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-amber-300/95 font-semibold">
            Sentry briefing
          </p>
          <h5 className="text-sm font-semibold text-white truncate" title={title}>
            {title}
          </h5>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs text-gray-400 hover:text-white px-1"
          aria-label="Dismiss Sentry briefing"
        >
          ×
        </button>
      </div>

      <p className="text-[10px] text-sky-200/80 leading-snug mb-2 rounded bg-sky-500/10 border border-sky-500/20 px-2 py-1">
        Not in today’s NeoWs approach list — that only means no close approach
        in the loaded date window, not that the object is “incoming.” We load
        JPL SBDB and can draw its heliocentric orbit in the scene (System view).
      </p>

      {loading && (
        <p className="text-[11px] text-amber-300/90 mb-1.5">
          Refreshing live Sentry detail…
        </p>
      )}
      {detail?.degraded && (
        <p className="text-[10px] text-amber-300/85 mb-1.5 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 leading-snug">
          Live CNEOS detail is temporarily offline
          {detail.degradedReason ? ` (${detail.degradedReason})` : ""}. Numbers
          below are from the watchlist summary / sample — still educational, not
          a live risk feed.
        </p>
      )}
      {error && !detail && (
        <p className="text-[11px] text-amber-400/90 mb-1.5">{error}</p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-gray-300 mb-2">
        <dt className="text-gray-500">Designation</dt>
        <dd className="text-right tabular-nums text-gray-100">{des}</dd>
        <dt className="text-gray-500">Palermo (cum)</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {psCum != null && Number.isFinite(psCum) ? psCum.toFixed(2) : "—"}
        </dd>
        <dt className="text-gray-500">Impact prob.</dt>
        <dd className="text-right tabular-nums text-gray-100">{formatIp(ip)}</dd>
        <dt className="text-gray-500">Torino max</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {tsMax != null && Number.isFinite(tsMax) ? tsMax : "—"}
        </dd>
        <dt className="text-gray-500">Diameter</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {diameterKm != null
            ? diameterKm < 1
              ? `~${Math.round(diameterKm * 1000)} m`
              : `~${diameterKm.toFixed(2)} km`
            : "—"}
        </dd>
        {nImp != null && (
          <>
            <dt className="text-gray-500">VI count</dt>
            <dd className="text-right tabular-nums text-gray-100">{nImp}</dd>
          </>
        )}
        {summary?.range && (
          <>
            <dt className="text-gray-500">Range</dt>
            <dd className="text-right text-gray-100">{summary.range}</dd>
          </>
        )}
      </dl>

      <p className="text-[10px] text-amber-200/65 leading-snug mb-2 border-l-2 border-amber-500/35 pl-2">
        {detail?.note ?? SENTRY_EDU_NOTE}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {onLookupSbdb && (
          <button
            type="button"
            onClick={onLookupSbdb}
            className="text-[11px] font-semibold px-2 py-1 rounded-md border bg-emerald-500/15 text-emerald-100 border-emerald-400/35 hover:bg-emerald-500/25"
          >
            Draw SBDB orbit in scene
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] font-semibold px-2 py-1 rounded-md border bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
      {sbdbHint && (
        <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">{sbdbHint}</p>
      )}
    </div>
  );
}
