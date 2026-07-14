import { useMemo, useState } from "react";
import type {
  Asteroid,
  CelestialItem,
  IssPosition,
  SbdbOrbitResult,
  SentryDetail,
  SentryWatchItem,
  SentryWatchlist,
} from "@shared";
import { formatMiss, isAsteroid } from "@shared";
import BodyInspector from "./BodyInspector";
import ApproachTimeline from "./ApproachTimeline";
import ComparePanel from "./ComparePanel";
import SentryWatchlistPanel from "./SentryWatchlist";
import SentryBriefing from "./SentryBriefing";
import DistanceRuler, { type RulerEndpoint } from "./DistanceRuler";
import GuidedTours, { type GuidedTourId } from "./GuidedTours";
import { COMPARE_COLORS } from "../../lib/urlState";

type LiveNeoPanelProps = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  dateStart: string;
  onSelectDate: (iso: string) => void;
  showHazardous: boolean;
  onHazardousChange: (value: boolean) => void;
  showPlanets: boolean;
  onPlanetsChange: (value: boolean) => void;
  selectedItem: CelestialItem | null;
  onClearSelection: () => void;
  onSelectItem: (item: CelestialItem) => void;
  /** Already sorted by miss distance (closest first) */
  asteroids: Asteroid[];
  /** Full page catalog for resolving compare slots not in filtered list */
  catalogAsteroids?: Asteroid[];
  closestSummary?: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  sbdb?: SbdbOrbitResult | null;
  sbdbLoading?: boolean;
  sbdbError?: Error | null;
  /** P4 compare */
  compareIds?: string[];
  onToggleCompare?: () => void;
  onClearCompare?: () => void;
  onRemoveCompare?: (id: string) => void;
  onCopyLink?: () => void;
  copyLinkStatus?: "idle" | "copied" | "failed";
  /** P5 ISS + Sentry */
  showIss?: boolean;
  onShowIssChange?: (v: boolean) => void;
  iss?: IssPosition | null;
  issFocus?: boolean;
  onIssFocusChange?: (v: boolean) => void;
  showSentry?: boolean;
  onShowSentryChange?: (v: boolean) => void;
  sentryList?: SentryWatchlist | null;
  sentryLoading?: boolean;
  sentryError?: Error | null;
  onSentryPickDes?: (des: string) => void;
  /** Soft briefing when Sentry object is not on NeoWs page (no browser alert) */
  sentryBriefDes?: string | null;
  sentryBriefSummary?: SentryWatchItem | null;
  sentryDetail?: SentryDetail | null;
  sentryDetailLoading?: boolean;
  sentryDetailError?: string | null;
  onDismissSentryBrief?: () => void;
  onSentryLookupSbdb?: () => void;
  sentrySbdbHint?: string | null;
  /** P6 */
  onExportSummary?: () => void;
  exportStatus?: "idle" | "copied" | "failed";
  maxMissLd?: number | null;
  onMaxMissLdChange?: (v: number | null) => void;
  minDiameterM?: number | null;
  onMinDiameterMChange?: (v: number | null) => void;
  rulerEnabled?: boolean;
  onRulerEnabledChange?: (v: boolean) => void;
  rulerA?: RulerEndpoint | null;
  rulerB?: RulerEndpoint | null;
  rulerSceneDist?: number | null;
  rulerApproachMiss?: string | null;
  onRulerClear?: () => void;
  onRulerVsEarth?: () => void;
  onRulerVsSun?: () => void;
  onGuidedTour?: (id: GuidedTourId) => void;
  /**
   * When true, fills a parent flex rail (desktop right column) instead of
   * absolute overlay placement.
   */
  embedded?: boolean;
};

