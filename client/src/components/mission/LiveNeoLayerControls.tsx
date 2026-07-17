import type { Dispatch } from "react";
import type { IssPosition } from "@shared";
import {
  formatIssSampleAge,
  formatIssVisibility,
} from "@shared";
import type { LiveMissionAction, LiveMissionState } from "../../mission/liveMissionState";
import IssBriefing from "./IssBriefing";

type LiveNeoLayerControlsProps = {
  live: LiveMissionState;
  dispatchLive: Dispatch<LiveMissionAction>;
  iss: IssPosition | null;
  issLive?: boolean;
  issAcquiring?: boolean;
  onShowIssChange: (v: boolean) => void;
  onIssFocusChange: (v: boolean) => void;
  onShowSentryChange: (v: boolean) => void;
};

/**
 * Scene layer toggles: planets, ISS, Sentry (+ compact ISS briefing).
 */
export default function LiveNeoLayerControls({
  live,
  dispatchLive,
  iss,
  issLive = false,
  issAcquiring = false,
  onShowIssChange,
  onIssFocusChange,
  onShowSentryChange,
}: LiveNeoLayerControlsProps) {
  const { showPlanets, showIss, issFocus, showSentry } = live;

  const layerChips = [
    showPlanets ? "Planets" : null,
    showIss ? "ISS" : null,
    showSentry ? "Sentry" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      {layerChips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {layerChips.map((c) => (
            <span
              key={c}
              className="text-[10px] px-1.5 py-0.5 rounded border border-sky-500/25 bg-sky-950/30 text-sky-200/90"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <label
        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
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

      <div className="space-y-1">
        <label
          className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
          title="Live ISS in Near-Earth (schematic LEO)."
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
            <span className="text-[10px] text-sky-400/90 tabular-nums font-normal truncate">
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
            Tight Earth orbit · LEO ring · station enlarged
          </p>
        )}
        {showIss && iss && (
          <IssBriefing
            iss={iss}
            acquiring={issAcquiring || !issLive}
            defaultCollapsed
          />
        )}
      </div>

      <label
        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
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

      {showIss && issLive && iss && (
        <p className="text-[10px] text-gray-600 leading-snug">
          ISS · {formatIssVisibility(iss.visibility)}
          {iss.timestampMs
            ? ` · ${formatIssSampleAge(iss.timestampMs)}`
            : ""}
        </p>
      )}
    </div>
  );
}
