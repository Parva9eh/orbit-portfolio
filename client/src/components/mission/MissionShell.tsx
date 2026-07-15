import type { ReactNode } from "react";
import MissionTopBar, {
  type ViewMode,
} from "./MissionTopBar";
import MissionDock from "./MissionDock";
import MissionStatusBar from "./MissionStatusBar";
import VizControls, {
  captureCanvasScreenshot,
} from "./VizControls";
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
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12] text-white">
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

      {/*
        Chrome stack:
        - Mobile: Live Neo above dock; viz controls bottom-center
        - Desktop: right rail — Live Neo flexes above VizControls (bottom-right)
      */}
      <div
        className="absolute z-30 pointer-events-none inset-0
          md:inset-auto md:right-4 md:top-16 md:bottom-14 md:w-[min(320px,90vw)]
          md:flex md:flex-col md:gap-2"
      >
        {liveToolsOpen && (
          <div
            className="pointer-events-auto
              absolute left-3 right-3 bottom-[calc(42vh+3.5rem)] h-[min(38vh,calc(100dvh-14rem))]
              md:static md:left-auto md:right-auto md:bottom-auto md:h-auto
              md:flex-1 md:min-h-0"
          >
            <LiveNeoPanel embedded />
          </div>
        )}
        <div
          className={`pointer-events-auto
            absolute bottom-12 left-1/2 -translate-x-1/2 max-w-[min(92vw,300px)]
            md:static md:translate-x-0 md:left-auto md:bottom-auto md:max-w-none md:shrink-0
            ${liveToolsOpen ? "" : "md:mt-auto md:self-end md:w-[min(300px,90vw)]"}`}
        >
          <VizControls embedded onScreenshot={captureCanvasScreenshot} />
        </div>
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
