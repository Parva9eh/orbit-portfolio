import { useEffect, useState, type ReactNode } from "react";
import MissionTopBar, { type ViewMode } from "./MissionTopBar";
import MissionDock from "./MissionDock";
import MissionStatusBar from "./MissionStatusBar";
import VizControls, { captureCanvasScreenshot } from "./VizControls";
import LiveNeoPanel from "./LiveNeoPanel";
import type { MissionStepId } from "../../content/site";
import type { CelestialItem, IssPosition } from "@shared";
import type { DonkiSolarBadge } from "../../hooks/useDonkiSolar";
import { useSlowLoading } from "../../hooks/useSlowLoading";

type MissionShellProps = {
  brand: string;
  step: MissionStepId;
  mode: ViewMode;
  onStepChange: (step: MissionStepId) => void;
  onModeChange: (mode: ViewMode) => void;
  onEnterLive: () => void;
  liveToolsOpen: boolean;
  canvas: ReactNode;
  status: {
    loading: boolean;
    error: Error | null;
    selectedItem: CelestialItem | null;
    iss: IssPosition | null;
    showIss: boolean;
    issFocus: boolean;
    solar: DonkiSolarBadge | null;
    rulerLabel: string | null;
  };
};

function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return defaultValue;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

/**
 * Mission chrome: top bar, dock, right rail (Live tools + viz), status bar.
 * Canvas is injected so 3D stays owned by the page.
 */
