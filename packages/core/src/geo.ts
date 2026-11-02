/** Geography helpers. City centroids are approximate and used only for city-level pins. */

export interface LatLng {
  lat: number;
  lng: number;
}

export type RegionId = "bay_area" | "la_city" | "la_county";

export interface Place extends LatLng {
  name: string;
  county: string;
  state: "CA";
  /** Search region. la_city places are also inside la_county. */
  region?: RegionId;
}

export interface Region {
  id: RegionId;
  label: string;
  center: LatLng;
  zoom: number;
  /** Regions whose listings this region includes (LA County includes the City of LA). */
  includes: RegionId[];
}

export const REGIONS: Record<RegionId, Region> = {
  bay_area: { id: "bay_area", label: "San Francisco Bay Area", center: { lat: 37.77, lng: -122.25 }, zoom: 8.6, includes: ["bay_area"] },
  la_city: { id: "la_city", label: "City of Los Angeles", center: { lat: 34.05, lng: -118.33 }, zoom: 9.4, includes: ["la_city"] },
  la_county: { id: "la_county", label: "Los Angeles County", center: { lat: 34.08, lng: -118.22 }, zoom: 8.6, includes: ["la_city", "la_county"] },
};

/** Approximate city-center coordinates (public reference values). */
export const BAY_AREA_CITIES: Place[] = [
  { name: "San Francisco", county: "San Francisco", lat: 37.7749, lng: -122.4194, state: "CA" },
  { name: "Oakland", county: "Alameda", lat: 37.8044, lng: -122.2712, state: "CA" },
  { name: "Berkeley", county: "Alameda", lat: 37.8715, lng: -122.273, state: "CA" },
  { name: "Alameda", county: "Alameda", lat: 37.7652, lng: -122.2416, state: "CA" },
  { name: "Emeryville", county: "Alameda", lat: 37.8313, lng: -122.2852, state: "CA" },
  { name: "San Leandro", county: "Alameda", lat: 37.7249, lng: -122.1561, state: "CA" },
  { name: "Hayward", county: "Alameda", lat: 37.6688, lng: -122.0808, state: "CA" },
  { name: "Fremont", county: "Alameda", lat: 37.5485, lng: -121.9886, state: "CA" },
  { name: "Union City", county: "Alameda", lat: 37.5934, lng: -122.0439, state: "CA" },
  { name: "Richmond", county: "Contra Costa", lat: 37.9358, lng: -122.3477, state: "CA" },
  { name: "Concord", county: "Contra Costa", lat: 37.978, lng: -122.0311, state: "CA" },
  { name: "Walnut Creek", county: "Contra Costa", lat: 37.9101, lng: -122.0652, state: "CA" },
  { name: "Antioch", county: "Contra Costa", lat: 38.0049, lng: -121.8058, state: "CA" },
  { name: "Pittsburg", county: "Contra Costa", lat: 38.028, lng: -121.8847, state: "CA" },
  { name: "Daly City", county: "San Mateo", lat: 37.6879, lng: -122.4702, state: "CA" },
  { name: "South San Francisco", county: "San Mateo", lat: 37.6547, lng: -122.4077, state: "CA" },
  { name: "San Mateo", county: "San Mateo", lat: 37.563, lng: -122.3255, state: "CA" },
  { name: "Redwood City", county: "San Mateo", lat: 37.4852, lng: -122.2364, state: "CA" },
  { name: "Palo Alto", county: "Santa Clara", lat: 37.4419, lng: -122.143, state: "CA" },
  { name: "Mountain View", county: "Santa Clara", lat: 37.3861, lng: -122.0839, state: "CA" },
  { name: "Sunnyvale", county: "Santa Clara", lat: 37.3688, lng: -122.0363, state: "CA" },
  { name: "Santa Clara", county: "Santa Clara", lat: 37.3541, lng: -121.9552, state: "CA" },
  { name: "San Jose", county: "Santa Clara", lat: 37.3382, lng: -121.8863, state: "CA" },
  { name: "Milpitas", county: "Santa Clara", lat: 37.4323, lng: -121.8996, state: "CA" },
  { name: "Vallejo", county: "Solano", lat: 38.1041, lng: -122.2566, state: "CA" },
  { name: "Fairfield", county: "Solano", lat: 38.2494, lng: -122.04, state: "CA" },
  { name: "Vacaville", county: "Solano", lat: 38.3566, lng: -121.9877, state: "CA" },
  { name: "San Rafael", county: "Marin", lat: 37.9735, lng: -122.5311, state: "CA" },
  { name: "Napa", county: "Napa", lat: 38.2975, lng: -122.2869, state: "CA" },
  { name: "Santa Rosa", county: "Sonoma", lat: 38.4404, lng: -122.7141, state: "CA" },
];

/**
 * Los Angeles places (approximate centers). Neighborhoods inside the City of LA
 * (Pacoima, North Hollywood, …) are listed so research addresses that name them
 * land in the right area; they belong to region la_city.
 */
