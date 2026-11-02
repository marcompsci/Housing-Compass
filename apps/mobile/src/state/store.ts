import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BAY_AREA_CENTER, DEFAULT_FILTERS, clampBudget, coarsen, type BudgetPrefs, type Category, type LatLng, type RegionId, type SearchFilters } from "@housing-compass/core";
import { config } from "../config";

export interface SearchArea {
  label: string;
  /** Always coarsened (~1 km). Raw GPS fixes are never stored. */
  center: LatLng;
  source: "default" | "device" | "city" | "zip" | "region";
  inBayArea: boolean;
  /** Supported search region for this area; null = outside coverage (link-outs only). */
  region?: RegionId | null;
}

export interface LocalReport {
  id: string;
  listingId: string;
  reason: string;
  details: string;
  createdAt: string;
  syncedAt?: string | null;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  area: SearchArea;
  createdAt: string;
  serverId?: string | null;
  alertsEnabled?: boolean;
  lastAlertedAt?: string | null;
}

interface State {
  area: SearchArea;
  filters: SearchFilters;
  view: "list" | "map";
  favorites: string[];
  compare: string[];
  savedSearches: SavedSearch[];
  reports: LocalReport[];
  unverifiedWarningAcknowledged: boolean;
  setArea(a: Omit<SearchArea, "center"> & { center: LatLng }): void;
  setCategory(c: Category): void;
  patchFilters(p: Partial<SearchFilters>): void;
  setBudget(b: BudgetPrefs): void;
  resetFilters(): void;
  setView(v: "list" | "map"): void;
  toggleFavorite(id: string): void;
  toggleCompare(id: string): "added" | "removed" | "full";
  clearCompare(): void;
  saveSearch(name: string): void;
  deleteSearch(id: string): void;
  applySearch(id: string): void;
  addReport(r: Omit<LocalReport, "id" | "createdAt">): void;
  acknowledgeUnverified(): void;
  markSearchSynced(localId: string, serverId: string): void;
  markReportSynced(id: string): void;
  toggleSearchAlerts(id: string): void;
  readNotifications: string[];
  markNotificationRead(key: string): void;
}

const DEFAULT_AREA: SearchArea = { label: "San Francisco Bay Area", center: BAY_AREA_CENTER, source: "default", inBayArea: true, region: "bay_area" };

const initialFilters: SearchFilters = { ...DEFAULT_FILTERS, includeDemo: config.demoMode };

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      area: DEFAULT_AREA,
      filters: initialFilters,
      view: "list",
      favorites: [],
      compare: [],
      savedSearches: [],
      reports: [],
      unverifiedWarningAcknowledged: false,
      setArea: (a) => {
        const region = a.region === undefined ? (a.inBayArea ? "bay_area" : null) : a.region;
        // Region-wide picks search the whole region; a city/ZIP/device pick sorts by distance within it.
        const center = a.source === "region" || a.source === "default" ? null : coarsen(a.center);
        set({ area: { ...a, region, center: coarsen(a.center) }, filters: { ...get().filters, region: region ?? "bay_area", center } });
      },
      setCategory: (category) => set({ filters: { ...get().filters, category } }),
      patchFilters: (p) => set({ filters: { ...get().filters, ...p } }),
      setBudget: (b) => set({ filters: { ...get().filters, budget: clampBudget(b) } }),
      resetFilters: () => set({ filters: { ...initialFilters, category: get().filters.category, center: get().filters.center } }),
      setView: (view) => set({ view }),
      toggleFavorite: (id) => {
        const f = get().favorites;
        set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
      },
      toggleCompare: (id) => {
        const c = get().compare;
        if (c.includes(id)) {
          set({ compare: c.filter((x) => x !== id) });
          return "removed";
        }
        if (c.length >= 3) return "full";
        set({ compare: [...c, id] });
        return "added";
      },
      clearCompare: () => set({ compare: [] }),
      saveSearch: (name) =>
        set({ savedSearches: [{ id: uid(), name, filters: get().filters, area: get().area, createdAt: new Date().toISOString() }, ...get().savedSearches].slice(0, 20) }),
      deleteSearch: (id) => set({ savedSearches: get().savedSearches.filter((s) => s.id !== id) }),
      applySearch: (id) => {
        const s = get().savedSearches.find((x) => x.id === id);
        if (s) set({ filters: { ...s.filters, includeDemo: config.demoMode }, area: s.area });
      },
      addReport: (r) => set({ reports: [{ ...r, id: uid(), createdAt: new Date().toISOString() }, ...get().reports] }),
      acknowledgeUnverified: () => set({ unverifiedWarningAcknowledged: true }),
      markSearchSynced: (localId, serverId) => set({ savedSearches: get().savedSearches.map((x) => (x.id === localId ? { ...x, serverId } : x)) }),
      readNotifications: [],
      markNotificationRead: (key) => set({ readNotifications: [...new Set([...get().readNotifications, key])].slice(-500) }),
      toggleSearchAlerts: (id) => set({ savedSearches: get().savedSearches.map((x) => (x.id === id ? { ...x, alertsEnabled: !x.alertsEnabled, lastAlertedAt: x.lastAlertedAt ?? new Date().toISOString() } : x)) }),
      markReportSynced: (id) => set({ reports: get().reports.map((r) => (r.id === id ? { ...r, syncedAt: new Date().toISOString() } : r)) }),
    }),
    {
      name: "housing-compass-v1",
      storage: createJSONStorage(() => AsyncStorage),
      // Demo visibility always follows the build's config, never a stale persisted value.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, filters: { ...current.filters, ...(p.filters ?? {}), includeDemo: config.demoMode } };
      },
      // Persist preferences and lists only; the search area is re-chosen each session (minimum location retention).
      partialize: (s) => ({
        filters: { ...s.filters, center: null, commuteTo: null },
        view: s.view,
        favorites: s.favorites,
        compare: s.compare,
        savedSearches: s.savedSearches.map((x) => ({ ...x, filters: { ...x.filters, commuteTo: null } })),
        reports: s.reports,
        unverifiedWarningAcknowledged: s.unverifiedWarningAcknowledged,
        readNotifications: s.readNotifications,
      }),
    },
  ),
);