export default function MissionShell({
  brand,
  step,
  mode,
  onStepChange,
  onModeChange,
  onEnterLive,
  liveToolsOpen,
  canvas,
  status,
}: MissionShellProps) {
  const narrow = useMediaQuery("(max-width: 767px)", true);
  const landscape = useMediaQuery(
    "(max-width: 1024px) and (orientation: landscape)",
    false
  );
  const mobileChrome = narrow || landscape;
  const waking = useSlowLoading(status.loading, 3000);

  // Viz: collapsed by default on phone portrait; open on desktop / when leaving narrow
  const [vizOpen, setVizOpen] = useState(() => !narrow);
  useEffect(() => {
    if (!narrow && !landscape) setVizOpen(true);
  }, [narrow, landscape]);

  // Live tools: collapsed by default on mobile so canvas is first paint
  const [liveOpenMobile, setLiveOpenMobile] = useState(false);
  useEffect(() => {
    if (!liveToolsOpen) setLiveOpenMobile(false);
  }, [liveToolsOpen]);

  const showLivePanel = liveToolsOpen && (!mobileChrome || liveOpenMobile);

  // Esc closes mobile Live sheet (selection clear is handled in LiveNeoPanel)
  useEffect(() => {
    if (!liveOpenMobile || !mobileChrome) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      setLiveOpenMobile(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [liveOpenMobile, mobileChrome]);

  return (
    <div
      className="relative h-[100dvh] w-full max-h-[100dvh] overflow-hidden bg-[#070b12] text-white touch-manipulation"
      data-layout={landscape ? "landscape" : narrow ? "narrow" : "desktop"}
    >
      <div className="absolute inset-0 bg-black">{canvas}</div>

      <MissionTopBar
        brand={brand}
        step={step}
        mode={mode}
        onStepChange={onStepChange}
        onModeChange={onModeChange}
      />

      {/* Hide story dock when mobile Live sheet is open so sheet can use height */}
      {!(narrow && showLivePanel && !landscape) && (
        <MissionDock
          step={step}
          onStepChange={onStepChange}
          onEnterLive={onEnterLive}
          landscape={landscape}
        />
      )}

      {/* Mobile / landscape: quick toggles */}
      {mobileChrome && (
        <div
          className={`absolute z-40 pointer-events-auto flex gap-1.5 safe-pad-b
            ${
              landscape
                ? "right-3 top-1/2 -translate-y-1/2 flex-col"
                : showLivePanel
                  ? "left-1/2 -translate-x-1/2 bottom-[min(58dvh,28rem)]"
                  : "left-1/2 -translate-x-1/2 bottom-[3.25rem]"
            }`}
        >
          {liveToolsOpen && (
            <button
              type="button"
              onClick={() => setLiveOpenMobile((v) => !v)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/15
                bg-black/70 backdrop-blur-md text-sky-200 tap-target shadow-lg whitespace-nowrap
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              aria-pressed={liveOpenMobile}
              aria-label={liveOpenMobile ? "Hide NEO tools" : "Show NEO tools"}
            >
              {liveOpenMobile ? "Hide tools" : "NEO tools"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVizOpen((v) => !v)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/15
              bg-black/70 backdrop-blur-md text-cyan-200 tap-target shadow-lg
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            aria-pressed={vizOpen}
          >
            {vizOpen ? "Hide viz" : "Viz"}
          </button>
        </div>
      )}

      {/*
        Chrome stack:
        - Portrait mobile: Live Neo as bottom sheet
        - Landscape: Live tools from the right
        - Desktop: right rail
      */}
      <div
        className={
          landscape
            ? `absolute z-30 pointer-events-none top-14 bottom-12 right-0 w-[min(42vw,320px)]
                flex flex-col gap-2 p-2 transition-transform duration-200 ease-out
                ${showLivePanel || vizOpen ? "translate-x-0" : "translate-x-full"}`
            : narrow
              ? "absolute z-30 pointer-events-none inset-0"
              : `absolute z-30 pointer-events-none inset-0
                  md:inset-auto md:right-4 md:top-16 md:bottom-14 md:w-[min(320px,92vw)]
                  md:flex md:flex-col md:gap-2
                  max-md:safe-pad-x`
        }
      >
        {/* Mobile portrait bottom sheet */}
        {narrow && !landscape && showLivePanel && (
          <>
            <button
              type="button"
              aria-label="Dismiss NEO tools"
              className="absolute inset-0 z-0 bg-black/40 pointer-events-auto animate-fade-in"
              onClick={() => setLiveOpenMobile(false)}
            />
            <div
              className="absolute left-0 right-0 bottom-0 z-10 pointer-events-auto
                h-[min(58dvh,28rem)] max-h-[calc(100dvh-5.5rem)]
                safe-pad-x safe-pad-b
                px-2 pb-2 pt-0
                animate-fade-in"
              role="dialog"
              aria-modal="true"
              aria-label="Live NEO tools"
            >
              <div className="h-full rounded-t-2xl overflow-hidden shadow-2xl border border-white/10 border-b-0">
                <LiveNeoPanel
                  embedded
                  sheet
                  onRequestClose={() => setLiveOpenMobile(false)}
                />
              </div>
            </div>
          </>
        )}

        {/* Landscape + desktop Live panel */}
        {showLivePanel && (!narrow || landscape) && (
          <div
            className={
              landscape
                ? "pointer-events-auto flex-1 min-h-0 rounded-xl overflow-hidden shadow-2xl"
                : `pointer-events-auto
                    absolute left-3 right-3
                    bottom-[calc(min(42vh,20rem)+4.5rem)]
                    h-[min(32vh,calc(100dvh-16rem))]
                    max-md:max-h-[min(34dvh,280px)]
                    md:static md:left-auto md:right-auto md:bottom-auto md:h-auto
                    md:flex-1 md:min-h-0 md:max-h-none`
            }
          >
            <LiveNeoPanel embedded />
          </div>
        )}

        {(vizOpen || !mobileChrome) && !(narrow && showLivePanel && !landscape) && (
          <div
            className={
              landscape
                ? "pointer-events-auto shrink-0"
                : `pointer-events-auto
                    absolute bottom-[3.25rem] left-1/2 -translate-x-1/2 max-w-[min(92vw,300px)]
                    md:static md:translate-x-0 md:left-auto md:bottom-auto md:max-w-none md:shrink-0
                    ${liveToolsOpen ? "" : "md:mt-auto md:self-end md:w-[min(300px,90vw)]"}
                    max-md:mb-8`
            }
          >
            <VizControls
              embedded
              compact={mobileChrome}
              onScreenshot={captureCanvasScreenshot}
            />
          </div>
        )}
      </div>

      {landscape && showLivePanel && (
        <button
          type="button"
          aria-label="Close NEO tools"
          className="absolute inset-0 z-[25] bg-black/25 pointer-events-auto md:hidden"
          style={{ right: "min(42vw, 320px)" }}
          onClick={() => setLiveOpenMobile(false)}
        />
      )}

      <MissionStatusBar
        loading={status.loading}
        waking={waking}
        error={status.error}
        mode={mode}
        selectedItem={status.selectedItem}
        iss={status.iss}
        showIss={status.showIss}
        issFocus={status.issFocus}
        solar={status.solar}
        rulerLabel={status.rulerLabel}
      />
    </div>
  );
}
