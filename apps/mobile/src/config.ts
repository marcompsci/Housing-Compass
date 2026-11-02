/**
 * Runtime configuration. Only EXPO_PUBLIC_* values reach the client bundle —
 * never put secrets (service-role keys, API secrets) here.
 */
export const config = {
  /** Demo mode loads clearly labeled fictional listings. Default ON until Phase 4 ingests real verified inventory. */
  demoMode: (process.env.EXPO_PUBLIC_DEMO_MODE ?? "true") === "true",
  /** MapLibre style URL. Default: OpenFreeMap (no key, OSM data). Falls back to an offline county basemap. */
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Fixed clock for screenshots/e2e (ISO string). Leave unset in real use. */
  fixedNow: process.env.EXPO_PUBLIC_FIXED_NOW ?? "",
};

export function now(): Date {
  return config.fixedNow ? new Date(config.fixedNow) : new Date();
}
