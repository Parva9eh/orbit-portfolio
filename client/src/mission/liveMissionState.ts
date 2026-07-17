/**
 * Live-mode UI state for Mission Control.
 * Keeps filter / layer / ruler flags in one place so handlers don't
 * hand-synchronize a dozen useStates.
 */

import type { RulerEndpoint } from "../components/mission/DistanceRuler";
import type { OrbitUrlState } from "../lib/urlState";
import { todayIsoLocal } from "../lib/dateUtils";

export type LiveMissionState = {
  approachDate: string;
  page: number;
  searchTerm: string;
  showHazardous: boolean;
  showPlanets: boolean;
  compareIds: string[];
  showIss: boolean;
  issFocus: boolean;
  showSentry: boolean;
  sentryBriefDes: string | null;
  maxMissLd: number | null;
  minDiameterM: number | null;
  rulerEnabled: boolean;
  rulerA: RulerEndpoint | null;
  rulerB: RulerEndpoint | null;
  rulerSceneDist: number | null;
};

export type LiveMissionAction =
  | { type: "SET_DATE"; date: string }
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_HAZARDOUS"; value: boolean }
  | { type: "SET_SHOW_PLANETS"; value: boolean }
  | { type: "SET_COMPARE"; ids: string[] }
  | { type: "TOGGLE_COMPARE"; id: string }
  | { type: "CLEAR_COMPARE" }
  | { type: "REMOVE_COMPARE"; id: string }
  | { type: "SET_ISS"; show: boolean; focus?: boolean }
  | { type: "SET_ISS_FOCUS"; value: boolean }
  | { type: "SET_SENTRY"; show: boolean; briefDes?: string | null }
  | { type: "SET_SENTRY_BRIEF"; des: string | null }
  | { type: "SET_MAX_MISS_LD"; value: number | null }
  | { type: "SET_MIN_DIAMETER_M"; value: number | null }
  | { type: "SET_RULER_ENABLED"; value: boolean }
  | { type: "SET_RULER_A"; value: RulerEndpoint | null }
  | { type: "SET_RULER_B"; value: RulerEndpoint | null }
  | { type: "SET_RULER_DIST"; value: number | null }
  | { type: "CLEAR_RULER" }
  | { type: "HYDRATE_URL"; payload: Partial<OrbitUrlState> };

export function initialLiveMissionState(
  url: Partial<OrbitUrlState> = {}
): LiveMissionState {
  return {
    approachDate: url.date ?? todayIsoLocal(),
    page: 1,
    searchTerm: "",
    showHazardous: url.hazardous ?? false,
    showPlanets: true,
    compareIds: url.compare ?? [],
    showIss: Boolean(url.issFocus) || false,
    issFocus: url.issFocus ?? false,
    showSentry: Boolean(url.sentry) || false,
    sentryBriefDes: url.sentry ?? null,
    maxMissLd: null,
    minDiameterM: null,
    rulerEnabled: false,
    rulerA: null,
    rulerB: null,
    rulerSceneDist: null,
  };
}

export function liveMissionReducer(
  state: LiveMissionState,
  action: LiveMissionAction
): LiveMissionState {
  switch (action.type) {
    case "SET_DATE":
      return { ...state, approachDate: action.date, page: 1 };
    case "SET_PAGE":
      return { ...state, page: Math.max(1, Math.floor(action.page) || 1) };
    case "SET_SEARCH":
      return { ...state, searchTerm: action.value };
    case "SET_HAZARDOUS":
      return { ...state, showHazardous: action.value, page: 1 };
    case "SET_SHOW_PLANETS":
      return { ...state, showPlanets: action.value };
    case "SET_COMPARE":
      return { ...state, compareIds: action.ids.slice(0, 2) };
    case "TOGGLE_COMPARE": {
      const id = action.id;
      const has = state.compareIds.includes(id);
      if (has) {
        return {
          ...state,
          compareIds: state.compareIds.filter((x) => x !== id),
        };
      }
      if (state.compareIds.length >= 2) {
        return { ...state, compareIds: [state.compareIds[1], id] };
      }
      return { ...state, compareIds: [...state.compareIds, id] };
    }
    case "CLEAR_COMPARE":
      return { ...state, compareIds: [] };
    case "REMOVE_COMPARE":
      return {
        ...state,
        compareIds: state.compareIds.filter((x) => x !== action.id),
      };
    case "SET_ISS": {
      const show = action.show;
      const focus = action.focus ?? (show ? state.issFocus : false);
      return {
        ...state,
        showIss: show,
        issFocus: show ? focus : false,
      };
    }
    case "SET_ISS_FOCUS":
      return {
        ...state,
        issFocus: action.value,
        showIss: action.value ? true : state.showIss,
      };
    case "SET_SENTRY":
      return {
        ...state,
        showSentry: action.show,
        sentryBriefDes:
          action.briefDes !== undefined
            ? action.briefDes
            : action.show
              ? state.sentryBriefDes
              : null,
      };
    case "SET_SENTRY_BRIEF":
      return { ...state, sentryBriefDes: action.des };
    case "SET_MAX_MISS_LD":
      return { ...state, maxMissLd: action.value };
    case "SET_MIN_DIAMETER_M":
      return { ...state, minDiameterM: action.value };
    case "SET_RULER_ENABLED":
      return {
        ...state,
        rulerEnabled: action.value,
        ...(action.value
          ? {}
          : { rulerA: null, rulerB: null, rulerSceneDist: null }),
      };
    case "SET_RULER_A":
      return { ...state, rulerA: action.value };
    case "SET_RULER_B":
      return { ...state, rulerB: action.value };
    case "SET_RULER_DIST":
      return { ...state, rulerSceneDist: action.value };
    case "CLEAR_RULER":
      return {
        ...state,
        rulerA: null,
        rulerB: null,
        rulerSceneDist: null,
      };
    case "HYDRATE_URL": {
      const p = action.payload;
      return {
        ...state,
        ...(p.date ? { approachDate: p.date, page: 1 } : {}),
        ...(p.hazardous != null ? { showHazardous: p.hazardous } : {}),
        ...(p.compare ? { compareIds: p.compare.slice(0, 2) } : {}),
        ...(p.issFocus != null
          ? { issFocus: p.issFocus, showIss: p.issFocus || state.showIss }
          : {}),
        ...(p.sentry != null
          ? { showSentry: true, sentryBriefDes: p.sentry }
          : {}),
      };
    }
    default:
      return state;
  }
}
