import type { CelestialItem } from "@shared";
import { formatRulerDistance, isAsteroid } from "@shared";

export type RulerEndpoint =
  | { kind: "body"; id: string; name: string }
  | { kind: "sun"; name: "Sun" };

type DistanceRulerProps = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  pointA: RulerEndpoint | null;
  pointB: RulerEndpoint | null;
  /** Live scene separation (null until both ends have positions) */
  sceneDist: number | null;
  /** Prefer NeoWs miss when A/B is NEO↔Earth */
  approachMissLabel?: string | null;
  onClear: () => void;
  onMeasureVsEarth: () => void;
  onMeasureVsSun: () => void;
  selected: CelestialItem | null;
};

/**
 * P6 — distance ruler controls + readout (scene line drawn in ThreeDScene).
 * Header stays compact; body only expands when enabled.
 */
export default function DistanceRuler({
  enabled,
  onEnabledChange,
  pointA,
  pointB,
  sceneDist,
  approachMissLabel,
  onClear,
  onMeasureVsEarth,
  onMeasureVsSun,
  selected,
}: DistanceRulerProps) {
  const readout =
    sceneDist != null ? formatRulerDistance(sceneDist) : null;

  return (
    <div
      className="mb-2 rounded-lg border border-violet-500/25 bg-violet-950/20 overflow-hidden"
      role="region"
      aria-label="Distance ruler"
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-violet-300/95 font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-400"
          />
          Distance ruler
        </label>
        {(pointA || pointB) && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {enabled && (
        <div className="px-2 pb-2">
          <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">
            Click two bodies in the scene (or use presets). Scale is
            visualization-compressed — AU is approximate.
          </p>
          <div className="flex flex-wrap gap-1 mb-1.5">
            <button
              type="button"
              disabled={!selected || !isAsteroid(selected)}
              onClick={onMeasureVsEarth}
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-gray-200 disabled:opacity-40"
            >
              Selected → Earth
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={onMeasureVsSun}
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-gray-200 disabled:opacity-40"
            >
              Selected → Sun
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
            <dt className="text-gray-500">A</dt>
            <dd className="text-right text-violet-100 truncate">
              {pointA?.name ?? "— click body"}
            </dd>
            <dt className="text-gray-500">B</dt>
            <dd className="text-right text-violet-100 truncate">
              {pointB?.name ?? "— click body"}
            </dd>
            <dt className="text-gray-500">Scene</dt>
            <dd className="text-right tabular-nums text-gray-100">
              {readout?.label ?? "—"}
            </dd>
          </dl>
          {approachMissLabel && (
            <p className="text-[10px] text-sky-300/85 mt-1.5">
              NeoWs miss (Earth–NEO): {approachMissLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
