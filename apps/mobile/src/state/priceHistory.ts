/**
 * On-device price history for SAVED homes only (minimum retention: unsaving a home drops its
 * history). Signed-in users also get the server's price_history; this keeps alerts working offline.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { observePrices, pruneHistory, type Listing, type PriceChange, type PriceObservation } from "@housing-compass/core";
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { now } from "../config";
import { useListingCache } from "../data/hooks";
import { useStore } from "./store";

interface PriceState {
  history: Record<string, PriceObservation[]>;
  changes: PriceChange[];
  observe(listings: Listing[], keepIds: string[]): void;
  clear(): void;
}

export const usePriceHistory = create<PriceState>()(
  persist(
    (set, get) => ({
      history: {},
      changes: [],
      observe: (listings, keepIds) => {
        const keep = new Set(keepIds);
        const { history, changes } = observePrices(get().history, listings.filter((l) => keep.has(l.id)), now());
        const pruned = pruneHistory(history, keepIds);
        if (!changes.length && JSON.stringify(pruned) === JSON.stringify(get().history)) return;
        set({
          history: pruneHistory(history, keepIds),
          changes: [...get().changes, ...changes].filter((c) => keep.has(c.listingId)).slice(-50),
        });
      },
      clear: () => set({ history: {}, changes: [] }),
    }),
    { name: "housing-compass-price-history-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Mount once: whenever saved homes are (re)loaded, record any price change we see. */
export function usePriceWatcher() {
  const favorites = useStore((s) => s.favorites);
  const byId = useListingCache((s) => s.byId);
  const observe = usePriceHistory((s) => s.observe);
  useEffect(() => {
    const listings = favorites.map((id) => byId[id]).filter((l): l is Listing => !!l);
    observe(listings, favorites);
  }, [favorites, byId, observe]);
}
