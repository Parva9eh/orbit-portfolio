import { useEffect, useState } from "react";
import type { IssPosition } from "@shared";
import {
  formatIssSampleAge,
  formatIssVelocityDisplay,
  formatIssVisibility,
} from "@shared";

type IssBriefingProps = {
  iss: IssPosition;
  /** True while only the local seed is available (before first live sample) */
  acquiring?: boolean;
  /** Start with one-line summary; expand for full telemetry */
  defaultCollapsed?: boolean;
};

/**
 * Educational ISS telemetry card — altitude, velocity, daylight/shadow,
 * footprint, ground context, TLE inclination, sample age.
 */
export default function IssBriefing({
  iss,
  acquiring = false,
  defaultCollapsed = false,
}: IssBriefingProps) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(!defaultCollapsed);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const isMock = iss.source === "mock" || acquiring;

  if (isMock) {
    return (
      <div
        className="mt-1.5 rounded-md border border-sky-500/20 bg-sky-950/25 p-2 space-y-1.5"
        aria-label="ISS telemetry acquiring"
        aria-busy="true"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-sky-300/90 font-semibold">
            ISS telemetry
          </p>
          <span className="text-[10px] text-amber-300/90 animate-pulse">
            acquiring…
          </span>
        </div>
        <p className="text-[11px] text-gray-400 leading-snug">
          LEO ring ready — waiting for live telemetry (can take 10–20s).
        </p>
        <div className="h-1.5 rounded-full bg-sky-950/80 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-sky-400/50 animate-pulse" />
        </div>
      </div>
    );
  }

  const vis = formatIssVisibility(iss.visibility);
  const visClass =
    iss.visibility === "daylight"
      ? "text-amber-200/90"
      : iss.visibility === "eclipsed"
        ? "text-indigo-200/90"
        : "text-gray-400";

  const groundBits = [
    iss.ground?.countryCode && iss.ground.countryCode !== "??"
      ? iss.ground.countryCode
      : null,
    iss.ground?.timezoneId,
    iss.ground?.offsetHours != null
      ? `UTC${iss.ground.offsetHours >= 0 ? "+" : ""}${iss.ground.offsetHours}`
      : null,
  ].filter(Boolean);

  const oneLine = [
    `${iss.lat.toFixed(1)}° · ${iss.lon.toFixed(1)}°`,
    iss.altKm != null ? `${Math.round(iss.altKm)} km` : null,
    vis !== "Visibility n/a" ? vis : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="mt-1.5 rounded-md border border-sky-500/20 bg-sky-950/25 overflow-hidden"
      aria-label="ISS telemetry"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-sky-500/10"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-wider text-sky-300/90 font-semibold shrink-0">
          ISS
        </span>
        <span className="text-[10px] text-sky-100/85 tabular-nums truncate min-w-0">
          {oneLine}
        </span>
        <span className="text-[10px] text-cyan-400/80 shrink-0">
          {open ? "Less" : "More"}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-sky-500/15">
          <div className="flex justify-end pt-1">
            <span className="text-[10px] text-gray-500 tabular-nums">
              {formatIssSampleAge(iss.timestampMs, now)} · {iss.source}
            </span>
          </div>

          {iss.source === "open-notify" && (
            <p className="text-[10px] text-amber-200/85 leading-snug border border-amber-500/20 rounded px-1.5 py-1 bg-amber-950/20">
              Sparse fallback (Open Notify) — lat/lon only. Rich fields need
              Where The ISS At.
            </p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-gray-300">
            <dt className="text-gray-500">Lat / lon</dt>
            <dd className="text-right tabular-nums text-sky-100/90">
              {iss.lat.toFixed(2)}° · {iss.lon.toFixed(2)}°
            </dd>
            <dt className="text-gray-500">Altitude</dt>
            <dd className="text-right tabular-nums">
              {iss.altKm != null
                ? `${Math.round(iss.altKm)} km`
                : iss.source === "open-notify"
                  ? "~420 km typical"
                  : "—"}
            </dd>
            <dt className="text-gray-500">Velocity</dt>
            <dd className="text-right tabular-nums text-[10px]">
              {formatIssVelocityDisplay(iss.velocityKmS)}
            </dd>
            <dt className="text-gray-500">Sun</dt>
            <dd className={`text-right ${visClass}`}>{vis}</dd>
            {iss.footprintKm != null && (
              <>
                <dt className="text-gray-500">Footprint</dt>
                <dd className="text-right tabular-nums">
                  ~{Math.round(iss.footprintKm).toLocaleString("en-US")} km
                </dd>
              </>
            )}
            {groundBits.length > 0 && (
              <>
                <dt className="text-gray-500">Ground</dt>
                <dd
                  className="text-right text-[10px] text-gray-400 truncate"
                  title={groundBits.join(" · ")}
                >
                  {groundBits.join(" · ")}
                </dd>
              </>
            )}
            {iss.tle?.inclinationDeg != null && (
              <>
                <dt className="text-gray-500">TLE i</dt>
                <dd className="text-right tabular-nums">
                  {iss.tle.inclinationDeg.toFixed(2)}°
                  <span className="text-gray-600"> · ZARYA</span>
                </dd>
              </>
            )}
            {iss.trail.length > 0 ? (
              <>
                <dt className="text-gray-500">Trail</dt>
                <dd className="text-right tabular-nums text-gray-400">
                  {iss.trail.length} pts · ~{Math.round(iss.trail.length * 2)} min
                </dd>
              </>
            ) : iss.source === "wheretheiss.at" ? (
              <>
                <dt className="text-gray-500">Trail</dt>
                <dd className="text-right text-[10px] text-gray-600">
                  loading next poll…
                </dd>
              </>
            ) : null}
          </dl>

          {iss.tle && (
            <details className="text-[10px] text-gray-500">
              <summary className="cursor-pointer text-sky-400/80 hover:text-sky-300">
                TLE (educational)
              </summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[9px] text-gray-500 leading-snug font-mono">
                {iss.tle.header}
                {"\n"}
                {iss.tle.line1}
                {"\n"}
                {iss.tle.line2}
              </pre>
            </details>
          )}

          <p className="text-[9px] text-gray-600 leading-snug">
            Schematic LEO track · free public ISS data (not navigation-grade).
          </p>
        </div>
      )}
    </div>
  );
}
