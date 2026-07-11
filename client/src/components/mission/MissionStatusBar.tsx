import type { ViewMode } from "./MissionTopBar";

type MissionStatusBarProps = {
  loading: boolean;
  error: Error | null;
  mode: ViewMode;
};

export default function MissionStatusBar({
  loading,
  error,
  mode,
}: MissionStatusBarProps) {
  return (
    <footer className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-4 py-2 bg-black/80 border-t border-white/10 text-xs text-gray-400">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            error
              ? "bg-red-400 shadow-[0_0_6px_#f87171]"
              : loading
                ? "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse"
                : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
          }`}
          aria-hidden
        />
        <span className="truncate">
          {error
            ? `Signal degraded · ${error.message || "API error"}`
            : loading
              ? "Receiving telemetry…"
              : "Systems nominal · mock data ready"}
        </span>
      </div>
      <div className="hidden sm:block shrink-0 text-gray-500">
        {mode === "live"
          ? "Live NEO tools · click bodies in the scene"
          : "Mission steps · Story / Live NEO"}
      </div>
    </footer>
  );
}
