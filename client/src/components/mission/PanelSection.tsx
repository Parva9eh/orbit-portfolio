import type { ReactNode } from "react";

type PanelSectionProps = {
  id: string;
  title: string;
  /** Right-side meta (counts, status) */
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Extra class on body */
  bodyClassName?: string;
};

/**
 * Consistent collapsible block for Live NEO tools.
 */
export default function PanelSection({
  id,
  title,
  meta,
  open,
  onToggle,
  children,
  bodyClassName = "",
}: PanelSectionProps) {
  return (
    <section
      className="mb-2 rounded-lg border border-white/10 bg-black/20 overflow-hidden"
      aria-labelledby={`${id}-heading`}
    >
      <button
        type="button"
        id={`${id}-heading`}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-white/5"
        aria-expanded={open}
        aria-controls={`${id}-body`}
      >
        <span className="text-[10px] uppercase tracking-widest text-cyan-300/95 font-semibold">
          {title}
        </span>
        <span className="flex items-center gap-2 min-w-0">
          {meta && (
            <span className="text-[10px] text-gray-500 truncate normal-case tracking-normal font-normal">
              {meta}
            </span>
          )}
          <span className="text-[10px] text-cyan-400/80 tabular-nums shrink-0">
            {open ? "Hide" : "Show"}
          </span>
        </span>
      </button>
      {open && (
        <div id={`${id}-body`} className={`px-2.5 pb-2.5 ${bodyClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
}
