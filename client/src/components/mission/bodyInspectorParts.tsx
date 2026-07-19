import type { ReactNode } from "react";
import type { Asteroid, Planet, SbdbOrbitResult } from "@shared";
import {
  formatApproachDate,
  formatDiameterKm,
  formatMiss,
  formatVelocityKmS,
} from "@shared";

/** Equal-weight source chips (not active/inactive modes). */
export function SourceChip({
  source,
  active = true,
}: {
  source: "neows" | "sbdb" | "approx" | "mock";
  active?: boolean;
}) {
  const styles = {
    neows: "bg-sky-500/20 text-sky-200 border-sky-400/40",
    sbdb: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
    approx: "bg-amber-500/15 text-amber-200/90 border-amber-400/30",
    mock: "bg-violet-500/15 text-violet-200/90 border-violet-400/30",
  } as const;
  const labels = {
    neows: "NeoWs",
    sbdb: "SBDB",
    approx: "Approx",
    mock: "Mock",
  } as const;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase border ${styles[source]} ${
        active ? "" : "opacity-50"
      }`}
    >
      {labels[source]}
    </span>
  );
}

export function SectionHead({
  title,
  source,
  extra,
}: {
  title: string;
  source: "neows" | "sbdb" | "approx" | "mock";
  extra?: ReactNode;
}) {
  const bar =
    source === "neows"
      ? "border-sky-500/35"
      : source === "sbdb"
        ? "border-emerald-500/35"
        : source === "mock"
          ? "border-violet-500/30"
          : "border-amber-500/30";
  const titleColor =
    source === "neows"
      ? "text-sky-300/95"
      : source === "sbdb"
        ? "text-emerald-300/95"
        : source === "mock"
          ? "text-violet-300/90"
          : "text-amber-300/90";

  return (
    <div
      className={`flex items-center justify-between gap-2 mb-1.5 border-l-2 pl-2 ${bar}`}
    >
      <h6
        className={`text-[10px] uppercase tracking-widest font-semibold ${titleColor}`}
      >
        {title}
      </h6>
      <div className="flex items-center gap-1 shrink-0">
        <SourceChip source={source} />
        {extra}
      </div>
    </div>
  );
}

export function AsteroidBrief({
  a,
  sbdb,
  sbdbLoading,
  sbdbError,
}: {
  a: Asteroid;
  sbdb?: SbdbOrbitResult | null;
  sbdbLoading?: boolean;
  sbdbError?: Error | null;
}) {
  const approach = a.approach;
  const diam = formatDiameterKm(a.diameterKmMin, a.diameterKmMax, a.size);
  const fromSbdb = a.orbitSource === "sbdb" || Boolean(sbdb?.found);
  const e = fromSbdb && sbdb?.e != null ? sbdb.e : a.orbit.eccentricity;
  const iDeg =
    fromSbdb && sbdb?.iDeg != null
      ? sbdb.iDeg
      : (a.orbit.inclination * 180) / Math.PI;
  const pYr =
    fromSbdb && sbdb?.periodYears != null
      ? sbdb.periodYears
      : a.orbit.periodYears;
  const aAu = sbdb?.found ? sbdb.aAu : undefined;

  const orbitSourceChip: "sbdb" | "approx" | "mock" = fromSbdb
    ? "sbdb"
    : a.orbitSource === "mock"
      ? "mock"
      : "approx";

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {a.isHazardous && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-red-500/20 text-red-300 border border-red-400/35">
            PHA
          </span>
        )}
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
          Sources
        </span>
        <SourceChip source="neows" />
        <SourceChip source="sbdb" active={fromSbdb || sbdbLoading} />
      </div>
      <p className="text-[10px] text-gray-500 leading-snug -mt-1">
        <span className="text-sky-400/90">NeoWs</span> = approach & size ·{" "}
        <span className="text-emerald-400/90">SBDB</span> = orbit elements
      </p>

      <section className="rounded-md bg-sky-950/25 border border-sky-500/15 p-2">
        <SectionHead title="Approach & size" source="neows" />
        {approach ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-gray-300">
            <dt className="text-gray-500">Date</dt>
            <dd className="text-right tabular-nums text-gray-100">
              {formatApproachDate(approach.dateIso)}
            </dd>
            <dt className="text-gray-500">Miss</dt>
            <dd className="text-right tabular-nums text-gray-100">
              {formatMiss(approach.missLd, approach.missKm)}
            </dd>
            <dt className="text-gray-500">Velocity</dt>
            <dd className="text-right tabular-nums text-gray-100">
              {formatVelocityKmS(approach.relativeVelocityKmS)} rel.
            </dd>
            {approach.orbitingBody && (
              <>
                <dt className="text-gray-500">Body</dt>
                <dd className="text-right text-gray-100">
                  {approach.orbitingBody}
                </dd>
              </>
            )}
            <dt className="text-gray-500">Diameter</dt>
            <dd className="text-right tabular-nums text-gray-100">{diam}</dd>
          </dl>
        ) : (
          <div className="space-y-1">
            <p className="text-gray-500">No approach metrics on this record.</p>
            <p className="text-gray-300 tabular-nums">
              <span className="text-gray-500">Diameter · </span>
              {diam}
            </p>
          </div>
        )}
        <p className="text-[10px] text-sky-500/70 mt-1.5">
          NASA NeoWs feed (close-approach window)
        </p>
      </section>

      <section
        className={`rounded-md border p-2 ${
          fromSbdb
            ? "bg-emerald-950/25 border-emerald-500/15"
            : "bg-amber-950/20 border-amber-500/15"
        }`}
      >
        <SectionHead
          title="Orbit"
          source={orbitSourceChip}
          extra={
            sbdbLoading ? (
              <span className="text-[10px] text-amber-300/90 animate-pulse">
                loading…
              </span>
            ) : null
          }
        />
        {fromSbdb ? (
          <>
            {sbdb?.orbitClass && (
              <p className="text-gray-400 mb-1">
                Class ·{" "}
                <span className="text-emerald-100/90">{sbdb.orbitClass}</span>
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-gray-300">
              {aAu != null && (
                <>
                  <dt className="text-gray-500">a</dt>
                  <dd className="text-right tabular-nums text-gray-100">
                    {aAu.toFixed(3)} au
                  </dd>
                </>
              )}
              <dt className="text-gray-500">e</dt>
              <dd className="text-right tabular-nums text-gray-100">
                {e.toFixed(4)}
              </dd>
              <dt className="text-gray-500">i</dt>
              <dd className="text-right tabular-nums text-gray-100">
                {iDeg.toFixed(2)}°
              </dd>
              <dt className="text-gray-500">Period</dt>
              <dd className="text-right tabular-nums text-gray-100">
                {pYr.toFixed(2)} yr
              </dd>
              {sbdb?.moidAu != null && Number.isFinite(sbdb.moidAu) && (
                <>
                  <dt className="text-gray-500">MOID</dt>
                  <dd className="text-right tabular-nums text-gray-100">
                    {sbdb.moidAu.toFixed(4)} au
                  </dd>
                </>
              )}
            </dl>
            <p className="text-[10px] text-emerald-500/70 mt-1.5">
              JPL Small-Body DataBase · scene path uses these elements
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-400 leading-relaxed mb-1">
              {a.orbitSource === "mock"
                ? "Mock catalog orbit (local demo data)."
                : "Approx placement from miss distance — not SBDB."}
            </p>
            <p className="text-[10px] text-gray-500 tabular-nums">
              e={e.toFixed(3)} · i={iDeg.toFixed(1)}° · P={pYr.toFixed(2)} yr
            </p>
            {sbdbLoading && (
              <p className="text-[10px] text-amber-300/90 mt-1.5">
                Fetching JPL SBDB elements…
              </p>
            )}
            {sbdbError && (
              <p className="text-[10px] text-amber-400/90 mt-1.5">
                SBDB unavailable — keeping approx orbit
              </p>
            )}
            {sbdb && !sbdb.found && !sbdbLoading && (
              <p className="text-[10px] text-gray-500 mt-1.5">
                {sbdb.message ?? "Not found in SBDB"} — NeoWs approach still
                valid
              </p>
            )}
            {!sbdbLoading &&
              !sbdbError &&
              !sbdb &&
              a.orbitSource !== "mock" && (
                <p className="text-[10px] text-amber-500/70 mt-1.5">
                  Waiting for SBDB lookup…
                </p>
              )}
          </>
        )}
      </section>

      <p className="text-[10px] text-gray-600 leading-snug">
        {a.designation || sbdb?.designation
          ? `id · ${sbdb?.designation ?? a.designation}`
          : null}
      </p>
    </div>
  );
}

export function ActionBar({
  isAsteroidItem,
  onToggleCompare,
  isInCompare,
  compareCount = 0,
  onCopyLink,
  copyLinkStatus = "idle",
  onClearCompare,
}: {
  isAsteroidItem: boolean;
  onToggleCompare?: () => void;
  isInCompare?: boolean;
  compareCount?: number;
  onCopyLink?: () => void;
  copyLinkStatus?: "idle" | "copied" | "failed";
  onClearCompare?: () => void;
}) {
  // Export summary removed — Copy link covers share; plain-text export was
  // unreliable on some browsers and low-value for portfolio demos.
  if (!onToggleCompare && !onCopyLink) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {isAsteroidItem && onToggleCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors ${
              isInCompare
                ? "bg-sky-500/20 text-sky-100 border-sky-400/40"
                : "bg-white/5 text-gray-200 border-white/10 hover:bg-white/10"
            }`}
            title={
              isInCompare
                ? "Remove from compare"
                : compareCount >= 2
                  ? "Replace second compare slot"
                  : "Add orbit to compare (max 2)"
            }
          >
            {isInCompare ? "− Compare" : "+ Compare"}
          </button>
        )}
        {onCopyLink && (
          <button
            type="button"
            onClick={onCopyLink}
            className="text-[11px] font-semibold px-2 py-1 rounded-md border bg-white/5 text-gray-200 border-white/10 hover:bg-white/10"
            title="Copy a shareable URL for this briefing"
          >
            {copyLinkStatus === "copied"
              ? "Link copied"
              : copyLinkStatus === "failed"
                ? "Copy failed"
                : "Copy link"}
          </button>
        )}
        {compareCount > 0 && onClearCompare && (
          <button
            type="button"
            onClick={onClearCompare}
            className="text-[11px] font-semibold px-2 py-1 rounded-md border text-gray-400 border-white/10 hover:text-gray-200"
          >
            Clear compare ({compareCount})
          </button>
        )}
      </div>
      {compareCount > 0 && (
        <p className="text-[10px] text-gray-500">
          {isInCompare
            ? "In compare set · scene orbit tinted to match A/B"
            : "Compare card above shows miss & size deltas"}
        </p>
      )}
    </div>
  );
}

export function PlanetBrief({ p }: { p: Planet }) {
  return (
    <div className="space-y-2 text-xs text-gray-300">
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-gray-500">Radius</dt>
        <dd className="text-right tabular-nums">{p.earthRadii.toFixed(2)} R⊕</dd>
        <dt className="text-gray-500">Period</dt>
        <dd className="text-right tabular-nums">{p.period.toFixed(2)} yr</dd>
        <dt className="text-gray-500">e / i</dt>
        <dd className="text-right tabular-nums">
          {p.orbit.eccentricity.toFixed(3)} ·{" "}
          {((p.orbit.inclination * 180) / Math.PI).toFixed(1)}°
        </dd>
      </dl>
      <p className="text-[10px] text-gray-600 leading-snug border-t border-white/5 pt-2">
        Mean elements for visualization — not navigation-grade ephemerides
      </p>
    </div>
  );
}
