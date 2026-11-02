import type { Category, Listing } from "./schema";
import { categorize } from "./categories";
import { budgetStatus, DEFAULT_BUDGET, type BudgetPrefs, type BudgetStatus } from "./budget";
import { haversineKm, inRegion, type LatLng, type RegionId } from "./geo";
import { isPubliclyVisible } from "./trust/verification";
import { listingInArea } from "./area";

export type Tri = "any" | "yes";

export interface SearchFilters {
  /** Only listings in this region (LA County includes the City of LA). null = everywhere. */
  region: RegionId | null;
  category: Category;
  budget: BudgetPrefs;
  includeUnverified: boolean;
  includeDemo: boolean;
  petsRequired: boolean;
  furnished: "any" | "furnished" | "unfurnished";
  accessibilityRequired: boolean;
  utilitiesIncludedRequired: boolean;
  parkingRequired: boolean;
  /** Confirmed to accept housing vouchers. */
  vouchersRequired: boolean;
  /** A listed transit stop within this many minutes' walk. */
  maxTransitWalkMinutes: number | null;
  /** Only show leases whose minimum term is ≤ this many months. */
  maxMinLeaseMonths: number | null;
  /** Only show homes available on or before this date (YYYY-MM-DD). */
  moveInBy: string | null;
  /** When true, listings whose attribute is unknown still match (shown as "not confirmed"). */
  includeUnconfirmedMatches: boolean;
  center: LatLng | null;
  radiusKm: number | null;
  /** Straight-line distance to a commute destination; travel time needs a routing provider. */
  commuteTo: LatLng | null;
  maxCommuteKm: number | null;
  /** Hand-drawn search area (3–20 points). Approximate (city/ZIP) pins never match an area. */
  area: LatLng[] | null;
  sort: "price_asc" | "distance" | "recently_checked";
}

export const DEFAULT_FILTERS: SearchFilters = {
  region: "bay_area",
  category: "PRIVATE_ROOM",
  budget: DEFAULT_BUDGET,
  includeUnverified: false,
  includeDemo: false,
  petsRequired: false,
  furnished: "any",
  accessibilityRequired: false,
  utilitiesIncludedRequired: false,
  parkingRequired: false,
  vouchersRequired: false,
  maxTransitWalkMinutes: null,
  maxMinLeaseMonths: null,
  moveInBy: null,
  // Exact by default: unknown is never treated as yes. Users can opt in to "possible matches".
  includeUnconfirmedMatches: false,
  center: null,
  radiusKm: null,
  commuteTo: null,
  maxCommuteKm: null,
  area: null,
  sort: "price_asc",
};

export interface SearchHit {
  listing: Listing;
  budget: BudgetStatus;
  distanceKm: number | null;
  commuteKm: number | null;
  /** Filter attributes that matched only because the value is not confirmed. */
  unconfirmed: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  hiddenUnverifiedCount: number;
  hiddenOverBudgetCount: number;
  /** Matches that were left out of a drawn area only because their pin is approximate. */
  hiddenApproximateCount: number;
}

/** null → unknown */
function attr(value: boolean | null, wanted: boolean, includeUnknown: boolean, name: string, unconfirmed: string[]): boolean {
  if (value === null) {
    if (includeUnknown) unconfirmed.push(name);
    return includeUnknown;
  }
  return value === wanted;
}

