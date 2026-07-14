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
};

export default function VizControls({
  onScreenshot,
  embedded = false,
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

  // Mission clock readout (~4Hz, not every frame in React)
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

  return (
    <div
      className={
        embedded
          ? "relative w-full flex flex-col gap-1.5 p-2 rounded-xl border border-white/10 bg-[#0f1623]/95 backdrop-blur-md text-[0.7rem] text-gray-300 shadow-xl"
          : "absolute z-30 bottom-12 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 md:bottom-14 flex flex-col gap-2 p-2.5 rounded-xl border border-white/10 bg-[#0f1623]/90 backdrop-blur-md text-[0.7rem] text-gray-300 shadow-xl max-w-[min(92vw,300px)]"
      }
      role="toolbar"
      aria-label="Visualization controls"
    >
      {/* Mission clock */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem]">
          Mission clock
        </span>
        <span className="font-mono text-sky-200/95 text-xs tabular-nums">
          {clockLabel}
        </span>
      </div>

      {/* Time scale */}
      <div className="flex items-center gap-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Time
        </span>
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setTimeScale(s.value)}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${
              timeScale === s.value
                ? "bg-custom-blue text-white"
                : "bg-black/40 hover:bg-white/10 text-gray-300"
            }`}
            title={s.value === 0 ? "Pause" : `${s.value}× speed`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Camera director */}
      <div className="flex items-center gap-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Cam
        </span>
        {CAMERAS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCameraMode(c.value)}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${
              cameraMode === c.value
                ? "bg-custom-blue text-white"
                : "bg-black/40 hover:bg-white/10 text-gray-300"
            }`}
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

      {/* Multi-scale view */}
      <div className="flex items-center gap-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          View
        </span>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            title={v.title}
            onClick={() => setViewScale(v.value)}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${
              viewScale === v.value
                ? "bg-custom-blue text-white"
                : "bg-black/40 hover:bg-white/10 text-gray-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Quality */}
      <div className="flex items-center gap-1">
        <span className="text-cyan-300/90 uppercase tracking-wider text-[0.62rem] mr-1">
          Quality
        </span>
        {QUALITY.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => setQuality(q.value)}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${
              quality === q.value
                ? "bg-custom-blue text-white"
                : "bg-black/40 hover:bg-white/10 text-gray-300"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={trueScale}
            onChange={(e) => setTrueScale(e.target.checked)}
            className="accent-custom-blue"
          />
          True-scale
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="accent-custom-blue"
          />
          Labels
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(e) => setAudioEnabled(e.target.checked)}
            className="accent-custom-blue"
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
        className="w-full px-2 py-1.5 rounded-md bg-black/50 border border-white/10 hover:border-sky-400/50 font-semibold"
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
