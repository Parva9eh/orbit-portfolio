import type { Dispatch } from "react";
import type { IssPosition } from "@shared";
import type { LiveMissionAction, LiveMissionState } from "../../mission/liveMissionState";
import IssBriefing from "./IssBriefing";

type LiveNeoLayerControlsProps = {
  live: LiveMissionState;
  dispatchLive: Dispatch<LiveMissionAction>;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showHazardous: boolean;
  onHazardousChange: (v: boolean) => void;
  iss: IssPosition | null;
  /** False while only local seed is shown */
  issLive?: boolean;
  issAcquiring?: boolean;
  onShowIssChange: (v: boolean) => void;
  onIssFocusChange: (v: boolean) => void;
  onShowSentryChange: (v: boolean) => void;
};

/**
 * Search, miss/size filters, layer toggles (planets, ISS, Sentry).
 */
export default function LiveNeoLayerControls({
  live,
  dispatchLive,
  searchTerm,
  onSearchChange,
  showHazardous,
  onHazardousChange,
  iss,
  issLive = false,
  issAcquiring = false,
  onShowIssChange,
  onIssFocusChange,
  onShowSentryChange,
}: LiveNeoLayerControlsProps) {
  const {
    showPlanets,
    showIss,
    issFocus,
    showSentry,
    maxMissLd,
    minDiameterM,
  } = live;

  return (
    <>
      <input
        type="text"
        placeholder="Filter list by name…"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full mb-2 px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-500"
        aria-label="Filter asteroids by name"
      />

      <div className="flex flex-wrap gap-1.5 mb-2">
        <select
          value={maxMissLd ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            dispatchLive({
              type: "SET_MAX_MISS_LD",
              value: v === "" ? null : Number(v),
            });
          }}
          className="text-[10px] px-1.5 py-1 rounded border border-white/10 bg-[#0c121c] text-gray-300"
          aria-label="Max miss distance filter"
        >
          <option value="">Miss: any</option>
          <option value="1">Miss &lt; 1 LD</option>
          <option value="5">Miss &lt; 5 LD</option>
          <option value="20">Miss &lt; 20 LD</option>
        </select>
        <select
          value={minDiameterM ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            dispatchLive({
              type: "SET_MIN_DIAMETER_M",
              value: v === "" ? null : Number(v),
            });
          }}
          className="text-[10px] px-1.5 py-1 rounded border border-white/10 bg-[#0c121c] text-gray-300"
          aria-label="Min diameter filter"
        >
          <option value="">Size: any</option>
          <option value="50">≥ 50 m</option>
          <option value="140">≥ 140 m</option>
          <option value="1000">≥ 1 km</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300 mb-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={showHazardous}
          onChange={(e) => onHazardousChange(e.target.checked)}
          className="h-4 w-4 accent-custom-blue"
        />
        Hazardous only
      </label>

      <label
        className="flex items-center gap-2 text-sm text-gray-300 mb-1.5 cursor-pointer"
        title="Hides other planets and orbital paths. Earth and Moon stay for Near-Earth context."
      >
        <input
          type="checkbox"
          checked={showPlanets}
          onChange={(e) =>
            dispatchLive({
              type: "SET_SHOW_PLANETS",
              value: e.target.checked,
            })
          }
          className="h-4 w-4 accent-custom-blue"
        />
        Other planets & orbits
      </label>

      <div className="mb-2 space-y-1">
        <label
          className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
          title="Live ISS in Near-Earth (schematic LEO). Broad neighborhood view."
        >
          <input
            type="checkbox"
            checked={showIss}
            onChange={(e) => onShowIssChange(e.target.checked)}
            className="h-4 w-4 accent-sky-400"
          />
          Show ISS
          {showIss && issAcquiring && (
            <span className="text-[10px] text-amber-300/90 font-normal animate-pulse">
              acquiring…
            </span>
          )}
          {showIss && issLive && iss && (
            <span className="text-[10px] text-sky-400/90 tabular-nums font-normal">
              {iss.lat.toFixed(1)}° · {iss.lon.toFixed(1)}°
              {iss.altKm != null ? ` · ${Math.round(iss.altKm)} km` : ""}
            </span>
          )}
        </label>
        {showIss && (
          <label
            className="flex items-center gap-2 text-sm text-sky-200/90 cursor-pointer ml-6"
            title="Camera frames Earth only — larger ISS, LEO ring, NEOs hidden"
          >
            <input
              type="checkbox"
              checked={issFocus}
              onChange={(e) => onIssFocusChange(e.target.checked)}
              className="h-4 w-4 accent-sky-300"
            />
            Focus ISS (Earth only)
          </label>
        )}
        {issFocus && (
          <p className="text-[10px] text-sky-400/70 ml-6 leading-snug">
            Tight orbit of Earth · schematic LEO ring · station enlarged
          </p>
        )}
        {showIss && iss && (
          <IssBriefing iss={iss} acquiring={issAcquiring || !issLive} />
        )}
      </div>

      <label
        className="flex items-center gap-2 text-sm text-gray-300 mb-2.5 cursor-pointer"
        title="CNEOS Sentry educational watchlist — not an impact alarm"
      >
        <input
          type="checkbox"
          checked={showSentry}
          onChange={(e) => onShowSentryChange(e.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
        Sentry watchlist
      </label>
    </>
  );
}
