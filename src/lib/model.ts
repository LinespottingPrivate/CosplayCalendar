import type { Convention } from "@/data/conventions";

export type Placement = "none" | "finalist" | "third" | "second" | "first";
export type Division = "novice" | "journeyman" | "master";
export type TravelMode = "auto" | "flight" | "rail" | "drive";
export type LegMode = "flight" | "rail" | "drive";

export type PastResult = {
  id: string;
  label: string;
  placement: Placement;
};

export type Score = {
  pFirst: number;
  pSecond: number;
  pThird: number;
  pTop: number;
  expected: number;
  field: number;
  skill: number;
};

export type Trip = {
  km: number;
  mode: LegMode;
  hours: number;
  travelUsd: number;
  nights: number;
  badge: number;
  hotel: number;
  food: number;
  total: number;
  leaveBy: Date;
};

const PLACE_RANK: Record<Placement, number> = {
  first: 5,
  second: 4,
  third: 3,
  finalist: 2,
  none: 1,
};

const DIVISION: Record<Division, number> = {
  novice: 0.55,
  journeyman: 0,
  master: -0.8,
};

const BEST: Record<Placement, number> = {
  none: 0,
  finalist: 0.08,
  third: 0.18,
  second: 0.28,
  first: 0.4,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

function inEurope(lat: number, lng: number) {
  return lat > 35 && lat < 72 && lng > -12 && lng < 40;
}

export function chooseMode(
  km: number,
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  pref: TravelMode,
): LegMode {
  if (pref !== "auto") return pref;
  const bothEu = inEurope(origin.lat, origin.lng) && inEurope(dest.lat, dest.lng);
  if (bothEu && km < 900) return "rail";
  if (km < 700) return "drive";
  return "flight";
}

function leg(mode: LegMode, km: number) {
  if (mode === "rail") {
    return { hours: 0.8 + km / 130, oneWay: 22 + km * 0.12 };
  }
  if (mode === "drive") {
    return { hours: 0.4 + km / 85, oneWay: km * 0.2 };
  }
  return { hours: 4.2 + km / 800, oneWay: Math.max(90, 55 + km * 0.09) };
}

export function planTrip(
  origin: { lat: number; lng: number },
  event: Convention,
  pref: TravelMode,
  perDiem: number,
): Trip {
  const km = haversineKm(origin.lat, origin.lng, event.lat, event.lng);
  const mode = chooseMode(km, origin, event, pref);
  const one = leg(mode, km);
  const span = Math.max(
    1,
    Math.round(
      (Date.parse(event.end) - Date.parse(event.start)) / 86_400_000,
    ),
  );
  const nights = span + (one.hours > 6 ? 1 : 0);
  const travelUsd = Math.round(one.oneWay * 2);
  const hotel = nights * event.hotelPerNightUsd;
  const food = Math.round(nights * perDiem);
  const badge = event.badgePriceUsd;
  const leaveBy =
    one.hours > 6
      ? new Date(`${shiftDay(event.start, -1)}T07:30:00`)
      : new Date(Date.parse(`${event.start}T09:00:00`) - (Math.ceil(one.hours) + 3) * 3_600_000);
  return {
    km: Math.round(km),
    mode,
    hours: Math.round(one.hours * 10) / 10,
    travelUsd,
    nights,
    badge,
    hotel,
    food,
    total: travelUsd + hotel + food + badge,
    leaveBy,
  };
}

function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function scoreEvent(input: {
  craft: number;
  stage: number;
  results: PastResult[];
  division: Division;
  heat: number;
  grandPrize: number | null;
}): Score {
  const craft = clamp(input.craft, 0, 100);
  const stage = clamp(input.stage, 0, 100);
  const heat = clamp(input.heat, 1, 10);
  const entries = input.results.length;
  const wins = input.results.filter((r) => r.placement === "first").length;
  const best = input.results.reduce<Placement>(
    (top, r) => (PLACE_RANK[r.placement] > PLACE_RANK[top] ? r.placement : top),
    "none",
  );
  const zC = (craft - 50) / 10;
  const zS = (stage - 50) / 10;
  const wr = (wins + 0.25) / (entries + 4);
  const s =
    0.28 * zC +
    0.16 * zS +
    DIVISION[input.division] -
    0.15 * (heat - 5) +
    0.1 * Math.log(1 + entries) +
    1.2 * (wr - 0.0625) +
    BEST[best];
  const field = Math.max(8, Math.round(4 + heat * 5));
  const m = field - 1;
  const w = Math.exp(s);
  const pFirst = w / (w + m);
  const pSecond = m >= 1 ? (m * w) / ((m + w) * (m + w - 1)) : 0;
  const pThird =
    m >= 2 ? (m * (m - 1) * w) / ((m + w) * (m + w - 1) * (m + w - 2)) : 0;
  const g = input.grandPrize ?? 0;
  const expected =
    g <= 0 ? 0 : g * (pFirst + 0.4 * pSecond + 0.2 * pThird);
  return {
    pFirst,
    pSecond,
    pThird,
    pTop: pFirst + pSecond + pThird,
    expected,
    field,
    skill: s,
  };
}
