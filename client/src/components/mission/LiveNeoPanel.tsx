import type { ChangeEvent } from "react";
import type { Asteroid, CelestialItem } from "@shared";
import { isAsteroid } from "@shared";

type LiveNeoPanelProps = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  dateStart: string;
  onDateChange: (e: ChangeEvent<HTMLInputElement>) => void;
  showHazardous: boolean;
  onHazardousChange: (value: boolean) => void;
  showPlanets: boolean;
  onPlanetsChange: (value: boolean) => void;
  selectedItem: CelestialItem | null;
  onClearSelection: () => void;
  onSelectItem: (item: CelestialItem) => void;
  asteroids: Asteroid[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function LiveNeoPanel({
  searchInput,
  onSearchChange,
  dateStart,
  onDateChange,
  showHazardous,
  onHazardousChange,
  showPlanets,
  onPlanetsChange,
  selectedItem,
  onClearSelection,
  onSelectItem,
  asteroids,
  page,
  totalPages,
  onPageChange,
}: LiveNeoPanelProps) {
  return (
    <aside
      className="absolute z-20 rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl p-3.5
        left-3 right-3 bottom-[calc(42vh+3.25rem)] max-h-[28vh] overflow-y-auto
        md:left-auto md:right-4 md:top-16 md:bottom-auto md:w-[min(280px,90vw)] md:max-h-[min(420px,70vh)]"
      aria-label="Live NEO tools"
    >
      <h4 className="text-xs tracking-widest uppercase text-cyan-300 font-semibold mb-2.5">
        Live NEO tools
      </h4>

      <input
        type="text"
        placeholder="Search asteroids…"
        defaultValue={searchInput}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full mb-2 px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-500"
        aria-label="Search asteroids by name"
      />

      <label className="block text-xs text-gray-400 mb-1">Date</label>
      <input
        type="date"
        name="start"
        value={dateStart}
        onChange={onDateChange}
        className="w-full mb-2.5 px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm"
      />

      <label className="flex items-center gap-2 text-sm text-gray-300 mb-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={showHazardous}
          onChange={(e) => onHazardousChange(e.target.checked)}
          className="h-4 w-4 accent-custom-blue"
        />
        Hazardous only
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-300 mb-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={showPlanets}
          onChange={(e) => onPlanetsChange(e.target.checked)}
          className="h-4 w-4 accent-custom-blue"
        />
        Planets & orbits
      </label>

      {selectedItem && (
        <div className="mb-2.5 p-2.5 rounded-lg bg-black/40 border border-white/5 text-sm">
          <h5 className="font-bold text-white mb-1">{selectedItem.name}</h5>
          {isAsteroid(selectedItem) && (
            <p className="text-gray-400 text-xs">
              Hazardous: {selectedItem.isHazardous ? "Yes ⚠" : "No"}
            </p>
          )}
          <p className="text-gray-400 text-xs">
            Size: {(selectedItem.size * 1000).toFixed(2)} m
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="mt-2 text-xs font-semibold text-sky-300 hover:text-sky-200"
          >
            Clear selection
          </button>
        </div>
      )}

      <ul className="space-y-1 max-h-36 overflow-y-auto">
        {asteroids.map((neo) => (
          <li key={neo.id}>
            <button
              type="button"
              onClick={() => onSelectItem(neo)}
              className="w-full text-left text-xs px-2 py-1.5 rounded-md bg-black/30 hover:bg-custom-blue/20 text-gray-200"
            >
              {neo.name}
              {neo.isHazardous && (
                <span className="text-red-400 ml-1">⚠</span>
              )}
            </button>
          </li>
        ))}
        {asteroids.length === 0 && (
          <li className="text-xs text-gray-500 px-1">
            No asteroids on this page.
          </li>
        )}
      </ul>

      {totalPages > 1 && (
        <div className="mt-2.5 flex items-center justify-between text-xs text-gray-400">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-2 py-1 rounded bg-custom-blue text-white disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-2 py-1 rounded bg-custom-blue text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </aside>
  );
}
