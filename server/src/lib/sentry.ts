import {
  SENTRY_EDU_NOTE,
  type SentryDetail,
  type SentryWatchItem,
  type SentryWatchlist,
} from "../../../shared/index.ts";
import {
  cache,
  SENTRY_TTL_SEC,
  SENTRY_TIMEOUT_MS,
  inflightSentry,
} from "./cache.ts";
import { axiosGetJson } from "./http.ts";

type SentryRow = {
  des?: string;
  fullname?: string;
  ip?: string | number;
  ps_cum?: string | number;
  ts_max?: string | number;
  diameter?: string | number;
  range?: string;
  n_imp?: string | number;
  last_obs?: string;
};

export function mapSentryRow(row: SentryRow): SentryWatchItem {
  const ip = Number(row.ip);
  const psCum = Number(row.ps_cum);
  const tsMax = Number(row.ts_max);
  const diameter = Number(row.diameter);
  const nImp = Number(row.n_imp);
  return {
    des: String(row.des ?? ""),
    fullname: String(row.fullname ?? row.des ?? ""),
    ip: Number.isFinite(ip) ? ip : 0,
    psCum: Number.isFinite(psCum) ? psCum : -99,
    tsMax: Number.isFinite(tsMax) ? tsMax : 0,
    diameterKm: Number.isFinite(diameter) ? diameter : null,
    range: row.range ?? null,
    nImp: Number.isFinite(nImp) ? nImp : null,
    lastObs: row.last_obs ?? null,
  };
}

const SENTRY_FALLBACK_ITEMS: SentryWatchItem[] = [
  {
    des: "1979 XB",
    fullname: "(1979 XB)",
    ip: 8.9e-7,
    psCum: -2.75,
    tsMax: 0,
    diameterKm: 0.66,
    range: "2056-2113",
    nImp: 5,
    lastObs: "1979-12-15",
  },
  {
    des: "2000 SG344",
    fullname: "(2000 SG344)",
    ip: 1.1e-4,
    psCum: -3.1,
    tsMax: 0,
    diameterKm: 0.037,
    range: "2068-2113",
    nImp: 100,
    lastObs: "2000-10-30",
  },
  {
    des: "2010 RF12",
    fullname: "(2010 RF12)",
    ip: 4.7e-2,
    psCum: -3.0,
    tsMax: 0,
    diameterKm: 0.007,
    range: "2095-2117",
    nImp: 50,
    lastObs: "2010-09-10",
  },
  {
    des: "99942",
    fullname: "99942 Apophis (2004 MN4)",
    ip: 0,
    psCum: -6.5,
    tsMax: 0,
    diameterKm: 0.34,
    range: "—",
    nImp: 0,
    lastObs: "2021-03-10",
  },
  {
    des: "2015 XJ351",
    fullname: "(2015 XJ351)",
    ip: 2.0e-6,
    psCum: -4.2,
    tsMax: 0,
    diameterKm: 0.12,
    range: "2070-2115",
    nImp: 8,
    lastObs: "2015-12-12",
  },
];

export function sentryFallback(limit: number, reason: string): SentryWatchlist {
  const items = SENTRY_FALLBACK_ITEMS.slice(0, Math.max(1, limit));
  return {
    count: items.length,
    items,
    note: SENTRY_EDU_NOTE,
    source: "CNEOS Sentry (cached sample)",
    degraded: true,
    degradedReason: reason,
  };
}

export let lastGoodSentry: SentryWatchlist | null = null;

export async function fetchSentryWatchlist(limit: number): Promise<SentryWatchlist> {
  const key = `sentry_s_v2_${limit}`;
  const hit = cache.get<SentryWatchlist>(key);
  if (hit && !hit.degraded) return hit;

  const pending = inflightSentry.get(key) as Promise<SentryWatchlist> | undefined;
  if (pending) return pending;

  const load = (async (): Promise<SentryWatchlist> => {
    try {
      // Mode S — summary of all Sentry objects
      const body = await axiosGetJson<{
        count?: number;
        data?: SentryRow[];
        signature?: unknown;
      }>("https://ssd-api.jpl.nasa.gov/sentry.api", SENTRY_TIMEOUT_MS, 1);

      const rows = (body.data ?? []).map(mapSentryRow).filter((r) => r.des);
      if (rows.length === 0) {
        throw new Error("Sentry returned empty data");
      }
      // More notable first: higher (less negative) Palermo scale
      rows.sort((a, b) => b.psCum - a.psCum);
      const items = rows.slice(0, limit);
      const list: SentryWatchlist = {
        count: items.length,
        items,
        note: SENTRY_EDU_NOTE,
        source: "CNEOS Sentry",
        degraded: false,
      };
      cache.set(key, list, SENTRY_TTL_SEC);
      lastGoodSentry = list;
      return list;
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        code?: string;
        response?: { status?: number };
      };
      const status = err.response?.status;
      const reason =
        status === 502 || status === 503
          ? `CNEOS API HTTP ${status} (upstream gateway)`
          : err.code === "ECONNABORTED"
            ? "CNEOS API timeout"
            : err.message ?? "CNEOS API unreachable";
      console.warn("Sentry live fetch failed, using fallback:", reason);

      // Prefer last good live payload over static sample
      if (lastGoodSentry?.items?.length) {
        const reused: SentryWatchlist = {
          ...lastGoodSentry,
          items: lastGoodSentry.items.slice(0, limit),
          count: Math.min(lastGoodSentry.items.length, limit),
          degraded: true,
          degradedReason: `${reason} · showing last successful fetch`,
          source: "CNEOS Sentry (cached sample)",
        };
        cache.set(key, reused, 120);
        return reused;
      }

      const fb = sentryFallback(limit, reason);
      // Short cache so we retry live soon
      cache.set(key, fb, 90);
      return fb;
    } finally {
      inflightSentry.delete(key);
    }
  })();

  inflightSentry.set(key, load);
  return load;
}

export function detailFromWatchItem(
  item: SentryWatchItem,
  reason: string
): SentryDetail {
  return {
    found: true,
    des: item.des,
    fullname: item.fullname,
    ip: item.ip,
    psCum: item.psCum,
    tsMax: item.tsMax,
    diameterKm: item.diameterKm,
    nImp: item.nImp,
    note: SENTRY_EDU_NOTE,
    degraded: true,
    degradedReason: reason,
    message: "Detail from watchlist summary (live CNEOS mode-O unavailable)",
  };
}

export function findWatchItemByDes(des: string): SentryWatchItem | null {
  const q = des.toLowerCase().replace(/[()]/g, "").trim();
  const pools: SentryWatchItem[] = [
    ...(lastGoodSentry?.items ?? []),
    ...SENTRY_FALLBACK_ITEMS,
  ];
  return (
    pools.find(
      (it) =>
        it.des.toLowerCase() === q ||
        it.des.toLowerCase().replace(/[()]/g, "") === q ||
        it.fullname.toLowerCase().includes(q)
    ) ?? null
  );
}