export function search(listings: Listing[], f: SearchFilters): SearchResult {
  let hiddenUnverifiedCount = 0;
  let hiddenOverBudgetCount = 0;
  let hiddenApproximateCount = 0;
  const hits: SearchHit[] = [];

  for (const l of listings) {
    if (f.region && !inRegion(l.address, f.region)) continue;
    if (categorize(l) !== f.category) continue;

    if (!isPubliclyVisible(l, { includeUnverified: f.includeUnverified, includeDemo: f.includeDemo })) {
      if (l.verification.level === "SOURCE_LISTED_UNVERIFIED" && l.status === "active" && (f.includeDemo || !l.isDemo)) {
        hiddenUnverifiedCount += 1;
      }
      continue;
    }

    const b = budgetStatus(l, f.budget);
    if (b === "over_max" || b === "under_min") {
      hiddenOverBudgetCount += 1;
      continue;
    }

    const unconfirmed: string[] = [];
    const u = f.includeUnconfirmedMatches;
    if (f.petsRequired) {
      const pets = l.amenities.pets;
      if (!attr(pets === null ? null : pets !== "not_allowed", true, u, "pets", unconfirmed)) continue;
    }
    if (f.furnished !== "any" && !attr(l.amenities.furnished, f.furnished === "furnished", u, "furnished", unconfirmed)) continue;
    if (f.accessibilityRequired) {
      const acc = l.amenities.accessibility;
      if (!attr(acc === null ? null : acc.length > 0, true, u, "accessibility", unconfirmed)) continue;
    }
    if (f.utilitiesIncludedRequired && !attr(l.pricing.utilitiesIncluded, true, u, "utilities", unconfirmed)) continue;
    if (f.parkingRequired && !attr(l.amenities.parking, true, u, "parking", unconfirmed)) continue;
    if (f.vouchersRequired && !attr(l.amenities.acceptsVouchers, true, u, "vouchers", unconfirmed)) continue;
    if (f.maxTransitWalkMinutes !== null) {
      const stops = l.transit.nearestStops;
      const near = stops === null ? null : stops.some((s) => s.walkMinutes <= f.maxTransitWalkMinutes!);
      if (!attr(near, true, u, "transit", unconfirmed)) continue;
    }
    if (f.maxMinLeaseMonths !== null) {
      const m = l.lease.minTermMonths;
      if (!attr(m === null ? null : m <= f.maxMinLeaseMonths, true, u, "lease term", unconfirmed)) continue;
    }
    if (f.moveInBy !== null) {
      const d = l.lease.moveInDate;
      if (!attr(d === null ? null : d <= f.moveInBy, true, u, "move-in date", unconfirmed)) continue;
    }

    const distanceKm = f.center ? haversineKm(f.center, l.location) : null;
    if (f.radiusKm !== null && distanceKm !== null && distanceKm > f.radiusKm) continue;
    const commuteKm = f.commuteTo ? haversineKm(f.commuteTo, l.location) : null;
    if (f.maxCommuteKm !== null && commuteKm !== null && commuteKm > f.maxCommuteKm) continue;
    if (f.area && f.area.length >= 3 && !listingInArea(l, f.area)) {
      if (listingInArea(l, f.area, true)) hiddenApproximateCount += 1;
      continue;
    }

    hits.push({ listing: l, budget: b, distanceKm, commuteKm, unconfirmed });
  }

  const trustRank = (h: SearchHit) => (h.listing.verification.level === "SOURCE_LISTED_UNVERIFIED" ? 1 : 0);
  const budgetRank = (h: SearchHit) => (h.budget === "within" ? 0 : 1);
  hits.sort((a, b) => {
    // Verified first, then within-preference, then the chosen sort.
    // Within a tab, beds and rooms are grouped so their prices are never interleaved.
    const basisRank = (h: SearchHit) => ({ PER_UNIT: 0, PER_ROOM: 1, PER_BED: 2 })[h.listing.pricing.basis];
    const t = trustRank(a) - trustRank(b) || basisRank(a) - basisRank(b) || budgetRank(a) - budgetRank(b);
    if (t) return t;
    if (f.sort === "distance" && a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (f.sort === "recently_checked") {
      const at = (h: SearchHit) => h.listing.verification.lastVerifiedAt ?? h.listing.source.lastPriceCheckAt ?? "";
      return at(b).localeCompare(at(a));
    }
    return a.listing.pricing.baseRentCents - b.listing.pricing.baseRentCents;
  });

  return { hits, hiddenUnverifiedCount, hiddenOverBudgetCount, hiddenApproximateCount };
}
