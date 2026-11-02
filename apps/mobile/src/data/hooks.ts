import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseDocuments, search, type Listing, type SearchFilters, type SearchResult } from "@housing-compass/core";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { log } from "../lib/log";
import { repository, withExpiry } from "./repository";

/** In-memory cache of every listing the app has loaded, so Saved/Compare/detail render instantly. */
export const useListingCache = create<{ byId: Record<string, Listing>; put(ls: Listing[]): void }>((set, get) => ({
  byId: {},
  put: (ls) => set({ byId: { ...get().byId, ...Object.fromEntries(ls.map((l) => [l.id, l])) } }),
}));

/**
 * Offline fallback: the last 5 successful candidate sets, keyed by category. Re-validated with
 * the schema on read and re-checked for staleness by core.search's caller, so a cached copy can
 * never show something the live app would hide. Demo listings are never cached.
 */
const CACHE_KEY = "housing-compass-offline-v1";
type CacheEntry = { at: string; docs: unknown[] };
async function readCache(cat: string): Promise<CacheEntry | null> {
  try {
    const all = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? "{}") as Record<string, CacheEntry>;
    return all[cat] ?? null;
  } catch {
    return null;
  }
}
async function writeCache(cat: string, listings: Listing[]) {
  try {
    const all = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? "{}") as Record<string, CacheEntry>;
    all[cat] = { at: new Date().toISOString(), docs: listings.filter((l) => !l.isDemo) };
    const keep = Object.entries(all).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 5);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    /* storage full or unavailable: offline cache is best-effort */
  }
}

const EMPTY: SearchResult = { hits: [], hiddenUnverifiedCount: 0, hiddenOverBudgetCount: 0, hiddenApproximateCount: 0 };

export function useSearch(filters: SearchFilters): { result: SearchResult; loading: boolean; error: string | null; expiredLeads: number; offlineSince: string | null } {
  const [state, setState] = useState({ result: EMPTY, loading: true, error: null as string | null, expiredLeads: 0, offlineSince: null as string | null });
  const put = useListingCache((s) => s.put);
  const key = JSON.stringify(filters);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    // The hidden-unverified count needs leads too, so always ask for them and let core.search() gate visibility.
    Promise.all([repository.candidates({ ...filters, includeUnverified: true }), repository.expiredLeadCount()])
      .then(([listings, expiredLeads]) => {
        if (!alive) return;
        put(listings);
        setState({ result: search(listings, filters), loading: false, error: null, expiredLeads, offlineSince: null });
        if (repository.kind === "supabase") void writeCache(filters.category, listings);
      })
      .catch(async (e: Error) => {
        log.error("search failed", { message: e.message });
        const cached = await readCache(filters.category);
        if (!alive) return;
        if (cached) {
          const { listings } = parseDocuments(cached.docs);
          const fresh = withExpiry(listings).listings;
          setState({ result: search(fresh, filters), loading: false, error: null, expiredLeads: 0, offlineSince: cached.at });
        } else {
          setState((s) => ({ ...s, loading: false, error: "We couldn't load homes. Check your connection and try again." }));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useListing(id: string | null): { listing: Listing | null; loading: boolean } {
  const cached = useListingCache((s) => (id ? s.byId[id] : undefined));
  const put = useListingCache((s) => s.put);
  const [loading, setLoading] = useState(!cached);
  useEffect(() => {
    if (!id || cached) return;
    let alive = true;
    repository.get(id).then((l) => {
      if (!alive) return;
      if (l) put([l]);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, cached, put]);
  return { listing: cached ?? null, loading: !cached && loading };
}

/** Resolve many ids (Saved, Compare). Missing ones are fetched once. */
export function useListings(ids: string[]): Listing[] {
  const byId = useListingCache((s) => s.byId);
  const put = useListingCache((s) => s.put);
  const missing = ids.filter((id) => !byId[id]);
  const missingKey = missing.join("|");
  useEffect(() => {
    if (!missing.length) return;
    Promise.all(missing.map((id) => repository.get(id))).then((ls) => put(ls.filter((l): l is Listing => !!l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);
  return ids.map((id) => byId[id]).filter((l): l is Listing => !!l);
}
