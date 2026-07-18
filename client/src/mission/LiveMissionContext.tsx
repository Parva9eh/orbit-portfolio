import { createContext, useContext, type ReactNode } from "react";
import type {
  Asteroid,
  CelestialItem,
  IssPosition,
  SbdbOrbitResult,
  SentryDetail,
  SentryWatchItem,
  SentryWatchlist,
} from "@shared";
import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import type { GuidedTourId } from "../components/mission/GuidedTours";
import type { LiveMissionState } from "./liveMissionState";

/** Everything LiveNeoPanel needs — provided by MissionControl. */
export type LiveMissionTools = {
  live: LiveMissionState;
  dispatchLive: React.Dispatch<
    import("./liveMissionState").LiveMissionAction
  >;

  selectedItem: CelestialItem | null;
  onClearSelection: () => void;
  onSelectItem: (item: CelestialItem) => void;

  asteroids: Asteroid[];
  catalogAsteroids: Asteroid[];
  closestSummary: string | null;
  /** Catalog size for the current date/filter (server total, not just this page) */
  totalItems: number;
  /** Server page size (for global row indices) */
  pageLimit: number;
  totalPages: number;
  currentPage: number;
  /** True while requested page data is not yet available */
  pagePending?: boolean;
  loading: boolean;
  /** Catalog-only error (for Retry / demo fallback UI) */
  catalogError?: Error | null;
  onRetryCatalog?: () => void;
  onUseDemoCatalog?: () => void;

  sbdb: SbdbOrbitResult | null;
  sbdbLoading: boolean;
  sbdbError: Error | null;

  onToggleCompare: () => void;
  onClearCompare: () => void;
  onRemoveCompare: (id: string) => void;
  onCopyLink: () => void;
  copyLinkStatus: "idle" | "copied" | "failed";

  iss: IssPosition | null;
  /** False while only the local LEO seed is available */
  issLive: boolean;
  issAcquiring: boolean;
  onShowIssChange: (v: boolean) => void;
  onIssFocusChange: (v: boolean) => void;

  sentryList: SentryWatchlist | null;
  sentryLoading: boolean;
  sentryError: Error | null;
  onSentryPickDes: (des: string) => void;
  onShowSentryChange: (v: boolean) => void;
  sentryBriefSummary: SentryWatchItem | null;
  sentryDetail: SentryDetail | null;
  sentryDetailLoading: boolean;
  sentryDetailError: string | null;
  onDismissSentryBrief: () => void;
  onSentryLookupSbdb: () => void;
  sentrySbdbHint: string | null;

  onExportSummary: () => void;
  exportStatus: "idle" | "copied" | "failed";

  rulerApproachMiss: string | null;
  onRulerVsEarth: () => void;
  onRulerVsSun: () => void;
  onGuidedTour: (id: GuidedTourId) => void;

  onSelectDate: (iso: string) => void;
  onHazardousChange: (v: boolean) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
};

const LiveMissionContext = createContext<LiveMissionTools | null>(null);

export function LiveMissionProvider({
  value,
  children,
}: {
  value: LiveMissionTools;
  children: ReactNode;
}) {
  return (
    <LiveMissionContext.Provider value={value}>
      {children}
    </LiveMissionContext.Provider>
  );
}

export function useLiveMissionTools(): LiveMissionTools {
  const ctx = useContext(LiveMissionContext);
  if (!ctx) {
    throw new Error("useLiveMissionTools must be used within LiveMissionProvider");
  }
  return ctx;
}

/** Convenience: live state slice. */
export function useLiveState(): LiveMissionState {
  return useLiveMissionTools().live;
}

export type { RulerEndpoint };
