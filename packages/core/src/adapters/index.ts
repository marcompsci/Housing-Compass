/**
 * Source adapters. Each adapter declares HOW we are allowed to use a source.
 *
 *  - ingest: we may store records from it automatically (requires an API, feed,
 *    partnership or written permission — referenced in `legalBasis`).
 *  - linkOut: we only send the user to the source's own pages.
 *
 * No adapter scrapes HTML or works around anti-bot measures. URL builders only
 * use URL shapes observed on the sites themselves on 2026-11-01; a link checker
 * (Phase 4) verifies them, and every builder falls back to the site's home page.
 */
import type { Category, SourceKind } from "../schema";
import type { RegionId } from "../geo";

export interface LinkOutQuery {
  city: string; // e.g. "Oakland"
  state: "CA";
  category: Category;
  maxRentDollars: number;
  /** Region-wide searches use the region slug the sites use (e.g. los-angeles-county-ca). */
  region?: RegionId;
}

/** City slug, or a region slug when the user is searching a whole region. */
function placeSlug(q: LinkOutQuery): string {
  if (q.region === "la_county") return "los-angeles-county-ca";
  if (q.region === "bay_area" && /bay area/i.test(q.city)) return "bay-area-ca";
  return slugCity(q.city);
}

export interface SourceAdapter {
  id: string;
  name: string;
  kind: SourceKind;
  homeUrl: string;
  capabilities: { ingest: boolean; linkOut: boolean };
  /** Why we are allowed to do what we do, or why we are not. */
  legalBasis: string;
  /** What must happen before `ingest` can be turned on. */
  ingestBlockedBy: string | null;
  termsUrl: string | null;
  buildSearchUrl?(q: LinkOutQuery): string;
}

export function slugCity(city: string, state = "ca"): string {
  return `${city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.toLowerCase()}`;
}

/** Round DOWN to a price bucket the site actually uses in its URLs. */
function bucket(max: number, buckets: number[]): number | null {
  const ok = buckets.filter((b) => b <= max);
  return ok.length ? Math.max(...ok) : null;
}

export const doorway: SourceAdapter = {
  id: "doorway",
  name: "Doorway Housing Portal (BAHFA)",
  kind: "official_portal",
  homeUrl: "https://housingbayarea.mtc.ca.gov/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis:
    "Doorway Terms of Use license non-automated, non-commercial use and prohibit scraping, bots, bulk feeds and republishing without prior written authorization from the Agencies. We link out only.",
  ingestBlockedBy:
    "Written data-sharing authorization from BAHFA/MTC (Doorway runs on the open-source Bloom Housing platform, which has a listings API, but using Doorway's instance requires permission).",
  termsUrl: "https://mtc.ca.gov/doorway-housing-portal-terms-use",
  buildSearchUrl: () => "https://housingbayarea.mtc.ca.gov/listings",
};

export const alameda211: SourceAdapter = {
  id: "211-alameda",
  name: "211 Alameda County",
  kind: "official_referral",
  homeUrl: "https://211alamedacounty.org/find-help-information/alameda-county-housing/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Referral service. We show its public phone/text lines and link to its housing page. No data feed is published.",
  ingestBlockedBy: "A data partnership with Eden I&R (operator of 211 Alameda County).",
  termsUrl: null,
  buildSearchUrl: () => "https://211alamedacounty.org/find-help-information/alameda-county-housing/",
};

export const zillow: SourceAdapter = {
  id: "zillow",
  name: "Zillow",
  kind: "aggregator",
  homeUrl: "https://www.zillow.com/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Link-out only. Zillow listing data is available only through approved partner programs.",
  ingestBlockedBy: "An approved Zillow/Bridge data partnership.",
  termsUrl: null, // review the site's current terms before any partnership
  // Observed: https://www.zillow.com/bay-area-ca/apartments-under-2000/
  buildSearchUrl: (q) => {
    const b = bucket(q.maxRentDollars, [1000, 1500, 2000]);
    return b ? `https://www.zillow.com/${slugCity(q.city)}/apartments-under-${b}/` : `https://www.zillow.com/${slugCity(q.city)}/rentals/`;
  },
};

export const apartmentsCom: SourceAdapter = {
  id: "apartments-com",
  name: "Apartments.com",
  kind: "aggregator",
  homeUrl: "https://www.apartments.com/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Link-out only. No public listings API; automated collection is not permitted.",
  ingestBlockedBy: "A licensing agreement with CoStar (Apartments.com).",
  termsUrl: null, // review the site's current terms before any partnership
  // Observed: /oakland-ca/1-bedrooms-under-2000/ and /vallejo-ca/under-2000/
  buildSearchUrl: (q) => {
    const b = bucket(q.maxRentDollars, [1000, 1500, 2000]);
    const city = slugCity(q.city);
    if (!b) return `https://www.apartments.com/${city}/`;
    if (q.category === "ENTIRE_1BR") return `https://www.apartments.com/${city}/1-bedrooms-under-${b}/`;
    return `https://www.apartments.com/${city}/under-${b}/`;
  },
};

