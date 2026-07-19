import type { CelestialItem, SbdbOrbitResult } from "@shared";
import { isAsteroid, isPlanet } from "@shared";
import {
  ActionBar,
  AsteroidBrief,
  PlanetBrief,
} from "./bodyInspectorParts";

type BodyInspectorProps = {
  item: CelestialItem;
  onClear: () => void;
  /** Compact embed inside LiveNeoPanel */
  compact?: boolean;
  /** P3 — JPL SBDB elements for selected NEO */
  sbdb?: SbdbOrbitResult | null;
  sbdbLoading?: boolean;
  sbdbError?: Error | null;
  /** P4 — compare + share */
  onToggleCompare?: () => void;
  isInCompare?: boolean;
  compareCount?: number;
  onCopyLink?: () => void;
  copyLinkStatus?: "idle" | "copied" | "failed";
  onClearCompare?: () => void;
};

/**
 * Selection briefing — sections colored by data source (NeoWs vs SBDB).
 */
export default function BodyInspector({
  item,
  onClear,
  compact = false,
  sbdb = null,
  sbdbLoading = false,
  sbdbError = null,
  onToggleCompare,
  isInCompare = false,
  compareCount = 0,
  onCopyLink,
  copyLinkStatus = "idle",
  onClearCompare,
}: BodyInspectorProps) {
  const title =
    (isAsteroid(item) && sbdb?.found && sbdb.fullname) || item.name;

  return (
    <div
      className={
        compact
          ? "rounded-lg bg-black/40 border border-white/5 p-2.5"
          : "rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl p-3.5"
      }
      role="region"
      aria-label={`Inspect ${item.name}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300/90 font-semibold">
            Inspect
          </p>
          <h5
            className="font-semibold text-white text-sm truncate"
            title={title}
          >
            {title}
          </h5>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-xs font-semibold text-sky-300 hover:text-sky-200 px-1"
          aria-label="Clear selection and return to system view"
          title="Close · return to free system view"
        >
          ×
        </button>
      </div>

      {isAsteroid(item) && (
        <AsteroidBrief
          a={item}
          sbdb={sbdb}
          sbdbLoading={sbdbLoading}
          sbdbError={sbdbError}
        />
      )}
      {isPlanet(item) && <PlanetBrief p={item} />}

      <ActionBar
        isAsteroidItem={isAsteroid(item)}
        onToggleCompare={onToggleCompare}
        isInCompare={isInCompare}
        compareCount={compareCount}
        onCopyLink={onCopyLink}
        copyLinkStatus={copyLinkStatus}
        onClearCompare={onClearCompare}
      />
    </div>
  );
}
