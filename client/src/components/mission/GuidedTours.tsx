import { useState } from "react";

export type GuidedTourId =
  | "closest"
  | "earth"
  | "iss"
  | "system"
  | "trueScale";

type GuidedToursProps = {
  onRun: (id: GuidedTourId) => void;
  disabled?: boolean;
  /** Start collapsed to save panel space (default true) */
  defaultCollapsed?: boolean;
};

const TOURS: {
  id: GuidedTourId;
  label: string;
  blurb: string;
}[] = [
  {
    id: "closest",
    label: "Closest today",
    blurb: "Focus the nearest NEO by miss distance",
  },
  {
    id: "earth",
    label: "Earth neighborhood",
    blurb: "Near-Earth view · tour around Earth",
  },
  {
    id: "iss",
    label: "Watch ISS",
    blurb: "Near-Earth + ISS focus (LEO ring)",
  },
  {
    id: "system",
    label: "System tour",
    blurb: "Full solar system camera tour",
  },
  {
    id: "trueScale",
    label: "True-size peek",
    blurb: "Toggle true scale for planet sizes",
  },
];

/**
 * P6 — one-click guided missions for demos / portfolio walkthroughs.
 * Collapsed by default so Live Neo keeps more viewport for the list.
 */
export default function GuidedTours({
  onRun,
  disabled,
  defaultCollapsed = true,
}: GuidedToursProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className="mb-2 rounded-lg border border-cyan-500/20 bg-cyan-950/15 overflow-hidden"
      role="region"
      aria-label="Guided tours"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-cyan-500/10"
        aria-expanded={!collapsed}
      >
        <h5 className="text-[10px] uppercase tracking-widest text-cyan-300/95 font-semibold">
          Guided tours
          <span className="ml-1.5 normal-case tracking-normal font-normal text-cyan-500/70">
            · demo path
          </span>
        </h5>
        <span className="text-[10px] text-cyan-400/80 tabular-nums">
          {collapsed ? `${TOURS.length} · Show` : "Hide"}
        </span>
      </button>

      {!collapsed && (
        <ul className="space-y-1 px-2 pb-2">
          <li className="text-[10px] text-gray-500 px-1 pb-0.5 leading-snug">
            Portfolio walkthrough: Closest → Earth → ISS → System
          </li>
          {TOURS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRun(t.id)}
                className="w-full text-left px-2 py-1.5 rounded-md bg-black/30 hover:bg-cyan-500/15 border border-transparent hover:border-cyan-500/25 disabled:opacity-40"
              >
                <span className="text-xs font-medium text-gray-100 block">
                  {t.label}
                </span>
                <span className="text-[10px] text-gray-500">{t.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
