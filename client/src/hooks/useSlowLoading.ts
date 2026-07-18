import { useEffect, useState } from "react";

/**
 * Becomes true after `thresholdMs` while `loading` stays true.
 * Used for free-tier cold-start messaging.
 */
export function useSlowLoading(loading: boolean, thresholdMs = 3000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    setSlow(false);
    const id = window.setTimeout(() => setSlow(true), thresholdMs);
    return () => window.clearTimeout(id);
  }, [loading, thresholdMs]);

  return slow;
}
