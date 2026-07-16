import type { Asteroid, CelestialItem } from "@shared";
import { formatMiss } from "@shared";
import { COMPARE_COLORS } from "../../lib/urlState";

type NeoMissListProps = {
  asteroids: Asteroid[];
  loading: boolean;
  selectedItem: CelestialItem | null;
  compareIds: string[];
  onSelectItem: (item: CelestialItem) => void;
};

/**
 * Paginated catalog rows sorted by miss distance (list body only).
 */
export default function NeoMissList({
  asteroids,
  loading,
  selectedItem,
  compareIds,
  onSelectItem,
}: NeoMissListProps) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
        By miss distance
      </p>
      <ul
        className={`space-y-1 max-h-32 overflow-y-auto ${loading ? "opacity-50" : ""}`}
      >
        {asteroids.map((neo, index) => {
          const miss = neo.approach
            ? formatMiss(neo.approach.missLd, neo.approach.missKm, {
                compact: true,
              })
            : null;
          const cmpIdx = compareIds.indexOf(neo.id);
          return (
            <li key={neo.id}>
              <button
                type="button"
                onClick={() => onSelectItem(neo)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md bg-black/30 hover:bg-custom-blue/20 text-gray-200 flex items-center justify-between gap-2 ${
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
                    {index + 1}.
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
        {!loading && asteroids.length === 0 && (
          <li className="text-xs text-gray-500 px-1">
            No approaches for this day (or page).
          </li>
        )}
      </ul>
    </>
  );
}
