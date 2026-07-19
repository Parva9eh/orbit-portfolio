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
    hoverTip?: { text: string; kind: "planet" | "neo" | "pha" } | null;
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
  const fineHover = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const mobileChrome = narrow || landscape;
  const waking = useSlowLoading(status.loading, 3000);
  const isLiveStep = liveToolsOpen || step === "live";

  // Track pointer so the hover chip sits near the cursor (not stranded under the bar)
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!fineHover) return;
    const onMove = (e: PointerEvent) => {
      setPointer({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [fineHover]);

  const hoverTip = status.hoverTip ?? null;
  const hoverTone =
    hoverTip?.kind === "pha"
      ? "border-red-400/55 bg-red-950/90 text-red-100 shadow-[0_0_16px_rgba(248,113,113,0.35)]"
      : hoverTip?.kind === "neo"
        ? "border-cyan-400/50 bg-cyan-950/90 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.28)]"
        : "border-sky-400/50 bg-sky-950/90 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.3)]";

  // Viz: desktop open by default; mobile only on Live and collapsed until toggled
  const [vizOpen, setVizOpen] = useState(() => !narrow);
  useEffect(() => {
    if (!narrow && !landscape) setVizOpen(true);
    else if (!isLiveStep) setVizOpen(false);
  }, [narrow, landscape, isLiveStep]);

  // Live tools: collapsed by default on mobile so canvas is first paint
  const [liveOpenMobile, setLiveOpenMobile] = useState(false);
  useEffect(() => {
    if (!liveToolsOpen) setLiveOpenMobile(false);
  }, [liveToolsOpen]);

  const showLivePanel = liveToolsOpen && (!mobileChrome || liveOpenMobile);
  // Mobile Live FABs only on step Live — not over story/project links
  const showMobileLiveToggles = mobileChrome && isLiveStep;

  // Esc closes mobile Live sheet
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
      data-step={step}
    >
      <div className="absolute inset-0 bg-black">{canvas}</div>

      <MissionTopBar
        brand={brand}
        step={step}
        mode={mode}
        onStepChange={onStepChange}
        onModeChange={onModeChange}
      />

      {/* Desktop hover chip — follows cursor, colored by body kind */}
      {fineHover && hoverTip && (
        <div
          className={`fixed z-50 pointer-events-none max-w-[min(90vw,20rem)] px-3 py-1.5 rounded-lg border backdrop-blur-md text-[11px] font-semibold tracking-wide truncate animate-fade-in ${hoverTone}`}
          style={{
            left: Math.min(
              typeof window !== "undefined" ? window.innerWidth - 16 : 0,
              pointer.x + 14
            ),
            top: Math.min(
              typeof window !== "undefined" ? window.innerHeight - 40 : 0,
              pointer.y + 18
            ),
            transform: "translate(0, 0)",
          }}
          role="status"
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
              hoverTip.kind === "pha"
                ? "bg-red-400 shadow-[0_0_6px_#f87171]"
                : hoverTip.kind === "neo"
                  ? "bg-cyan-300 shadow-[0_0_6px_#67e8f9]"
                  : "bg-sky-300 shadow-[0_0_6px_#7dd3fc]"
            }`}
            aria-hidden
          />
          {hoverTip.text}
        </div>
      )}

      {/* Hide story dock when mobile Live sheet is open */}
      {!(narrow && showLivePanel && !landscape) && (
        <MissionDock
          step={step}
          onStepChange={onStepChange}
          onEnterLive={onEnterLive}
          landscape={landscape}
        />
      )}

      {/*
        Mobile Live-only toggles: top-right under header (not over dock footers).
        Open tools → inspect → hide to reveal the scene result.
      */}
      {showMobileLiveToggles && (
        <div
          className={`absolute z-40 pointer-events-auto flex gap-1.5 safe-pad-x
            ${
              landscape
                ? "right-3 top-1/2 -translate-y-1/2 flex-col"
                : "right-3 top-[3.55rem] flex-row"
            }`}
        >
          {liveToolsOpen && (
            <button
              type="button"
              onClick={() => setLiveOpenMobile((v) => !v)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-white/15
                bg-black/75 backdrop-blur-md text-sky-200 tap-target shadow-lg whitespace-nowrap
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
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-white/15
              bg-black/75 backdrop-blur-md text-cyan-200 tap-target shadow-lg
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            aria-pressed={vizOpen}
          >
            {vizOpen ? "Hide viz" : "Viz"}
          </button>
        </div>
      )}

      {/*
        Chrome stack:
        - Portrait mobile Live: bottom sheet
        - Landscape: tools from the right
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
                h-[min(62dvh,30rem)] max-h-[calc(100dvh-5rem)]
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
                    md:static md:flex-1 md:min-h-0 md:max-h-none`
            }
          >
            <LiveNeoPanel embedded />
          </div>
        )}

        {/* Viz: desktop always available; mobile only when toggled on Live */}
        {(vizOpen || !mobileChrome) &&
          !(narrow && showLivePanel && !landscape) &&
          (!mobileChrome || isLiveStep) && (
            <div
              className={
                landscape
                  ? "pointer-events-auto shrink-0"
                  : mobileChrome
                    ? `pointer-events-auto absolute right-3 top-[6.25rem] max-w-[min(92vw,280px)]`
                    : `pointer-events-auto
                        md:static md:translate-x-0 md:max-w-none md:shrink-0
                        ${liveToolsOpen ? "" : "md:mt-auto md:self-end md:w-[min(300px,90vw)]"}`
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
