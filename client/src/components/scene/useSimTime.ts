import { useSimActions } from "../../sim/useSim";

/** Simulation clock (respects pause / speed) — stable actions ref only. */
export function useT() {
  const { simTimeRef } = useSimActions();
  return () => simTimeRef.current;
}
