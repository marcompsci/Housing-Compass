/**
 * Pure planning for merging on-device state into an account at sign-in.
 * The app executes the plan with supabase-js; keeping the decisions here makes them testable.
 */
import { ListingSchema, type Listing } from "./schema";

export interface LocalSnapshot {
  favorites: string[];
  savedSearches: Array<{ id: string; name: string; filters: unknown; createdAt: string; serverId?: string | null }>;
  reports: Array<{ id: string; listingId: string; reason: string; details: string; createdAt: string; syncedAt?: string | null }>;
}

export interface RemoteSnapshot {
  favorites: string[];
  savedSearchNames: string[];
}

export const REPORT_REASONS = ["upfront_payment", "off_platform_payment", "not_available", "wrong_price", "impersonation", "duplicate", "discrimination", "other"] as const;

export interface SyncPlan {
  favoritesToUpload: string[];
  mergedFavorites: string[];
  searchesToUpload: LocalSnapshot["savedSearches"];
  reportsToUpload: LocalSnapshot["reports"];
  /** Reports that cannot be sent (unknown reason) — kept locally, never silently dropped. */
  reportsRejected: LocalSnapshot["reports"];
}

export function planSync(local: LocalSnapshot, remote: RemoteSnapshot, knownListingIds?: Set<string>): SyncPlan {
  const remoteFav = new Set(remote.favorites);
  // Favorites for listings that no longer exist can't be inserted (FK); keep them local only.
  const favoritesToUpload = local.favorites.filter((id) => !remoteFav.has(id) && (!knownListingIds || knownListingIds.has(id)));
  const mergedFavorites = [...new Set([...remote.favorites, ...local.favorites])];
  const remoteNames = new Set(remote.savedSearchNames.map((n) => n.trim().toLowerCase()));
  const searchesToUpload = local.savedSearches.filter((s) => !s.serverId && !remoteNames.has(s.name.trim().toLowerCase()));
  const unsent = local.reports.filter((r) => !r.syncedAt);
  const valid = (r: LocalSnapshot["reports"][number]) => (REPORT_REASONS as readonly string[]).includes(r.reason);
  return {
    favoritesToUpload,
    mergedFavorites,
    searchesToUpload,
    reportsToUpload: unsent.filter(valid),
    reportsRejected: unsent.filter((r) => !valid(r)),
  };
}

/** Validate untrusted documents from the API; invalid ones are dropped and reported, never shown. */
export function parseDocuments(docs: unknown[]): { listings: Listing[]; invalid: Array<{ id: unknown; error: string }> } {
  const listings: Listing[] = [];
  const invalid: Array<{ id: unknown; error: string }> = [];
  for (const d of docs) {
    const r = ListingSchema.safeParse(d);
    if (r.success) listings.push(r.data);
    else invalid.push({ id: (d as { id?: unknown })?.id, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) });
  }
  return { listings, invalid };
}
