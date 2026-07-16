import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSimSettings,
  useSimActions,
  type TimeScalePreset,
  type CameraMode,
  type QualityPreset,
  type ViewScale,
} from "../../sim/useSim";
import { formatSimClock } from "../../sim/simUtils";

const SPEEDS: { value: TimeScalePreset; label: string }[] = [
  { value: 0, label: "❚❚" },
  { value: 0.1, label: "0.1×" },
  { value: 1, label: "1×" },
  { value: 10, label: "10×" },
];

const CAMERAS: { value: CameraMode; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "tour", label: "Tour" },
  { value: "focus", label: "Focus" },
];

const QUALITY: { value: QualityPreset; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "cinematic", label: "Cinematic" },
];

const VIEWS: { value: ViewScale; label: string; title: string }[] = [
  {
    value: "system",
    label: "System",
    title: "Full solar system (planets). NEOs optional in Live.",
  },
  {
    value: "nearEarth",
    label: "Near-Earth",
    title: "Earth neighborhood — correct scale for NASA NEO feed data",
  },
];

type VizControlsProps = {
  onScreenshot?: () => void;
  /**
   * When true, fills a parent flex rail (right column) instead of absolute
   * bottom-right / bottom-center placement.
   */
  embedded?: boolean;
  /** Phone layout: denser spacing, secondary controls in a details block */
  compact?: boolean;
};

export default function VizControls({
  onScreenshot,
  embedded = false,
  compact = false,
}: VizControlsProps) {
  const {
    timeScale,
    trueScale,
    showLabels,
    audioEnabled,
    cameraMode,
    quality,
    viewScale,
  } = useSimSettings();
  const {
    setTimeScale,
    setTrueScale,
    setShowLabels,
    setAudioEnabled,
    setCameraMode,
    setQuality,
    setViewScale,
    getSimTime,
  } = useSimActions();

  const [clockLabel, setClockLabel] = useState("Y1 · D1");
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const clickRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const ambient = new Audio("/audio/ambient-space.mp3");
    ambient.loop = true;
    ambient.volume = 0.28;
    ambientRef.current = ambient;
    const click = new Audio("/audio/click.mp3");
    click.volume = 0.35;
    clickRef.current = click;
    return () => {
      ambient.pause();
      ambient.src = "";
    };
  }, []);

  useEffect(() => {
    const a = ambientRef.current;
    if (!a) return;
    if (audioEnabled) {
      void a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [audioEnabled]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockLabel(formatSimClock(getSimTime()).label);
    }, 250);
    return () => window.clearInterval(id);
  }, [getSimTime]);

  const playClick = useCallback(() => {
    const c = clickRef.current;
    if (!c || !audioEnabled) return;
    c.currentTime = 0;
    void c.play().catch(() => {});
  }, [audioEnabled]);

  useEffect(() => {
    const handler = () => playClick();
    window.addEventListener("orbit-sfx-click", handler);
    return () => window.removeEventListener("orbit-sfx-click", handler);
  }, [playClick]);

  const chip = (active: boolean) =>
    `px-2 py-1.5 rounded-md font-semibold transition-colors tap-target ${
      active
        ? "bg-custom-blue text-white"
        : "bg-black/40 hover:bg-white/10 text-gray-300"
    }`;

  const secondary = (
    <>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Quality
        </span>
        {QUALITY.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => setQuality(q.value)}
            className={chip(quality === q.value)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <label className="inline-flex items-center gap-1.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={trueScale}
            onChange={(e) => setTrueScale(e.target.checked)}
            className="accent-custom-blue h-3.5 w-3.5"
          />
          True-scale
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="accent-custom-blue h-3.5 w-3.5"
          />
          Labels
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(e) => setAudioEnabled(e.target.checked)}
            className="accent-custom-blue h-3.5 w-3.5"
          />
          Audio
        </label>
      </div>

      <button
        type="button"
        onClick={() => {
          playClick();
          onScreenshot?.();
        }}
        className="w-full px-2 py-1.5 rounded-md bg-black/50 border border-white/10 hover:border-sky-400/50 font-semibold tap-target"
      >
        Screenshot
      </button>
      {!embedded && (
        <p className="text-[0.6rem] text-gray-500 leading-snug">
          NASA NEO data = near-Earth approaches. Prefer{" "}
          <strong className="text-gray-400">Near-Earth</strong> view for Live
          mode. System view is for planets; main-belt rocks need different
          data.
        </p>
      )}
    </>
  );

  return (
    <div
      className={
        embedded
          ? `relative w-full flex flex-col gap-1.5 p-2 rounded-xl border border-white/10 bg-[#0f1623]/95 backdrop-blur-md text-[0.7rem] text-gray-300 shadow-xl ${
              compact ? "max-h-[40dvh] overflow-y-auto overscroll-contain" : ""
            }`
          : "absolute z-30 bottom-12 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 md:bottom-14 flex flex-col gap-2 p-2.5 rounded-xl border border-white/10 bg-[#0f1623]/90 backdrop-blur-md text-[0.7rem] text-gray-300 shadow-xl max-w-[min(92vw,300px)]"
      }
      role="toolbar"
      aria-label="Visualization controls"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem]">
          Mission clock
        </span>
        <span className="font-mono text-sky-200/95 text-xs tabular-nums">
          {clockLabel}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Time
        </span>
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setTimeScale(s.value)}
            className={chip(timeScale === s.value)}
            title={s.value === 0 ? "Pause" : `${s.value}× speed`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Cam
        </span>
        {CAMERAS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCameraMode(c.value)}
            className={chip(cameraMode === c.value)}
            title={
              c.value === "free"
                ? "Manual orbit controls"
                : c.value === "tour"
                  ? "Auto cinematic tour"
                  : "Dolly to selected body"
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          View
        </span>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            title={v.title}
            onClick={() => setViewScale(v.value)}
            className={chip(viewScale === v.value)}
          >
            {compact && v.value === "nearEarth" ? "Near" : v.label}
          </button>
        ))}
      </div>

      {compact ? (
        <details className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-cyan-300/90 py-1 select-none">
            More · quality, labels, screenshot
          </summary>
          <div className="flex flex-col gap-1.5 pb-1 pt-0.5">{secondary}</div>
        </details>
      ) : (
        secondary
      )}
    </div>
  );
}

export function captureCanvasScreenshot() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;
  try {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit-${new Date().toISOString().slice(0, 19)}.png`;
    a.click();
  } catch (e) {
    console.warn("Screenshot failed", e);
  }
}
