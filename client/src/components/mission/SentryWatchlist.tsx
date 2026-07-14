import type { SentryWatchItem, SentryWatchlist } from "@shared";
import { SENTRY_EDU_NOTE } from "@shared";

type SentryWatchlistPanelProps = {
  list: SentryWatchlist | null;
  loading?: boolean;
  error?: Error | null;
  onPickDes?: (des: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function formatIp(ip: number): string {
  if (!Number.isFinite(ip) || ip <= 0) return "—";
  if (ip >= 1e-3) return ip.toExponential(2);
  return ip.toExponential(1);
}

function Row({
  item,
  rank,
  onPick,
}: {
  item: SentryWatchItem;
  rank: number;
  onPick?: (des: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick?.(item.des)}
        className="w-full text-left px-2 py-1.5 rounded-md bg-black/30 hover:bg-amber-500/10 text-xs text-gray-200 flex items-start gap-2"
        title="Open briefing — focuses in scene if this NEO is on today's NeoWs list"
      >
        <span className="text-gray-600 tabular-nums shrink-0 w-4">
          {rank}.
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-gray-100 truncate block">
            {item.fullname || item.des}
          </span>
          <span className="text-[10px] text-gray-500 tabular-nums">
            PS {item.psCum.toFixed(2)}
            {item.diameterKm != null && (
              <> · ~{item.diameterKm < 1 ? `${(item.diameterKm * 1000).toFixed(0)} m` : `${item.diameterKm.toFixed(2)} km`}</>
            )}
            {item.range && <> · {item.range}</>}
          </span>
        </span>
        <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
          IP {formatIp(item.ip)}
        </span>
      </button>
    </li>
  );
}

/**
 * P5 — CNEOS Sentry top objects (educational, non-alarmist).
 */
export default function SentryWatchlistPanel({
  list,
  loading = false,
  error = null,
  onPickDes,
  collapsed = false,
  onToggleCollapse,
}: SentryWatchlistPanelProps) {
  return (
    <div
      className="mb-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 p-2"
      role="region"
      aria-label="Sentry watchlist"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-[10px] uppercase tracking-widest text-amber-300/95 font-semibold text-left"
        >
          Sentry watch {collapsed ? "▸" : "▾"}
        </button>
        {loading && (
          <span className="text-[10px] text-amber-400/80">loading…</span>
        )}
      </div>

      {!collapsed && (
        <>
          <p className="text-[10px] text-amber-200/70 leading-snug mb-2 border-l-2 border-amber-500/40 pl-2">
            {list?.note ?? SENTRY_EDU_NOTE}
          </p>

          {list?.degraded && (
            <p className="text-[10px] text-amber-300/90 mb-1.5 rounded bg-amber-500/10 border border-amber-500/25 px-2 py-1 leading-snug">
              Live CNEOS temporarily unreachable
              {list.degradedReason ? ` (${list.degradedReason})` : ""}. Showing
              a small educational sample — not live risk data.
            </p>
          )}

          <p className="text-[10px] text-gray-500 mb-1.5">
            Sorted by Palermo scale (PS) · Torino usually 0 ·{" "}
            <span
              className="underline decoration-dotted cursor-help"
              title="Palermo Scale compares impact risk to the average background risk from the same size objects. Negative values mean less risk than background. Torino Scale is a 0–10 public communication scale; 0 means no hazard."
            >
              what is PS?
            </span>
          </p>

          {error && !list && (
            <p className="text-[11px] text-amber-400/90 mb-1">
              Sentry unavailable — {error.message}
            </p>
          )}

          <ul className="space-y-0.5 max-h-36 overflow-y-auto">
            {(list?.items ?? []).map((item, i) => (
              <Row
                key={item.des}
                item={item}
                rank={i + 1}
                onPick={onPickDes}
              />
            ))}
            {!loading && !error && (list?.items?.length ?? 0) === 0 && (
              <li className="text-xs text-gray-500 px-1">No Sentry objects.</li>
            )}
          </ul>

          <p className="text-[10px] text-gray-600 mt-1.5">
            Source: {list?.source ?? "CNEOS Sentry"} · free · not NeoWs
            approaches
          </p>
        </>
      )}
    </div>
  );
}
