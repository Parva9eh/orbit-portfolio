import { MISSION_STEPS, type MissionStepId } from "../../content/site";

export type ViewMode = "story" | "live";

type MissionTopBarProps = {
  brand: string;
  step: MissionStepId;
  mode: ViewMode;
  onStepChange: (step: MissionStepId) => void;
  onModeChange: (mode: ViewMode) => void;
};

export default function MissionTopBar({
  brand,
  step,
  mode,
  onStepChange,
  onModeChange,
}: MissionTopBarProps) {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-5 bg-gradient-to-b from-black/90 to-transparent">
      <div className="font-bold tracking-widest text-sm md:text-base shrink-0">
        {brand}
        <span className="text-custom-blue">.</span>
      </div>

      <nav
        className="hidden sm:flex flex-wrap gap-1 justify-center"
        aria-label="Mission sections"
      >
        {MISSION_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStepChange(s.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              step === s.id
                ? "text-white bg-custom-blue/20 border-custom-blue/50"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div
        className="inline-flex gap-0.5 p-0.5 rounded-full bg-black/40 border border-white/10 shrink-0"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => onModeChange("story")}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
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
          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
            mode === "live"
              ? "bg-custom-blue text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Live NEO
        </button>
      </div>
    </header>
  );
}
