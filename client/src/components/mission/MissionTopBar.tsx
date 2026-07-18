import { MISSION_STEPS, type MissionStepId } from "../../content/site";

export type ViewMode = "story" | "live";

type MissionTopBarProps = {
  brand: string;
  step: MissionStepId;
  mode: ViewMode;
  onStepChange: (step: MissionStepId) => void;
  onModeChange: (mode: ViewMode) => void;
};

const STEP_SHORT: Record<string, string> = {
  briefing: "Brief",
  projects: "Work",
  live: "Live",
  comms: "Comms",
};

export default function MissionTopBar({
  brand,
  step,
  mode,
  onStepChange,
  onModeChange,
}: MissionTopBarProps) {
  const active = MISSION_STEPS.find((s) => s.id === step);

  return (
    <header
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 sm:gap-3
        px-3 py-2.5 sm:px-4 sm:py-3 md:px-5
        safe-pad-x safe-pad-t
        bg-gradient-to-b from-black/90 via-black/70 to-transparent"
    >
      <div className="shrink-0 min-w-0">
        <div className="font-bold tracking-widest text-sm md:text-base">
          {brand}
          <span className="text-custom-blue">.</span>
        </div>
        <p className="sm:hidden text-[9px] uppercase tracking-wider text-cyan-300/70 truncate max-w-[5.5rem]">
          {STEP_SHORT[step] ?? active?.section ?? step}
        </p>
      </div>

      {/* Mobile + desktop: scrollable steps */}
      <nav
        className="flex flex-1 min-w-0 max-w-[min(52vw,16rem)] sm:max-w-none
          gap-1 justify-start sm:justify-center overflow-x-auto scrollbar-none
          touch-pan-x"
        aria-label="Mission sections"
      >
        {MISSION_STEPS.map((s) => {
          const short = s.label.split(" ")[0]; // "01", "02", …
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStepChange(s.id)}
              title={s.label}
              className={`shrink-0 text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors tap-target
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400
                ${
                  step === s.id
                    ? "text-white bg-custom-blue/20 border-custom-blue/50"
                    : "text-gray-400 border-transparent hover:text-white"
                }`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="inline-flex gap-0.5 p-0.5 rounded-full bg-black/40 border border-white/10 shrink-0"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => onModeChange("story")}
          className={`text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full transition-colors tap-target ${
            mode === "story"
              ? "bg-custom-blue text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Story
        </button>
        <button
          type="button"
          onClick={() => onModeChange("live")}
          className={`text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full transition-colors tap-target ${
            mode === "live"
              ? "bg-custom-blue text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <span className="sm:hidden">Live</span>
          <span className="hidden sm:inline">Live NEO</span>
        </button>
      </div>
    </header>
  );
}
