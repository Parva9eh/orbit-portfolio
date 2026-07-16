import { useEffect, useState } from "react";
import type { IssPosition } from "@shared";
import {
  formatIssSampleAge,
  formatIssVelocityDisplay,
  formatIssVisibility,
} from "@shared";

type IssBriefingProps = {
  iss: IssPosition;
};

/**
 * Educational ISS telemetry card — altitude, velocity, daylight/shadow,
 * footprint, ground context, TLE inclination, sample age.
 */
export default function IssBriefing({ iss }: IssBriefingProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

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

  return (
    <div
      className="ml-6 mb-2 rounded-md border border-sky-500/20 bg-sky-950/25 p-2 space-y-1.5"
      aria-label="ISS telemetry"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-sky-300/90 font-semibold">
          ISS telemetry
        </p>
        <span className="text-[10px] text-gray-500 tabular-nums">
          {formatIssSampleAge(iss.timestampMs, now)} · {iss.source}
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-gray-300">
        <dt className="text-gray-500">Lat / lon</dt>
        <dd className="text-right tabular-nums text-sky-100/90">
          {iss.lat.toFixed(2)}° · {iss.lon.toFixed(2)}°
        </dd>
        <dt className="text-gray-500">Altitude</dt>
        <dd className="text-right tabular-nums">
          {iss.altKm != null ? `${Math.round(iss.altKm)} km` : "—"}
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
            <dd className="text-right text-[10px] text-gray-400 truncate" title={groundBits.join(" · ")}>
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
        {iss.trail.length > 0 && (
          <>
            <dt className="text-gray-500">Trail</dt>
            <dd className="text-right tabular-nums text-gray-400">
              {iss.trail.length} pts · ~{Math.round((iss.trail.length * 2))} min
            </dd>
          </>
        )}
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
        Live track is schematic LEO; telemetry is free public ISS data (not
        navigation-grade).
      </p>
    </div>
  );
}
