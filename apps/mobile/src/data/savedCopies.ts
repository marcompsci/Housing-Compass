/**
 * Offline copies of SAVED homes, so their details open without a connection. Copies are
 * re-validated with the schema and re-checked for staleness when read, so an offline copy can
 * never show something the live app would hide. Unsaving a home deletes its copy.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseDocuments, type Listing } from "@housing-compass/core";
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStore } from "../state/store";
import { useListingCache } from "./hooks";
import { withExpiry } from "./repository";

interface CopiesState {
  docs: Record<string, { at: string; doc: unknown }>;
  sync(listings: Listing[], keep: string[]): void;
}

export const useSavedCopies = create<CopiesState>()(
  persist(
    (set, get) => ({
      docs: {},
      sync: (listings, keep) => {
        const keepSet = new Set(keep);
        const next: CopiesState["docs"] = {};
        for (const [id, v] of Object.entries(get().docs)) if (keepSet.has(id)) next[id] = v;
        for (const l of listings) if (keepSet.has(l.id) && !l.isDemo) next[l.id] = { at: new Date().toISOString(), doc: l };
        if (JSON.stringify(Object.keys(next).sort()) === JSON.stringify(Object.keys(get().docs).sort()) && listings.every((l) => !keepSet.has(l.id) || l.isDemo || JSON.stringify(get().docs[l.id]?.doc) === JSON.stringify(l))) return;
        set({ docs: next });
      },
    }),
    { name: "housing-compass-saved-copies-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Re-validated, staleness-checked saved copy (or null). */
export function savedCopy(id: string): { listing: Listing; at: string } | null {
  const c = useSavedCopies.getState().docs[id];
  if (!c) return null;
  const parsed = parseDocuments([c.doc]).listings[0];
  if (!parsed) return null;
  return { listing: withExpiry([parsed]).listings[0]!, at: c.at };
}

/** Mount once: keep copies of saved homes in step with what the app has loaded. */
export function useSavedCopyWatcher() {
  const favorites = useStore((s) => s.favorites);
  const byId = useListingCache((s) => s.byId);
  const sync = useSavedCopies((s) => s.sync);
  useEffect(() => {
    sync(favorites.map((id) => byId[id]).filter((l): l is Listing => !!l), favorites);
  }, [favorites, byId, sync]);
}
