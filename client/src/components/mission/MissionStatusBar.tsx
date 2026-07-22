import type { CelestialItem, IssPosition } from "@shared";
import {
  formatEarthRelativeLine,
  formatIssSampleAge,
  formatIssVisibility,
  formatMiss,
  formatVelocityKmS,
  isAsteroid,
} from "@shared";
import type { ViewMode } from "./MissionTopBar";
import type { DonkiSolarBadge } from "../../hooks/useDonkiSolar";

type MissionStatusBarProps = {
  loading: boolean;
  /** True after loading exceeds cold-start threshold */
  waking?: boolean;
  error: Error | null;
  mode: ViewMode;
  selectedItem?: CelestialItem | null;
  iss?: IssPosition | null;
  showIss?: boolean;
  issFocus?: boolean;
  solar?: DonkiSolarBadge | null;
  rulerLabel?: string | null;
};

export default function MissionStatusBar({
  loading,
  waking = false,
  error,
  mode,
  selectedItem = null,
  iss = null,
  showIss = false,
  issFocus = false,
  solar = null,
  rulerLabel = null,
}: MissionStatusBarProps) {
  const neo = selectedItem && isAsteroid(selectedItem) ? selectedItem : null;
  const approach = neo?.approach;

  const statusText = error
    ? `Signal degraded · ${error.message || "API error"}`
    : loading && waking
      ? "Waking free-tier API (~20–60s on first hit)…"
      : loading
        ? "Receiving telemetry…"
        : "Systems nominal";

  return (
    <footer className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 safe-pad-x safe-pad-b bg-black/90 border-t border-white/10 text-xs text-gray-400">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            error
              ? "bg-red-400 shadow-[0_0_6px_#f87171]"
              : loading
                ? "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse"
                : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
          }`}
          aria-hidden
        />
        <span className="truncate" aria-live="polite">
          {statusText}
        </span>
      </div>

      <div className="min-w-0 flex-1 flex justify-center px-2">
        {rulerLabel ? (
          <p className="truncate text-center text-violet-200/90 tabular-nums tracking-wide">
            <span className="text-gray-500 font-normal">Ruler · </span>
            {rulerLabel}
          </p>
        ) : approach ? (
          <p
            className="truncate text-center text-sky-200/90 tabular-nums font-medium tracking-wide"
            title={formatEarthRelativeLine(approach)}
          >
            <span className="text-gray-500 font-normal hidden sm:inline">
              Earth-rel ·{" "}
            </span>
            miss {formatMiss(approach.missLd, approach.missKm)}
            {approach.relativeVelocityKmS > 0 && (
              <>
                {" · "}
                {formatVelocityKmS(approach.relativeVelocityKmS)}
              </>
            )}
            {neo?.isHazardous && (
              <span className="ml-1.5 text-red-300/90 font-semibold">PHA</span>
            )}
          </p>
        ) : showIss && iss && iss.source === "mock" ? (
          <p className="truncate text-center text-amber-200/80 tracking-wide animate-pulse">
            <span className="text-gray-500 font-normal">
              {issFocus ? "ISS focus · " : "ISS · "}
            </span>
            Acquiring live telemetry…
          </p>
        ) : showIss && iss ? (
          <p
            className="truncate text-center text-sky-300/90 tabular-nums tracking-wide"
            title={[
              formatIssVisibility(iss.visibility),
              iss.velocityKmS != null
                ? `${iss.velocityKmS.toFixed(2)} km/s`
                : null,
              iss.ground?.timezoneId,
              formatIssSampleAge(iss.timestampMs),
              iss.source,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <span className="text-gray-500 font-normal">
              {issFocus ? "ISS focus · " : "ISS · "}
            </span>
            {iss.lat.toFixed(2)}° · {iss.lon.toFixed(2)}°
            {iss.altKm != null && <> · {Math.round(iss.altKm)} km</>}
            {iss.visibility !== "unknown" && (
              <span className="hidden md:inline text-sky-200/80">
                {" "}
                · {formatIssVisibility(iss.visibility)}
              </span>
            )}
            {iss.velocityKmS != null && (
              <span className="hidden lg:inline text-gray-400">
                {" "}
                · {iss.velocityKmS.toFixed(2)} km/s
              </span>
            )}
          </p>
        ) : (
          <p className="truncate text-center text-gray-500 hidden md:block">
            {mode === "live"
              ? "Select a NEO · enable ISS or Sentry for live layers"
              : "Mission steps · Story / Live NEO"}
          </p>
        )}
      </div>

      <div className="hidden sm:flex shrink-0 max-w-[32%] items-center justify-end gap-2 truncate text-right">
        {solar && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border tabular-nums ${
              solar.level === "storm"
                ? "border-red-400/40 text-red-200 bg-red-500/15"
                : solar.level === "elevated"
                  ? "border-amber-400/40 text-amber-200 bg-amber-500/15"
                  : "border-white/10 text-gray-500 bg-white/5"
            }`}
            title={solar.detail}
          >
            {solar.label}
          </span>
        )}
        <span className="text-gray-500 truncate">
          {neo
            ? neo.name
            : mode === "live"
              ? "Live NEO"
              : "Story mode"}
        </span>
      </div>
    </footer>
  );
}