export default function LiveNeoPanel({
  searchInput,
  onSearchChange,
  dateStart,
  onSelectDate,
  showHazardous,
  onHazardousChange,
  showPlanets,
  onPlanetsChange,
  selectedItem,
  onClearSelection,
  onSelectItem,
  asteroids,
  catalogAsteroids,
  closestSummary = null,
  page,
  totalPages,
  onPageChange,
  loading = false,
  sbdb = null,
  sbdbLoading = false,
  sbdbError = null,
  compareIds = [],
  onToggleCompare,
  onClearCompare,
  onRemoveCompare,
  onCopyLink,
  copyLinkStatus = "idle",
  showIss = false,
  onShowIssChange,
  iss = null,
  issFocus = false,
  onIssFocusChange,
  showSentry = false,
  onShowSentryChange,
  sentryList = null,
  sentryLoading = false,
  sentryError = null,
  onSentryPickDes,
  sentryBriefDes = null,
  sentryBriefSummary = null,
  sentryDetail = null,
  sentryDetailLoading = false,
  sentryDetailError = null,
  onDismissSentryBrief,
  onSentryLookupSbdb,
  sentrySbdbHint = null,
  onExportSummary,
  exportStatus = "idle",
  maxMissLd = null,
  onMaxMissLdChange,
  minDiameterM = null,
  onMinDiameterMChange,
  rulerEnabled = false,
  onRulerEnabledChange,
  rulerA = null,
  rulerB = null,
  rulerSceneDist = null,
  rulerApproachMiss = null,
  onRulerClear,
  onRulerVsEarth,
  onRulerVsSun,
  onGuidedTour,
  embedded = false,
}: LiveNeoPanelProps) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);
  const [sentryCollapsed, setSentryCollapsed] = useState(false);

  const compareItems = useMemo(() => {
    const pool = catalogAsteroids ?? asteroids;
    const byId = new Map(pool.map((a) => [a.id, a]));
    // Prefer selected (may have SBDB orbit) when it is in compare
    if (selectedItem && isAsteroid(selectedItem)) {
      byId.set(selectedItem.id, selectedItem);
    }
    return compareIds
      .map((id) => byId.get(id))
      .filter((a): a is Asteroid => Boolean(a));
  }, [compareIds, catalogAsteroids, asteroids, selectedItem]);

  const shellClass = embedded
    ? "relative h-full w-full z-auto rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl flex flex-col overflow-hidden min-h-0"
    : `absolute z-40 rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl
        flex flex-col overflow-hidden
        left-3 right-3
        /* Mobile: sit above Mission Dock (42vh) + status bar (~3rem) */
        bottom-[calc(42vh+3.5rem)] max-h-[min(38vh,calc(100dvh-14rem))]
        /* Desktop overlay fallback when not in right rail */
        md:left-auto md:right-4 md:top-16 md:bottom-[22rem]
        md:w-[min(320px,90vw)] md:max-h-none`;

  return (
    <aside className={shellClass} aria-label="Live NEO tools">
      {/* Scrollable body — pagination lives in a fixed footer below */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pb-2">
      <h4 className="text-xs tracking-widest uppercase text-cyan-300 font-semibold mb-2">
        Live NEO tools
        {loading && (
          <span className="ml-2 normal-case tracking-normal text-amber-300/90">
            loading…
          </span>
        )}
      </h4>

      <ApproachTimeline
        selectedDate={dateStart}
        onSelectDate={onSelectDate}
        closestSummary={closestSummary}
        loading={loading}
      />

      {onGuidedTour && (
        <GuidedTours onRun={onGuidedTour} disabled={loading} defaultCollapsed />
      )}

      {onRulerEnabledChange && onRulerClear && onRulerVsEarth && onRulerVsSun && (
        <DistanceRuler
          enabled={rulerEnabled}
          onEnabledChange={onRulerEnabledChange}
          pointA={rulerA}
          pointB={rulerB}
          sceneDist={rulerSceneDist}
          approachMissLabel={rulerApproachMiss}
          onClear={onRulerClear}
          onMeasureVsEarth={onRulerVsEarth}
          onMeasureVsSun={onRulerVsSun}
          selected={selectedItem}
        />
      )}

      <input
        type="text"
        placeholder="Filter list by name…"
        value={searchInput}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full mb-2 px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-500"
        aria-label="Filter asteroids by name"
      />

      {/* P6 richer filters */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {onMaxMissLdChange && (
          <select
            value={maxMissLd ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onMaxMissLdChange(v === "" ? null : Number(v));
            }}
            className="text-[10px] px-1.5 py-1 rounded border border-white/10 bg-[#0c121c] text-gray-300"
            aria-label="Max miss distance filter"
          >
            <option value="">Miss: any</option>
            <option value="1">Miss &lt; 1 LD</option>
            <option value="5">Miss &lt; 5 LD</option>
            <option value="20">Miss &lt; 20 LD</option>
          </select>
        )}
        {onMinDiameterMChange && (
          <select
            value={minDiameterM ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onMinDiameterMChange(v === "" ? null : Number(v));
            }}
            className="text-[10px] px-1.5 py-1 rounded border border-white/10 bg-[#0c121c] text-gray-300"
            aria-label="Min diameter filter"
          >
            <option value="">Size: any</option>
            <option value="50">≥ 50 m</option>
            <option value="140">≥ 140 m</option>
            <option value="1000">≥ 1 km</option>
          </select>
        )}
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
          onChange={(e) => onPlanetsChange(e.target.checked)}
          className="h-4 w-4 accent-custom-blue"
        />
        Other planets & orbits
      </label>

      {onShowIssChange && (
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
            {showIss && iss && (
              <span className="text-[10px] text-sky-400/90 tabular-nums font-normal">
                {iss.lat.toFixed(1)}° · {iss.lon.toFixed(1)}°
              </span>
            )}
          </label>
          {showIss && onIssFocusChange && (
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
        </div>
      )}

      {onShowSentryChange && (
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
      )}

      {showSentry && (
        <SentryWatchlistPanel
          list={sentryList}
          loading={sentryLoading}
          error={sentryError}
          onPickDes={onSentryPickDes}
          collapsed={sentryCollapsed}
          onToggleCollapse={() => setSentryCollapsed((c) => !c)}
        />
      )}

      {sentryBriefDes && onDismissSentryBrief && (
        <SentryBriefing
          des={sentryBriefDes}
          summary={sentryBriefSummary}
          detail={sentryDetail}
          loading={sentryDetailLoading}
          error={sentryDetailError}
          onDismiss={onDismissSentryBrief}
          onLookupSbdb={onSentryLookupSbdb}
          sbdbHint={sentrySbdbHint}
        />
      )}

      {selectedItem && (
        <div className="mb-2.5">
          <BodyInspector
            item={selectedItem}
            onClear={onClearSelection}
            compact
            sbdb={sbdb}
            sbdbLoading={sbdbLoading}
            sbdbError={sbdbError}
            onToggleCompare={onToggleCompare}
            isInCompare={
              isAsteroid(selectedItem) &&
              compareIds.includes(selectedItem.id)
            }
            compareCount={compareIds.length}
            onCopyLink={onCopyLink}
            copyLinkStatus={copyLinkStatus}
            onClearCompare={onClearCompare}
            onExportSummary={onExportSummary}
            exportStatus={exportStatus}
          />
        </div>
      )}

      {compareIds.length > 0 && onClearCompare && onRemoveCompare && (
        <ComparePanel
          items={compareItems}
          selectedId={
            selectedItem && isAsteroid(selectedItem) ? selectedItem.id : null
          }
          onSelect={onSelectItem}
          onRemove={onRemoveCompare}
          onClear={onClearCompare}
        />
      )}

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
      </div>

      {/* Always-visible pagination footer — outside the scroll region */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-white/10 bg-[#0c121c]/95 text-xs text-gray-400">
        <button
          type="button"
          disabled={safePage <= 1 || loading}
          onClick={() => onPageChange(safePage - 1)}
          className="px-2.5 py-1.5 rounded bg-custom-blue text-white disabled:opacity-40"
        >
          Prev
        </button>
        <span className="tabular-nums" aria-live="polite">
          {safePage} / {safeTotal}
        </span>
        <button
          type="button"
          disabled={safePage >= safeTotal || loading}
          onClick={() => onPageChange(safePage + 1)}
          className="px-2.5 py-1.5 rounded bg-custom-blue text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </aside>
  );
}
