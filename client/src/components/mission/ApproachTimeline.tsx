import { useMemo } from "react";
import {
  addDaysIso,
  dayChipLabel,
  dayChipTitle,
  dayWindow,
  todayIsoLocal,
} from "../../lib/dateUtils";

const WINDOW_DAYS = 7;

type ApproachTimelineProps = {
  /** Selected approach day (YYYY-MM-DD) — drives NeoWs `start_date` */
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  /** Optional one-line summary under chips */
  closestSummary?: string | null;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * P2 — approach timeline: Today … +6 days.
 * Each chip sets feed date (server caches per start_date; no stampede on re-click).
 */
export default function ApproachTimeline({
  selectedDate,
  onSelectDate,
  closestSummary,
  loading = false,
  disabled = false,
}: ApproachTimelineProps) {
  const today = useMemo(() => todayIsoLocal(), []);
  // Window always anchored to “today” so chips are stable; selection can be any chip
  const days = useMemo(() => dayWindow(today, WINDOW_DAYS), [today]);

  const canGoPrev = selectedDate > today;
  const canGoNext = selectedDate < days[days.length - 1];

  const stepDay = (delta: number) => {
    const next = addDaysIso(selectedDate, delta);
    if (next < today || next > days[days.length - 1]) return;
    onSelectDate(next);
  };

  return (
    <div className="mb-2.5" role="group" aria-label="Approach timeline">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h5 className="text-[10px] uppercase tracking-widest text-cyan-400/90 font-semibold">
          Approaches
        </h5>
        <span className="text-[10px] text-gray-500 tabular-nums">
          {selectedDate}
          {loading ? " · …" : ""}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !canGoPrev}
          onClick={() => stepDay(-1)}
          className="shrink-0 w-6 h-7 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 text-sm"
          aria-label="Previous day"
        >
          ‹
        </button>

        <div className="flex-1 flex gap-0.5 overflow-x-auto pb-0.5 scrollbar-thin">
          {days.map((iso) => {
            const active = iso === selectedDate;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                title={dayChipTitle(iso)}
                onClick={() => onSelectDate(iso)}
                className={`shrink-0 min-w-[2.75rem] px-1.5 py-1 rounded-md text-[10px] font-medium tabular-nums transition-colors
                  ${
                    active
                      ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/50"
                      : "bg-black/35 text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }
                  disabled:opacity-40`}
              >
                {dayChipLabel(iso, today)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={disabled || !canGoNext}
          onClick={() => stepDay(1)}
          className="shrink-0 w-6 h-7 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 text-sm"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {closestSummary && (
        <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
          <span className="text-gray-500">Closest · </span>
          <span className="text-sky-200/90">{closestSummary}</span>
        </p>
      )}
    </div>
  );
}

export { WINDOW_DAYS };