export const hotpads: SourceAdapter = {
  id: "hotpads",
  name: "HotPads",
  kind: "aggregator",
  homeUrl: "https://hotpads.com/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Link-out only.",
  ingestBlockedBy: "An approved data partnership (HotPads is part of Zillow Group).",
  termsUrl: null,
  // Observed: /bay-area-ca/rooms-for-rent-under-1000, /los-angeles-ca/rooms-for-rent,
  //           /los-angeles-county-ca/rooms-for-rent-under-1000
  buildSearchUrl: (q) => {
    const place = placeSlug(q);
    const rooms = q.category === "PRIVATE_ROOM" || q.category === "SHARED_COLIVING";
    if (rooms) return q.maxRentDollars <= 1000 ? `https://hotpads.com/${place}/rooms-for-rent-under-1000` : `https://hotpads.com/${place}/rooms-for-rent`;
    return `https://hotpads.com/${place}/apartments-for-rent`;
  },
};

export const rentCom: SourceAdapter = {
  id: "rent-com",
  name: "Rent.com",
  kind: "aggregator",
  homeUrl: "https://www.rent.com/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Link-out only.",
  ingestBlockedBy: "A licensing agreement with Rent.com (Redfin).",
  termsUrl: null,
  // Observed: https://www.rent.com/california/oakland-rooms-for-rent
  buildSearchUrl: (q) => {
    const city = q.city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rooms = q.category === "PRIVATE_ROOM" || q.category === "SHARED_COLIVING";
    return rooms ? `https://www.rent.com/california/${city}-rooms-for-rent` : `https://www.rent.com/california/${city}-apartments`;
  },
};

export const roomies: SourceAdapter = {
  id: "roomies",
  name: "Roomies.com",
  kind: "aggregator",
  homeUrl: "https://www.roomies.com/",
  capabilities: { ingest: false, linkOut: true },
  legalBasis: "Link-out only. Roommate and room listings; no public listings API.",
  ingestBlockedBy: "A data partnership with Roomies.",
  termsUrl: null,
  // Observed: https://www.roomies.com/los-angeles-county-ca
  buildSearchUrl: (q) => (q.region === "la_county" || q.region === "la_city" ? "https://www.roomies.com/los-angeles-county-ca" : "https://www.roomies.com/"),
};

export const researchImportLA: SourceAdapter = {
  id: "research-la-2026-11-01",
  name: "Los Angeles Affordable Housing Lead Research (Nov 1, 2026)",
  kind: "research_import",
  homeUrl: "https://housing.lacity.gov/housing/find-our-properties",
  capabilities: { ingest: true, linkOut: false },
  legalBasis:
    "Human-compiled research supplied by the project owner. 48 leads imported as minimal facts, pending moderator review, never as verified inventory.",
  ingestBlockedBy: null,
  termsUrl: null,
};

export const researchImport: SourceAdapter = {
  id: "research-2026-11-01",
  name: "Bay Area Housing Research Leads (Nov 1, 2026)",
  kind: "research_import",
  homeUrl: "https://housingbayarea.mtc.ca.gov/housing-basics",
  capabilities: { ingest: true, linkOut: false },
  legalBasis:
    "A human-compiled research document supplied by the project owner. Imported as minimal facts (city, address, advertised price, unit type) — no photos or descriptions — and ONLY as SOURCE_LISTED_UNVERIFIED leads.",
  ingestBlockedBy: null,
  termsUrl: null,
};

export const manualReview: SourceAdapter = {
  id: "manual-review",
  name: "Reviewer-entered listing",
  kind: "property_manager",
  homeUrl: "https://example.invalid/",
  capabilities: { ingest: true, linkOut: false },
  legalBasis: "Entered by a reviewer from documents the property manager provided with consent.",
  ingestBlockedBy: null,
  termsUrl: null,
};

export const ADAPTERS: SourceAdapter[] = [doorway, alameda211, zillow, apartmentsCom, hotpads, rentCom, roomies, researchImport, researchImportLA, manualReview];

export const LINK_OUT_ADAPTERS = ADAPTERS.filter((a) => a.capabilities.linkOut && a.kind === "aggregator");

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}