export const LA_PLACES: Place[] = [
  { name: "Los Angeles", county: "Los Angeles", lat: 34.0522, lng: -118.2437, state: "CA", region: "la_city" },
  { name: "Pacoima", county: "Los Angeles", lat: 34.2622, lng: -118.427, state: "CA", region: "la_city" },
  { name: "North Hollywood", county: "Los Angeles", lat: 34.187, lng: -118.3813, state: "CA", region: "la_city" },
  { name: "Sherman Oaks", county: "Los Angeles", lat: 34.1508, lng: -118.449, state: "CA", region: "la_city" },
  { name: "Chatsworth", county: "Los Angeles", lat: 34.2572, lng: -118.6012, state: "CA", region: "la_city" },
  { name: "San Pedro", county: "Los Angeles", lat: 33.7361, lng: -118.2922, state: "CA", region: "la_city" },
  { name: "Hollywood", county: "Los Angeles", lat: 34.0928, lng: -118.3287, state: "CA", region: "la_city" },
  { name: "Koreatown", county: "Los Angeles", lat: 34.0618, lng: -118.3004, state: "CA", region: "la_city" },
  { name: "East Los Angeles", county: "Los Angeles", lat: 34.0239, lng: -118.172, state: "CA", region: "la_county" },
  { name: "Long Beach", county: "Los Angeles", lat: 33.7701, lng: -118.1937, state: "CA", region: "la_county" },
  { name: "San Dimas", county: "Los Angeles", lat: 34.1067, lng: -117.8067, state: "CA", region: "la_county" },
  { name: "La Puente", county: "Los Angeles", lat: 34.02, lng: -117.9495, state: "CA", region: "la_county" },
  { name: "Alhambra", county: "Los Angeles", lat: 34.0953, lng: -118.127, state: "CA", region: "la_county" },
  { name: "Santa Clarita", county: "Los Angeles", lat: 34.3917, lng: -118.5426, state: "CA", region: "la_county" },
  { name: "Pasadena", county: "Los Angeles", lat: 34.1478, lng: -118.1445, state: "CA", region: "la_county" },
  { name: "Glendale", county: "Los Angeles", lat: 34.1425, lng: -118.2551, state: "CA", region: "la_county" },
  { name: "Burbank", county: "Los Angeles", lat: 34.1808, lng: -118.309, state: "CA", region: "la_county" },
  { name: "Inglewood", county: "Los Angeles", lat: 33.9617, lng: -118.3531, state: "CA", region: "la_county" },
  { name: "Santa Monica", county: "Los Angeles", lat: 34.0195, lng: -118.4912, state: "CA", region: "la_county" },
  { name: "Torrance", county: "Los Angeles", lat: 33.8358, lng: -118.3406, state: "CA", region: "la_county" },
  { name: "Pomona", county: "Los Angeles", lat: 34.0551, lng: -117.75, state: "CA", region: "la_county" },
  { name: "Lancaster", county: "Los Angeles", lat: 34.6868, lng: -118.1542, state: "CA", region: "la_county" },
  { name: "Palmdale", county: "Los Angeles", lat: 34.5794, lng: -118.1165, state: "CA", region: "la_county" },
  { name: "Compton", county: "Los Angeles", lat: 33.8958, lng: -118.2201, state: "CA", region: "la_county" },
  { name: "Downey", county: "Los Angeles", lat: 33.9401, lng: -118.1332, state: "CA", region: "la_county" },
  { name: "El Monte", county: "Los Angeles", lat: 34.0686, lng: -118.0276, state: "CA", region: "la_county" },
  { name: "West Covina", county: "Los Angeles", lat: 34.0686, lng: -117.939, state: "CA", region: "la_county" },
  { name: "Whittier", county: "Los Angeles", lat: 33.9792, lng: -118.0328, state: "CA", region: "la_county" },
];

for (const p of BAY_AREA_CITIES) p.region = "bay_area";
export const ALL_PLACES: Place[] = [...BAY_AREA_CITIES, ...LA_PLACES];

const BAY_COUNTIES = new Set(["Alameda", "Contra Costa", "Marin", "Napa", "San Francisco", "San Mateo", "Santa Clara", "Solano", "Sonoma"]);

/** Region of an address: the named place if we know it, else by county. */
export function regionOf(address: { city: string; county: string | null }): RegionId | null {
  const p = findCity(address.city);
  if (p?.region) return p.region;
  if (address.county && BAY_COUNTIES.has(address.county)) return "bay_area";
  if (address.county === "Los Angeles") return "la_county";
  return null;
}

export function inRegion(address: { city: string; county: string | null }, region: RegionId): boolean {
  const r = regionOf(address);
  return r !== null && REGIONS[region].includes.includes(r);
}

/** Which supported region (if any) contains a point — nearest region center within ~120 km. */
export function regionForPoint(p: LatLng): RegionId | null {
  if (haversineKm(p, REGIONS.bay_area.center) < 120) return "bay_area";
  if (haversineKm(p, REGIONS.la_county.center) < 110) return "la_county";
  return null;
}

export const BAY_AREA_CENTER: LatLng = { lat: 37.77, lng: -122.25 };

export function findCity(name: string): Place | undefined {
  const n = name.trim().toLowerCase();
  return ALL_PLACES.find((c) => c.name.toLowerCase() === n);
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const kmToMiles = (km: number) => km * 0.621371;

/**
 * Coarsen a device location before it is kept anywhere (≈1.1 km grid at 2 decimals).
 * The raw fix is used in-memory for the current search only.
 */
export function coarsen(p: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

export function isUsZip(s: string): boolean {
  return /^\d{5}$/.test(s.trim());
}

import CA_ZIPS from "./data/ca-zips.json";

/** Approximate ZIP centroid lookup (California only in v1; other states need a geocoder — Phase 3). */
export function lookupZip(zip: string): (LatLng & { city: string; zip: string }) | undefined {
  const z = zip.trim();
  const row = (CA_ZIPS as Array<[string, number, number, string]>).find((r) => r[0] === z);
  if (!row) return undefined;
  const city = row[3].replace(/\b\w+/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
  return { zip: row[0], lat: row[1], lng: row[2], city };
}
