import { useEffect, useMemo, useState } from "react";
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
import PanelSection from "./PanelSection";
import { useLiveMissionTools } from "../../mission/LiveMissionContext";

type LiveNeoPanelProps = {
  embedded?: boolean;
};

type TabId = "catalog" | "layers" | "tools";

const TABS: { id: TabId; label: string }[] = [
  { id: "catalog", label: "Catalog" },
  { id: "layers", label: "Layers" },
  { id: "tools", label: "Tools" },
];

function useIsNarrow(bp = 768) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : true
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [bp]);
  return narrow;
}

type FilterChip = { key: string; label: string; clear: () => void };

/**
 * Live NEO tools — catalog-first layout, collapsible sections, mobile tabs.
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
    totalItems = 0,
    totalPages,
    currentPage,
    pagePending = false,
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
    showIss,
    showPlanets,
    sentryBriefDes,
    rulerEnabled,
    rulerA,
    rulerB,
    rulerSceneDist,
    maxMissLd,
    minDiameterM,
    page,
  } = live;

  // live.page is the request; only clamp upper bound once we know totalPages
  const safeTotal = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page || currentPage || 1), safeTotal);
  const listLoading = loading || pagePending;
  const catalogCountLabel = listLoading
    ? "…"
    : totalItems > 0
      ? `${asteroids.length} of ${totalItems}`
      : `${asteroids.length}`;
  const narrow = useIsNarrow();

  const [tab, setTab] = useState<TabId>("catalog");
  const [sentryCollapsed, setSentryCollapsed] = useState(true);
  const [openCatalog, setOpenCatalog] = useState(true);
  const [openLayers, setOpenLayers] = useState(false);
  const [openTools, setOpenTools] = useState(false);
  const [openInspect, setOpenInspect] = useState(true);

  // Mobile defaults: catalog tab; layers/tools collapsed on desktop sections
  useEffect(() => {
    if (narrow) {
      setTab("catalog");
    } else {
      setOpenCatalog(true);
      setOpenLayers(false);
      setOpenTools(false);
    }
  }, [narrow]);

  // Auto-open inspect when selection appears
  useEffect(() => {
    if (selectedItem) setOpenInspect(true);
  }, [selectedItem]);

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

  const filterChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = [];
    if (showHazardous) {
      chips.push({
        key: "haz",
        label: "Hazardous",
        clear: () => onHazardousChange(false),
      });
    }
    if (maxMissLd != null) {
      chips.push({
        key: "miss",
        label: `Miss < ${maxMissLd} LD`,
        clear: () =>
          dispatchLive({ type: "SET_MAX_MISS_LD", value: null }),
      });
    }
    if (minDiameterM != null) {
      chips.push({
        key: "size",
        label:
          minDiameterM >= 1000
            ? "Size ≥ 1 km"
            : `Size ≥ ${minDiameterM} m`,
        clear: () =>
          dispatchLive({ type: "SET_MIN_DIAMETER_M", value: null }),
      });
    }
    if (searchTerm.trim()) {
      chips.push({
        key: "q",
        label: `“${searchTerm.trim().slice(0, 16)}${searchTerm.trim().length > 16 ? "…" : ""}”`,
        clear: () => onSearchChange(""),
      });
    }
    return chips;
  }, [
    showHazardous,
    maxMissLd,
    minDiameterM,
    searchTerm,
    onHazardousChange,
    onSearchChange,
    dispatchLive,
  ]);

  const layerMeta = [
    showPlanets ? "Planets" : null,
    showIss ? "ISS" : null,
    showSentry ? "Sentry" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const shellClass = embedded
    ? "relative h-full w-full z-auto rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl flex flex-col overflow-hidden min-h-0"
    : `absolute z-40 rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl
        flex flex-col overflow-hidden
        left-3 right-3
        bottom-[calc(42vh+3.5rem)] max-h-[min(38vh,calc(100dvh-14rem))]
        md:left-auto md:right-4 md:top-16 md:bottom-[22rem]
        md:w-[min(320px,90vw)] md:max-h-none`;

  const statusPill = listLoading
    ? pagePending
      ? `Loading p.${safePage}…`
      : "Receiving…"
    : totalItems > 0
      ? `${asteroids.length}/${totalItems} · p.${safePage}/${safeTotal}`
      : `${asteroids.length} shown · p.${safePage}/${safeTotal}`;

  const catalogFilters = (
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

      <label className="flex items-center gap-2 text-sm text-gray-300 mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showHazardous}
          onChange={(e) => onHazardousChange(e.target.checked)}
          className="h-4 w-4 accent-custom-blue"
        />
        Hazardous only
      </label>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {filterChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-100/90 hover:bg-cyan-900/50"
              title="Clear filter"
            >
              {c.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onHazardousChange(false);
              onSearchChange("");
              dispatchLive({ type: "SET_MAX_MISS_LD", value: null });
              dispatchLive({ type: "SET_MIN_DIAMETER_M", value: null });
            }}
            className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-gray-300"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );

  const catalogBody = (
    <>
      <ApproachTimeline
        selectedDate={approachDate}
        onSelectDate={onSelectDate}
        closestSummary={closestSummary}
        loading={loading}
      />

      <div className="mb-2 mt-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
          Catalog · {catalogCountLabel} · page {safePage}/{safeTotal}
        </p>
        {catalogFilters}
      </div>

      <NeoMissList
        asteroids={pagePending ? [] : asteroids}
        loading={listLoading}
        selectedItem={selectedItem}
        compareIds={compareIds}
        onSelectItem={onSelectItem}
      />

      {selectedItem && (
        <div className="mt-2.5">
          <PanelSection
            id="inspect"
            title="Inspect"
            meta={selectedItem.name}
            open={openInspect}
            onToggle={() => setOpenInspect((o) => !o)}
          >
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
          </PanelSection>
        </div>
      )}

      {compareIds.length > 0 && (
        <div className="mt-2">
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
        </div>
      )}
    </>
  );

  const layersBody = (
    <>
      <LiveNeoLayerControls
        live={live}
        dispatchLive={dispatchLive}
        iss={iss}
        issLive={issLive}
        issAcquiring={issAcquiring}
        onShowIssChange={onShowIssChange}
        onIssFocusChange={onIssFocusChange}
        onShowSentryChange={onShowSentryChange}
      />

      {showSentry && (
        <div className="mt-2">
          <SentryWatchlistPanel
            list={sentryList}
            loading={sentryLoading}
            error={sentryError}
            onPickDes={onSentryPickDes}
            collapsed={sentryCollapsed}
            onToggleCollapse={() => setSentryCollapsed((c) => !c)}
          />
        </div>
      )}

      {sentryBriefDes && (
        <div className="mt-2">
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
        </div>
      )}
    </>
  );

  const toolsBody = (
    <>
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
    </>
  );

  const showCatalog = !narrow || tab === "catalog";
  const showLayers = !narrow || tab === "layers";
  const showTools = !narrow || tab === "tools";

  return (
    <aside
      className={shellClass}
      aria-label="Live NEO tools"
      role="complementary"
    >
      {/* Sticky header */}
      <div className="shrink-0 sticky top-0 z-10 px-3 pt-2.5 pb-2 border-b border-white/10 bg-[#0f1623]/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h4 className="text-xs tracking-widest uppercase text-cyan-300 font-semibold">
            Live NEO tools
          </h4>
          <span
            className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded border ${
              loading
                ? "border-amber-400/35 text-amber-200/90 animate-pulse"
                : "border-white/10 text-gray-500"
            }`}
            aria-live="polite"
          >
            {statusPill}
          </span>
        </div>

        {/* P4 — mobile tabs */}
        {narrow && (
          <div
            className="flex gap-0.5 p-0.5 rounded-lg bg-black/40 border border-white/10"
            role="tablist"
            aria-label="Live NEO sections"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 text-[11px] font-semibold py-1.5 rounded-md transition-colors ${
                  tab === t.id
                    ? "bg-custom-blue text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
                {t.id === "layers" && layerMeta && tab !== "layers" && (
                  <span className="block text-[9px] font-normal opacity-80 truncate px-0.5">
                    {layerMeta}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pb-2">
        {/* Desktop: collapsible sections; mobile: tab panels */}
        {narrow ? (
          <>
            {showCatalog && (
              <div role="tabpanel" aria-label="Catalog">
                {catalogBody}
              </div>
            )}
            {showLayers && (
              <div role="tabpanel" aria-label="Layers">
                {layersBody}
              </div>
            )}
            {showTools && (
              <div role="tabpanel" aria-label="Tools">
                {toolsBody}
              </div>
            )}
          </>
        ) : (
          <>
            <PanelSection
              id="catalog"
              title="Catalog"
              meta={
                listLoading
                  ? "loading…"
                  : `${catalogCountLabel} · p.${safePage}/${safeTotal}`
              }
              open={openCatalog}
              onToggle={() => setOpenCatalog((o) => !o)}
            >
              {catalogBody}
            </PanelSection>

            <PanelSection
              id="layers"
              title="Layers"
              meta={layerMeta || "off"}
              open={openLayers}
              onToggle={() => setOpenLayers((o) => !o)}
            >
              {layersBody}
            </PanelSection>

            <PanelSection
              id="tools"
              title="Demo tools"
              meta={rulerEnabled ? "ruler on" : "tours · ruler"}
              open={openTools}
              onToggle={() => setOpenTools((o) => !o)}
            >
              {toolsBody}
            </PanelSection>
          </>
        )}
      </div>

      {/* Pagination — catalog context only on mobile */}
      {(!narrow || tab === "catalog") && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-white/10 bg-[#0c121c]/95 text-xs text-gray-400">
          <button
            type="button"
            disabled={safePage <= 1 || listLoading}
            onClick={() => onPageChange(safePage - 1)}
            className="px-3 py-2 rounded bg-custom-blue text-white disabled:opacity-40 tap-target font-semibold"
          >
            Prev
          </button>
          <span className="tabular-nums" aria-live="polite">
            {listLoading ? `… ${safePage}` : safePage} / {safeTotal}
          </span>
          <button
            type="button"
            disabled={safePage >= safeTotal || listLoading}
            onClick={() => onPageChange(safePage + 1)}
            className="px-3 py-2 rounded bg-custom-blue text-white disabled:opacity-40 tap-target font-semibold"
          >
            Next
          </button>
        </div>
      )}
    </aside>
  );
}
