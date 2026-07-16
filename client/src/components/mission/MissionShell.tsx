import { useEffect, useState, type ReactNode } from "react";
import MissionTopBar, { type ViewMode } from "./MissionTopBar";
import MissionDock from "./MissionDock";
import MissionStatusBar from "./MissionStatusBar";
import VizControls, { captureCanvasScreenshot } from "./VizControls";
import LiveNeoPanel from "./LiveNeoPanel";
import type { MissionStepId } from "../../content/site";
import type { CelestialItem, IssPosition } from "@shared";
import type { DonkiSolarBadge } from "../../hooks/useDonkiSolar";

type MissionShellProps = {
  brand: string;
  step: MissionStepId;
  mode: ViewMode;
  onStepChange: (step: MissionStepId) => void;
  onModeChange: (mode: ViewMode) => void;
  onEnterLive: () => void;
  liveToolsOpen: boolean;
  /** Full-viewport canvas (and loading overlay) */
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

function useIsNarrow(breakpointPx = 768) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpointPx : true
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);
  return narrow;
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
  const narrow = useIsNarrow();
  // On phones, default viz panel collapsed so the canvas stays visible
  const [vizOpen, setVizOpen] = useState(() => !narrow);
  useEffect(() => {
    if (!narrow) setVizOpen(true);
  }, [narrow]);

  // Live tools: allow hide on mobile to reclaim vertical space
  const [liveOpenMobile, setLiveOpenMobile] = useState(true);
  const showLivePanel = liveToolsOpen && (!narrow || liveOpenMobile);

  return (
    <div className="relative h-[100dvh] w-full max-h-[100dvh] overflow-hidden bg-[#070b12] text-white touch-manipulation">
      <div className="absolute inset-0 bg-black">{canvas}</div>

      <MissionTopBar
        brand={brand}
        step={step}
        mode={mode}
        onStepChange={onStepChange}
        onModeChange={onModeChange}
      />

      <MissionDock
        step={step}
        onStepChange={onStepChange}
        onEnterLive={onEnterLive}
      />

      {/* Mobile-only: quick toggles so panels don't permanently cover the 3D scene */}
      {narrow && (
        <div
          className="absolute z-40 left-1/2 -translate-x-1/2 bottom-[3.25rem] safe-pad-b
            flex gap-1.5 pointer-events-auto"
        >
          {liveToolsOpen && (
            <button
              type="button"
              onClick={() => setLiveOpenMobile((v) => !v)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/15
                bg-black/70 backdrop-blur-md text-sky-200 tap-target shadow-lg"
              aria-pressed={liveOpenMobile}
            >
              {liveOpenMobile ? "Hide NEO tools" : "Show NEO tools"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVizOpen((v) => !v)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/15
              bg-black/70 backdrop-blur-md text-cyan-200 tap-target shadow-lg"
            aria-pressed={vizOpen}
          >
            {vizOpen ? "Hide viz" : "Viz"}
          </button>
        </div>
      )}

      {/*
        Chrome stack:
        - Mobile: Live Neo above dock; viz bottom-center (toggleable)
        - Desktop: right rail — Live Neo flexes above VizControls
      */}
      <div
        className="absolute z-30 pointer-events-none inset-0
          md:inset-auto md:right-4 md:top-16 md:bottom-14 md:w-[min(320px,92vw)]
          md:flex md:flex-col md:gap-2
          max-md:safe-pad-x"
      >
        {showLivePanel && (
          <div
            className="pointer-events-auto
              absolute left-3 right-3
              bottom-[calc(min(42vh,20rem)+4.5rem)]
              h-[min(32vh,calc(100dvh-16rem))]
              max-md:max-h-[min(34dvh,280px)]
              md:static md:left-auto md:right-auto md:bottom-auto md:h-auto
              md:flex-1 md:min-h-0 md:max-h-none"
          >
            <LiveNeoPanel embedded />
          </div>
        )}
        {(vizOpen || !narrow) && (
          <div
            className={`pointer-events-auto
              absolute bottom-[3.25rem] left-1/2 -translate-x-1/2 max-w-[min(92vw,300px)]
              md:static md:translate-x-0 md:left-auto md:bottom-auto md:max-w-none md:shrink-0
              ${liveToolsOpen ? "" : "md:mt-auto md:self-end md:w-[min(300px,90vw)]"}
              max-md:mb-8`}
          >
            <VizControls
              embedded
              compact={narrow}
              onScreenshot={captureCanvasScreenshot}
            />
          </div>
        )}
      </div>

      <MissionStatusBar
        loading={status.loading}
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
