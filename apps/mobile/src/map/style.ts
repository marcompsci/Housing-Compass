import { formatUsd, type SearchHit } from "@housing-compass/core";
import { useEffect, useState } from "react";
import { config } from "../config";
import counties from "./bayAreaCounties.json";

/** MapLibre style JSON (kept loose to share between maplibre-gl and maplibre-react-native). */
export type MapStyle = Record<string, unknown>;

/**
 * Offline fallback basemap: generalized county shapes (US Census via us-atlas).
 * Used when the configured tile server cannot be reached, so the map still orients the user.
 */
export const OFFLINE_STYLE: MapStyle = {
  version: 8,
  name: "housing-compass-offline",
  sources: { counties: { type: "geojson", data: counties } },
  layers: [
    { id: "water", type: "background", paint: { "background-color": "#CFE3EA" } },
    { id: "land-near", type: "fill", source: "counties", filter: ["==", ["get", "bay"], false], paint: { "fill-color": "#ECE8DF" } },
    { id: "land-bay", type: "fill", source: "counties", filter: ["==", ["get", "bay"], true], paint: { "fill-color": "#F8F6F1" } },
    { id: "county-lines", type: "line", source: "counties", paint: { "line-color": "#C9C1B2", "line-width": 1 } },
  ],
};

export type StyleState = { style: string | MapStyle; offline: boolean; attribution: string };

const ONLINE_ATTRIBUTION = "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors";
const OFFLINE_ATTRIBUTION = "county outlines © US Census Bureau (us-atlas)";

/** Probe the remote style once; fall back to the offline style if it fails. */
export function useMapStyle(): StyleState {
  const [state, setState] = useState<StyleState>({ style: OFFLINE_STYLE, offline: true, attribution: OFFLINE_ATTRIBUTION });
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch(config.mapStyleUrl, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(() => {
        if (!cancelled) setState({ style: config.mapStyleUrl, offline: false, attribution: ONLINE_ATTRIBUTION });
      })
      .catch(() => {
        /* keep offline style */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);
  return state;
}

export interface PinModel {
  id: string;
  lng: number;
  lat: number;
  label: string;
  tone: "official" | "verified" | "unverified" | "demo";
}

export interface AreaModel {
  key: string;
  city: string;
  lng: number;
  lat: number;
  count: number;
  fromCents: number;
}

/** Exact pins for geocoded listings; ONE dashed area marker per city for city-level (approximate) leads. */
export function toMapModels(hits: SearchHit[]): { pins: PinModel[]; areas: AreaModel[] } {
  const pins: PinModel[] = [];
  const areas = new Map<string, AreaModel>();
  for (const h of hits) {
    const l = h.listing;
    if (l.location.precision === "city_approx") {
      const key = l.address.city;
      const a = areas.get(key) ?? { key, city: key, lng: l.location.lng, lat: l.location.lat, count: 0, fromCents: Number.POSITIVE_INFINITY };
      a.count += 1;
      a.fromCents = Math.min(a.fromCents, l.pricing.baseRentCents);
      areas.set(key, a);
      continue;
    }
    const tone: PinModel["tone"] = l.isDemo
      ? "demo"
      : l.verification.level === "OFFICIAL_PORTAL"
        ? "official"
        : l.verification.level === "PROPERTY_MANAGER_VERIFIED"
          ? "verified"
          : "unverified";
    pins.push({ id: l.id, lng: l.location.lng, lat: l.location.lat, label: formatUsd(l.pricing.baseRentCents) + (l.pricing.qualifier === "STARTING_AT" ? "+" : ""), tone });
  }
  return { pins, areas: [...areas.values()] };
}

export const PIN_COLORS: Record<PinModel["tone"], { bg: string; fg: string; border: string }> = {
  official: { bg: "#1D4BB0", fg: "#fff", border: "#fff" },
  verified: { bg: "#0B6E5F", fg: "#fff", border: "#fff" },
  unverified: { bg: "#FFF3D6", fg: "#8A4F00", border: "#E9B949" },
  demo: { bg: "#6A3FA0", fg: "#fff", border: "#fff" },
};

export interface ListingsMapProps {
  hits: SearchHit[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelectListing(id: string): void;
  onSelectArea(city: string): void;
}
