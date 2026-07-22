import type { Asteroid, CelestialItem } from "@shared";
import { formatMiss } from "@shared";
import { COMPARE_COLORS } from "../../lib/urlState";

type NeoMissListProps = {
  asteroids: Asteroid[];
  loading: boolean;
  /** Global 1-based index of the first row (e.g. (page-1)*limit + 1) */
  startIndex?: number;
  /** Slow first load (API cold start) */
  waking?: boolean;
  /** Catalog fetch failed */
  error?: Error | null;
  selectedItem: CelestialItem | null;
  compareIds: string[];
  onSelectItem: (item: CelestialItem) => void;
  onRetry?: () => void;
  onUseDemo?: () => void;
  /** True when empty because client filters hid the page */
  filtersActive?: boolean;
  onClearFilters?: () => void;
};

/**
 * Paginated catalog rows sorted by miss distance (list body only).
 */
export default function NeoMissList({
  asteroids,
  loading,
  startIndex = 1,
  waking = false,
  error = null,
  selectedItem,
  compareIds,
  onSelectItem,
  onRetry,
  onUseDemo,
  filtersActive = false,
  onClearFilters,
}: NeoMissListProps) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
        By miss distance
      </p>
      <ul
        className={`space-y-1 max-h-44 sm:max-h-52 overflow-y-auto overscroll-contain ${loading ? "opacity-50" : ""}`}
        aria-busy={loading}
      >
        {asteroids.map((neo, index) => {
          const miss = neo.approach
            ? formatMiss(neo.approach.missLd, neo.approach.missKm, {
                compact: true,
              })
            : null;
          const cmpIdx = compareIds.indexOf(neo.id);
          const globalIndex = startIndex + index;
          return (
            <li key={neo.id}>
              <button
                type="button"
                onClick={() => onSelectItem(neo)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md bg-black/30 hover:bg-custom-blue/20 text-gray-200 flex items-center justify-between gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400 ${
                  selectedItem?.id === neo.id ? "ring-1 ring-sky-400/60" : ""
                } ${
                  cmpIdx === 0
                    ? "ring-1 ring-sky-400/40"
                    : cmpIdx === 1
                      ? "ring-1 ring-amber-400/40"
                      : ""
                }`}
              >
                <span className="truncate min-w-0">
                  <span className="text-gray-600 tabular-nums mr-1.5">
                    {globalIndex}.
                  </span>
                  {neo.name}
                  {neo.isHazardous && (
                    <span
                      className="text-red-400 ml-1"
                      title="Potentially hazardous"
                    >
                      ⚠
                    </span>
                  )}
                  {cmpIdx >= 0 && (
                    <span
                      className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[9px] font-bold text-black"
                      style={{
                        background:
                          cmpIdx === 0 ? COMPARE_COLORS.a : COMPARE_COLORS.b,
                      }}
                    >
                      {cmpIdx === 0 ? "A" : "B"}
                    </span>
                  )}
                </span>
                {miss && (
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {miss}
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {loading && asteroids.length === 0 && (
          <li className="px-1 py-2 space-y-1.5" aria-live="polite">
            {waking ? (
              <>
                <p className="text-xs text-amber-200/90 animate-pulse">
                  Waking free-tier API…
                </p>
                <p className="text-[10px] text-gray-500 leading-snug">
                  First Live hit after idle can take ~20–60s. Demo catalog is
                  available if you need data now.
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-300/80 animate-pulse">
                Receiving NEO catalog…
              </p>
            )}
            {/* Skeleton rows */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-7 rounded-md bg-white/5 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </li>
        )}

        {!loading && error && asteroids.length === 0 && (
          <li className="px-1 py-2 space-y-2" role="alert">
            <p className="text-xs text-red-300/90 leading-snug">
              Catalog unavailable
              {error.message ? ` · ${error.message}` : ""}.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-custom-blue text-white tap-target"
                >
                  Retry
                </button>
              )}
              {onUseDemo && (
                <button
                  type="button"
                  onClick={onUseDemo}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-white/15 text-sky-200 hover:border-sky-400/50 tap-target"
                >
                  Use demo catalog
                </button>
              )}
            </div>
          </li>
        )}

        {!loading && !error && asteroids.length === 0 && (
          <li className="px-1 py-2 space-y-2">
            <p className="text-xs text-gray-500 leading-snug">
              {filtersActive
                ? "No matches on this page for the current filters."
                : "No approaches for this day. Try another date."}
            </p>
            {filtersActive && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-950/40 text-cyan-100 tap-target"
              >
                Clear filters
              </button>
            )}
          </li>
        )}
      </ul>
    </>
  );
}
