/**
 * Travel-time ESTIMATES. We have no routing provider or transit feed yet, so this turns
 * straight-line distance into a deliberately wide range and always says it is an estimate.
 * For a real route, we hand off to Apple Maps / Google Maps (they do the routing, not us).
 */
import { haversineKm, type LatLng } from "./geo";

export type TravelMode = "walk" | "bike" | "transit" | "drive";
export const TRAVEL_MODES: TravelMode[] = ["transit", "walk", "bike", "drive"];

/** Real routes are longer than the straight line. */
const DETOUR = 1.35;
/** km/h ranges, slowest → fastest, for urban Bay Area / LA trips. Transit includes waiting and transfers. */
const SPEED_KMH: Record<TravelMode, [number, number]> = {
  walk: [4.2, 5.2],
  bike: [11, 16],
  transit: [10, 22],
  drive: [18, 40],
};
/** Fixed overhead in minutes (walking to the stop, parking, etc.). */
const OVERHEAD_MIN: Record<TravelMode, [number, number]> = { walk: [0, 0], bike: [2, 4], transit: [8, 15], drive: [3, 8] };

export interface TravelEstimate {
  mode: TravelMode;
  minMinutes: number;
  maxMinutes: number;
  straightLineKm: number;
  /** One endpoint is a city/ZIP centroid, so the estimate is even rougher. */
  approximateEndpoint: boolean;
  label: string;
}

const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

export function estimateTravel(from: LatLng, to: LatLng, mode: TravelMode, opts: { approximateEndpoint?: boolean } = {}): TravelEstimate {
  const km = haversineKm(from, to);
  const road = km * DETOUR;
  const [slow, fast] = SPEED_KMH[mode];
  const [oMin, oMax] = OVERHEAD_MIN[mode];
  let minMinutes = round5((road / fast) * 60 + oMin);
  let maxMinutes = round5((road / slow) * 60 + oMax);
  if (opts.approximateEndpoint) maxMinutes = round5(maxMinutes * 1.3 + 5);
  if (maxMinutes <= minMinutes) maxMinutes = minMinutes + 5;
  const fmt = (m: number) => (m >= 120 ? `${Math.round(m / 6) / 10} h` : `${m} min`);
  return {
    mode,
    minMinutes,
    maxMinutes,
    straightLineKm: km,
    approximateEndpoint: !!opts.approximateEndpoint,
    label: `about ${fmt(minMinutes)}–${fmt(maxMinutes)} (estimate)`,
  };
}

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = { walk: "Walking", bike: "Biking", transit: "Transit", drive: "Driving" };

const ll = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/** Open real directions in a maps app. Coordinates only — no names, no user identifiers. */
export function directionsUrl(provider: "apple" | "google", from: LatLng, to: LatLng, mode: TravelMode): string {
  if (provider === "apple") {
    const flag = { walk: "w", bike: "b", transit: "r", drive: "d" }[mode];
    return `https://maps.apple.com/?saddr=${ll(from)}&daddr=${ll(to)}&dirflg=${flag}`;
  }
  const gm = { walk: "walking", bike: "bicycling", transit: "transit", drive: "driving" }[mode];
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(from)}&destination=${ll(to)}&travelmode=${gm}`;
}
