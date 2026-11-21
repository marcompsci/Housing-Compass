/**
 * Listing repositories behind one async interface.
 *  - LocalRepository: bundled research leads (+ demo fixtures). No backend needed.
 *  - SupabaseRepository: search_listings / get_listing RPCs; every document is
 *    re-validated with core's ListingSchema before it can reach the UI.
 * Demo fixtures are only ever added client-side, and only in demo mode.
 */
import { areaToGeoJSON, demoListings, expireIfStale, laResearchLeads, parseDocuments, researchLeads, type Listing, type SearchFilters } from "@housing-compass/core";
import { config, now } from "../config";
import { log } from "../lib/log";
import { supabase } from "./supabase";

export interface ListingRepository {
  readonly kind: "local" | "supabase";
  /** Candidate listings for a search; core.search() does the final filtering and ordering. */
  candidates(f: SearchFilters): Promise<Listing[]>;
  get(id: string): Promise<Listing | null>;
  expiredLeadCount(): Promise<number>;
}

export function withExpiry(listings: Listing[]): { listings: Listing[]; expired: number } {
  const t = now();
  let expired = 0;
  const out = listings.map((l) => {
    const { listing, audit } = expireIfStale(l, t);
    if (audit && !l.isDemo) expired += 1;
    return listing;
  });
  return { listings: out, expired };
}

const demo = () => (config.demoMode ? withExpiry(demoListings(now())).listings : []);

/** Local (no-backend) review decisions, applied on top of bundled data. Demo/testing only. */
export const localOverrides = new Map<string, Listing>();

export class LocalRepository implements ListingRepository {
  readonly kind = "local" as const;
  private data = withExpiry([...researchLeads(), ...laResearchLeads()]);
  private demo = demo();
  private all() {
    return [...this.data.listings, ...this.demo].map((l) => localOverrides.get(l.id) ?? l);
  }
  async candidates() {
    return this.all();
  }
  async get(id: string) {
    return this.all().find((l) => l.id === id) ?? null;
  }
  async expiredLeadCount() {
    return this.data.expired;
  }
}

export class SupabaseRepository implements ListingRepository {
  readonly kind = "supabase" as const;
  private demo = demo();
  async candidates(f: SearchFilters) {
    const maxRent = Math.max(f.budget.roomMaxCents, f.budget.unitHardMaxCents);
    const { data, error } = await supabase!.rpc("search_listings", {
      p_category: f.category,
      p_include_unverified: f.includeUnverified,
      p_lat: f.center?.lat ?? null,
      p_lng: f.center?.lng ?? null,
      p_radius_km: f.radiusKm,
      p_max_rent_cents: maxRent,
      p_limit: 500,
      p_region: f.region,
      p_area: f.area && f.area.length >= 3 ? areaToGeoJSON(f.area) : null,
      p_query: f.query?.trim() ? f.query.trim().slice(0, 80) : null,
    });
    if (error) throw new Error(`search failed: ${error.message}`);
    const { listings, invalid } = parseDocuments((data as unknown[]) ?? []);
    if (invalid.length) log.warn("dropped invalid listing documents", { count: invalid.length, first: invalid[0] });
    // Server enforces expiry hourly; re-apply locally so a lagging job can't show stale data.
    return [...withExpiry(listings).listings, ...this.demo];
  }
  async get(id: string) {
    const d = this.demo.find((l) => l.id === id);
    if (d) return d;
    const { data, error } = await supabase!.rpc("get_listing", { p_id: id });
    if (error || !data) return null;
    return parseDocuments([data]).listings[0] ?? null;
  }
  async expiredLeadCount() {
    const { data } = await supabase!.rpc("expired_lead_count");
    return typeof data === "number" ? data : 0;
  }
}

export const repository: ListingRepository = supabase ? new SupabaseRepository() : new LocalRepository();
