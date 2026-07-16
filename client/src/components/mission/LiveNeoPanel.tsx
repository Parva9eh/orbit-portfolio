import { useMemo, useState } from "react";
import { isAsteroid } from "@shared";
import type { Asteroid } from "@shared";
import BodyInspector from "./BodyInspector";
import ApproachTimeline from "./ApproachTimeline";
import ComparePanel from "./ComparePanel";
import SentryWatchlistPanel from "./SentryWatchlist";
import SentryBriefing from "./SentryBriefing";
import DistanceRuler from "./DistanceRuler";
import GuidedTours from "./GuidedTours";
import LiveNeoLayerControls from "./LiveNeoLayerControls";
import NeoMissList from "./NeoMissList";
import { useLiveMissionTools } from "../../mission/LiveMissionContext";

type LiveNeoPanelProps = {
  /**
   * When true, fills a parent flex rail (desktop right column) instead of
   * absolute overlay placement.
   */
  embedded?: boolean;
};

/**
 * Live NEO tools panel — reads MissionControl state via LiveMissionContext.
 */
export default function LiveNeoPanel({ embedded = false }: LiveNeoPanelProps) {
  const tools = useLiveMissionTools();
  const {
    live,
    dispatchLive,
    selectedItem,
    onClearSelection,
    onSelectItem,
    asteroids,
    catalogAsteroids,
    closestSummary,
    totalPages,
    currentPage,
    loading,
    sbdb,
    sbdbLoading,
    sbdbError,
    onToggleCompare,
    onClearCompare,
    onRemoveCompare,
    onCopyLink,
    copyLinkStatus,
    iss,
    issLive,
    issAcquiring,
    onShowIssChange,
    onIssFocusChange,
    sentryList,
    sentryLoading,
    sentryError,
    onSentryPickDes,
    onShowSentryChange,
    sentryBriefSummary,
    sentryDetail,
    sentryDetailLoading,
    sentryDetailError,
    onDismissSentryBrief,
    onSentryLookupSbdb,
    sentrySbdbHint,
    onExportSummary,
    exportStatus,
    rulerApproachMiss,
    onRulerVsEarth,
    onRulerVsSun,
    onGuidedTour,
    onSelectDate,
    onHazardousChange,
    onPageChange,
    onSearchChange,
  } = tools;

  const {
    approachDate,
    searchTerm,
    showHazardous,
    compareIds,
    showSentry,
    sentryBriefDes,
    rulerEnabled,
    rulerA,
    rulerB,
    rulerSceneDist,
    page,
  } = live;

  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage || page), safeTotal);
  const [sentryCollapsed, setSentryCollapsed] = useState(false);

  const compareItems = useMemo(() => {
    const pool = catalogAsteroids.length ? catalogAsteroids : asteroids;
    const byId = new Map(pool.map((a) => [a.id, a]));
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
        bottom-[calc(42vh+3.5rem)] max-h-[min(38vh,calc(100dvh-14rem))]
        md:left-auto md:right-4 md:top-16 md:bottom-[22rem]
        md:w-[min(320px,90vw)] md:max-h-none`;

  return (
    <aside className={shellClass} aria-label="Live NEO tools" role="complementary">
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
          selectedDate={approachDate}
          onSelectDate={onSelectDate}
          closestSummary={closestSummary}
          loading={loading}
        />

        <GuidedTours onRun={onGuidedTour} disabled={loading} defaultCollapsed />

        <DistanceRuler
          enabled={rulerEnabled}
          onEnabledChange={(v) =>
            dispatchLive({ type: "SET_RULER_ENABLED", value: v })
          }
          pointA={rulerA}
          pointB={rulerB}
          sceneDist={rulerSceneDist}
          approachMissLabel={rulerApproachMiss}
          onClear={() => dispatchLive({ type: "CLEAR_RULER" })}
          onMeasureVsEarth={onRulerVsEarth}
          onMeasureVsSun={onRulerVsSun}
          selected={selectedItem}
        />

        <LiveNeoLayerControls
          live={live}
          dispatchLive={dispatchLive}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          showHazardous={showHazardous}
          onHazardousChange={onHazardousChange}
          iss={iss}
          issLive={issLive}
          issAcquiring={issAcquiring}
          onShowIssChange={onShowIssChange}
          onIssFocusChange={onIssFocusChange}
          onShowSentryChange={onShowSentryChange}
        />

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

        {sentryBriefDes && (
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

        {compareIds.length > 0 && (
          <ComparePanel
            items={compareItems}
            selectedId={
              selectedItem && isAsteroid(selectedItem)
                ? selectedItem.id
                : null
            }
            onSelect={onSelectItem}
            onRemove={onRemoveCompare}
            onClear={onClearCompare}
          />
        )}

        <NeoMissList
          asteroids={asteroids}
          loading={loading}
          selectedItem={selectedItem}
          compareIds={compareIds}
          onSelectItem={onSelectItem}
        />
      </div>

      <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-white/10 bg-[#0c121c]/95 text-xs text-gray-400">
        <button
          type="button"
          disabled={safePage <= 1 || loading}
          onClick={() => onPageChange(safePage - 1)}
          className="px-3 py-2 rounded bg-custom-blue text-white disabled:opacity-40 tap-target font-semibold"
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
          className="px-3 py-2 rounded bg-custom-blue text-white disabled:opacity-40 tap-target font-semibold"
        >
          Next
        </button>
      </div>
    </aside>
  );
}
