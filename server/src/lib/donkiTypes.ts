export type DonkiSolarBadge = {
  active: boolean;
  level: "quiet" | "elevated" | "storm";
  label: string;
  detail: string;
  flares24h: number;
  gstMaxKp: number | null;
  source: "NASA DONKI" | "NASA DONKI (unavailable)";
  degraded?: boolean;
};
