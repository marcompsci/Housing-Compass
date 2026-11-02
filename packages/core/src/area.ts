/**
 * Draw-an-area search. A user taps 3–20 points on the map; listings inside the polygon match.
 * The ring is stored as LatLng[] (not closed). Only precise pins are matched by default:
 * a city-centroid pin can't honestly be said to be "inside" a hand-drawn block.
 */
import type { LatLng } from "./geo";
import type { Listing } from "./schema";

export const AREA_MIN_POINTS = 3;
export const AREA_MAX_POINTS = 20;
/** Larger than this (≈ a whole county) is almost always a mis-drawn shape. */
export const AREA_MAX_KM2 = 5000;

/** Ray casting; points exactly on an edge count as inside. */
export function pointInPolygon(p: LatLng, ring: LatLng[]): boolean {
  if (ring.length < AREA_MIN_POINTS) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (onSegment(p, a, b)) return true;
    const crosses = a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

function onSegment(p: LatLng, a: LatLng, b: LatLng): boolean {
  const cross = (p.lat - a.lat) * (b.lng - a.lng) - (p.lng - a.lng) * (b.lat - a.lat);
  if (Math.abs(cross) > 1e-12) return false;
  return Math.min(a.lng, b.lng) - 1e-12 <= p.lng && p.lng <= Math.max(a.lng, b.lng) + 1e-12 && Math.min(a.lat, b.lat) - 1e-12 <= p.lat && p.lat <= Math.max(a.lat, b.lat) + 1e-12;
}

/** Approximate area (km²) using an equirectangular projection around the ring's mean latitude. */
export function polygonAreaKm2(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + p.lat, 0) / ring.length) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(lat0);
  const ky = 110.574;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.lng * kx * (b.lat * ky) - b.lng * kx * (a.lat * ky);
  }
  return Math.abs(sum) / 2;
}

function segmentsIntersect(p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng): boolean {
  const d = (a: LatLng, b: LatLng, c: LatLng) => (c.lng - a.lng) * (b.lat - a.lat) - (b.lng - a.lng) * (c.lat - a.lat);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export type AreaProblem = "too_few_points" | "too_many_points" | "self_intersecting" | "too_large" | "too_small";

export function validateArea(ring: LatLng[]): AreaProblem | null {
  if (ring.length < AREA_MIN_POINTS) return "too_few_points";
  if (ring.length > AREA_MAX_POINTS) return "too_many_points";
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they share a vertex)
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(ring[i]!, ring[(i + 1) % n]!, ring[j]!, ring[(j + 1) % n]!)) return "self_intersecting";
    }
  }
  const km2 = polygonAreaKm2(ring);
  if (km2 > AREA_MAX_KM2) return "too_large";
  if (km2 < 0.01) return "too_small";
  return null;
}

export const AREA_PROBLEM_TEXT: Record<AreaProblem, string> = {
  too_few_points: "Tap at least 3 points to make an area.",
  too_many_points: `Use ${AREA_MAX_POINTS} points or fewer.`,
  self_intersecting: "The edges cross each other. Clear and draw the outline in order.",
  too_large: "That area is very large. Draw a smaller one, or search the whole region instead.",
  too_small: "That area is too small to contain homes.",
};

/** Whether a listing's pin can be placed inside a drawn area. Approximate pins are excluded unless asked. */
export function listingInArea(l: Listing, ring: LatLng[], includeApproximate = false): boolean {
  const approx = l.location.precision === "city_approx" || l.location.precision === "zip_approx";
  if (approx && !includeApproximate) return false;
  return pointInPolygon(l.location, ring);
}

/** GeoJSON Polygon (closed ring, [lng, lat]) — the shape the database and map layers expect. */
export function areaToGeoJSON(ring: LatLng[]): { type: "Polygon"; coordinates: [number, number][][] } {
  const coords = ring.map((p) => [round6(p.lng), round6(p.lat)] as [number, number]);
  if (coords.length) coords.push(coords[0]!);
  return { type: "Polygon", coordinates: [coords] };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function areaCentroid(ring: LatLng[]): LatLng | null {
  if (!ring.length) return null;
  return { lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length, lng: ring.reduce((s, p) => s + p.lng, 0) / ring.length };
}
