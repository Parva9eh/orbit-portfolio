import { track } from "@vercel/analytics";

/**
 * Thin wrappers around Vercel Analytics custom events.
 * Safe no-ops outside production / when blocked; never throw.
 */
export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean | null>
): void {
  try {
    track(name, data);
  } catch {
    /* ignore */
  }
}

export function trackMissionStep(step: string): void {
  trackEvent("mission_step", { step });
}

export function trackEnterLive(source: string): void {
  trackEvent("enter_live", { source });
}

export function trackGuidedTour(tourId: string): void {
  trackEvent("guided_tour", { tour: tourId });
}

export function trackNeoTools(action: "open" | "close"): void {
  trackEvent("neo_tools", { action });
}

export function trackVizInfo(open: boolean): void {
  trackEvent("viz_info", { open });
}

export function trackCommsSubmit(result: "sent" | "error" | "validation"): void {
  trackEvent("comms_submit", { result });
}
