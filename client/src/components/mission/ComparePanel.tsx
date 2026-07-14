import type { Asteroid } from "@shared";
import {
  formatDiameterKm,
  formatMiss,
  formatVelocityKmS,
} from "@shared";
import { COMPARE_COLORS } from "../../lib/urlState";

type ComparePanelProps = {
  /** Resolved A/B asteroids (length 1–2) */
  items: Asteroid[];
  selectedId: string | null;
  onSelect: (a: Asteroid) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

function Slot({
  letter,
  color,
  a,
  isSelected,
  onSelect,
  onRemove,
  peer,
}: {
  letter: "A" | "B";
  color: string;
  a: Asteroid;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  /** Other slot for delta hints */
  peer?: Asteroid | null;
}) {
  const miss = a.approach;
  const peerMiss = peer?.approach;
  const closer =
    miss && peerMiss
      ? miss.missKm < peerMiss.missKm
        ? "closer"
        : miss.missKm > peerMiss.missKm
          ? "farther"
          : "same"
      : null;

  const diamA = a.diameterKmMax ?? a.size;
  const diamB = peer?.diameterKmMax ?? peer?.size;
  const larger =
    peer && diamA != null && diamB != null
      ? diamA > diamB
        ? "larger"
        : diamA < diamB
          ? "smaller"
          : "same"
      : null;

  return (
    <div
      className={`rounded-md border p-2 min-w-0 flex-1 ${
        isSelected ? "ring-1 ring-white/25" : ""
      }`}
      style={{
        borderColor: `${color}55`,
        background: `${color}12`,
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 text-left group"
          title="Focus this NEO"
        >
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-black mr-1.5 align-middle"
            style={{ background: color }}
          >
            {letter}
          </span>
          <span className="text-xs font-semibold text-white group-hover:underline truncate inline-block max-w-[9rem] align-middle">
            {a.name}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-gray-500 hover:text-gray-200 text-xs px-1"
          aria-label={`Remove ${letter} from compare`}
        >
          ×
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 text-[10px]">
        <dt className="text-gray-500">Miss</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {miss
            ? formatMiss(miss.missLd, miss.missKm, { compact: true })
            : "—"}
          {closer === "closer" && (
            <span className="ml-1 text-emerald-400/90">closer</span>
          )}
          {closer === "farther" && (
            <span className="ml-1 text-gray-500">farther</span>
          )}
        </dd>
        <dt className="text-gray-500">v_rel</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {miss ? formatVelocityKmS(miss.relativeVelocityKmS) : "—"}
        </dd>
        <dt className="text-gray-500">Size</dt>
        <dd className="text-right tabular-nums text-gray-100">
          {formatDiameterKm(a.diameterKmMin, a.diameterKmMax, a.size)}
          {larger === "larger" && (
            <span className="ml-1 text-amber-300/80">larger</span>
          )}
          {larger === "smaller" && (
            <span className="ml-1 text-gray-500">smaller</span>
          )}
        </dd>
        <dt className="text-gray-500">PHA</dt>
        <dd className="text-right">
          {a.isHazardous ? (
            <span className="text-red-300 font-semibold">Yes</span>
          ) : (
            <span className="text-gray-500">No</span>
          )}
        </dd>
      </dl>
    </div>
  );
}

/**
 * Side-by-side compare card — makes dual-orbit mode informative, not only visual.
 * Colors match scene orbit accents (A sky / B amber).
 */
export default function ComparePanel({
  items,
  selectedId,
  onSelect,
  onRemove,
  onClear,
}: ComparePanelProps) {
  if (items.length === 0) return null;

  const a = items[0];
  const b = items[1] ?? null;

  let deltaLine: string | null = null;
  if (a && b && a.approach && b.approach) {
    const dLd = Math.abs(a.approach.missLd - b.approach.missLd);
    const closer = a.approach.missKm <= b.approach.missKm ? "A" : "B";
    const closerName =
      closer === "A" ? a.name : b.name;
    deltaLine = `${closer} closer by ${dLd >= 0.01 ? dLd.toFixed(2) : dLd.toFixed(3)} LD · ${closerName}`;
  }

  return (
    <div
      className="mb-2.5 rounded-lg border border-white/10 bg-[#0c121c]/90 p-2"
      role="region"
      aria-label="Orbit compare"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h5 className="text-[10px] uppercase tracking-widest text-cyan-300/90 font-semibold">
          Compare orbits
        </h5>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-gray-500 hover:text-gray-300"
        >
          Clear
        </button>
      </div>

      {/* Scene color legend */}
      <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <span
            className="w-3 h-0.5 rounded"
            style={{ background: COMPARE_COLORS.a }}
          />
          Orbit A
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="w-3 h-0.5 rounded"
            style={{ background: COMPARE_COLORS.b }}
          />
          Orbit B
        </span>
        <span className="text-gray-600">match scene rings</span>
      </div>

      <div className="flex gap-1.5">
        <Slot
          letter="A"
          color={COMPARE_COLORS.a}
          a={a}
          isSelected={selectedId === a.id}
          onSelect={() => onSelect(a)}
          onRemove={() => onRemove(a.id)}
          peer={b}
        />
        {b ? (
          <Slot
            letter="B"
            color={COMPARE_COLORS.b}
            a={b}
            isSelected={selectedId === b.id}
            onSelect={() => onSelect(b)}
            onRemove={() => onRemove(b.id)}
            peer={a}
          />
        ) : (
          <div className="flex-1 rounded-md border border-dashed border-white/10 p-2 flex items-center justify-center text-[10px] text-gray-500 text-center leading-snug">
            Select another NEO
            <br />
            then + Compare
          </div>
        )}
      </div>

      {deltaLine && (
        <p className="mt-2 text-[11px] text-sky-200/90 leading-snug">
          {deltaLine}
        </p>
      )}
      {items.length === 1 && (
        <p className="mt-2 text-[10px] text-gray-500">
          Add a second object to see miss-distance and size deltas.
        </p>
      )}
    </div>
  );
}
