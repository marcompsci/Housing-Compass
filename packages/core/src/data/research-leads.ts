/**
 * Leads transcribed from "Bay Area Affordable Housing | Research Leads" (snapshot 2026-11-01).
 *
 * These are advertisements seen on listing websites. NONE has been confirmed with a
 * leaseholder or property manager. They are imported ONLY as SOURCE_LISTED_UNVERIFIED
 * and auto-expire 14 days after capture unless a person rechecks them.
 *
 * The research recorded which pair of sites each group came from, but not the exact
 * listing URL — so `listingUrl` is null and the group's search pages are kept instead.
 * Only minimal facts are stored: no photos, no descriptions copied from the sites.
 */
import { findCity } from "../geo";
import { parseListing, type Listing, type UnitType } from "../schema";

export const RESEARCH_CAPTURED_AT = "2026-11-01T12:00:00-07:00";

const ROOM_PAGES = ["https://hotpads.com/bay-area-ca/rooms-for-rent-under-1000", "https://www.rent.com/california/oakland-rooms-for-rent"];
const ONE_BR_PAGES = [
  "https://www.apartments.com/oakland-ca/1-bedrooms-under-2000/",
  "https://www.apartments.com/vallejo-ca/under-2000/",
  "https://www.apartments.com/san-jose-ca/min-1-bedrooms-under-2000/",
  "https://www.zillow.com/bay-area-ca/apartments-under-2000/",
];

interface RawLead {
  city: string;
  propertyName?: string;
  line1: string;
  unit?: string;
  dollars: number;
  plus?: boolean;
  kind: "room" | "bed" | "shared_home" | "one_br";
  householdBedrooms?: number;
  note?: string;
}

export const RAW_RESEARCH_LEADS: RawLead[] = [
  // Room and shared housing leads (source: HotPads and Rent.com)
  { city: "San Francisco", line1: "56 Langton St", unit: "#1", dollars: 850, kind: "room", householdBedrooms: 4, note: "Advertised as a room in a 4-bedroom shared home." },
  { city: "San Francisco", line1: "535 Brunswick St", dollars: 900, kind: "room" },
  { city: "San Francisco", line1: "1114 Silver Ave", dollars: 950, kind: "room" },
  { city: "San Francisco", line1: "1761 22nd Ave", dollars: 1000, kind: "room" },
  { city: "Oakland", line1: "44th St", dollars: 875, kind: "room", note: "Street only — no building number was published." },
  { city: "Oakland", line1: "Loma Vista Ave", dollars: 995, kind: "room", note: "Street only — no building number was published." },
  { city: "Richmond", line1: "421 22nd St", dollars: 850, kind: "room" },
  { city: "Berkeley", line1: "1801 Milvia St", unit: "Unit 3, Room 4, Bed A", dollars: 795, kind: "bed", note: "Shared / student-type housing. The price is for one bed, not a room or an apartment." },
  { city: "Fairfield", line1: "1564 Nightfall Ln", dollars: 800, kind: "shared_home", note: "Advertised as a shared home. Whether the price is per room or per person is not confirmed." },
  { city: "Santa Clara", line1: "1778 Eberhard St", dollars: 925, kind: "room" },
  { city: "San Jose", line1: "3641 Kilo Ave", unit: "#3", dollars: 890, kind: "room" },
  { city: "Fremont", line1: "Lake Wawasee St", dollars: 935, kind: "room", note: "Street only — no building number was published." },
  // One-bedroom apartment leads (source: Apartments.com and Zillow)
  { city: "Oakland", propertyName: "Oak Village", line1: "801 14th St", dollars: 1433, kind: "one_br" },
  { city: "Oakland", line1: "1929 26th Ave", dollars: 1695, plus: true, kind: "one_br" },
  { city: "Oakland", propertyName: "Oak Grove", line1: "444 28th St", dollars: 1788, kind: "one_br" },
  { city: "Oakland", propertyName: "Jackson Lake", line1: "1533 Jackson St", dollars: 1950, kind: "one_br" },
  { city: "Oakland", propertyName: "Prescott Station", line1: "2121 Wood St", dollars: 1995, kind: "one_br" },
  { city: "San Leandro", propertyName: "Doolittle Apartments", line1: "1949-2011 Doolittle Dr", dollars: 1600, plus: true, kind: "one_br" },
  { city: "San Leandro", propertyName: "Gateway Apartments", line1: "888 Davis St", dollars: 1742, plus: true, kind: "one_br" },
  { city: "Vallejo", propertyName: "Bay Village", line1: "1107 Porter St", dollars: 1373, plus: true, kind: "one_br", note: "Research note: confirm qualification requirements and the exact unit." },
  { city: "Vallejo", propertyName: "Bay View Vista", line1: "445 Redwood St", dollars: 1458, kind: "one_br" },
  { city: "Vallejo", propertyName: "Fountain Plaza Hills", line1: "300 Hilary Way", dollars: 1750, plus: true, kind: "one_br" },
  { city: "Vallejo", propertyName: "Seabreeze Vallejo", line1: "100 Larissa Ln", dollars: 1825, plus: true, kind: "one_br" },
  { city: "Fairfield", propertyName: "Park Haven", line1: "2323 Fairfield Ave", dollars: 1625, plus: true, kind: "one_br" },
  { city: "Fairfield", propertyName: "Dover Park", line1: "713 E Travis Blvd", dollars: 1647, plus: true, kind: "one_br" },
  { city: "San Jose", propertyName: "Colonial Way Apartments", line1: "3051 Colonial Way", dollars: 1995, kind: "one_br" },
  { city: "San Jose", propertyName: "Park Kiely", line1: "355 Kiely Blvd", dollars: 1959, plus: true, kind: "one_br" },
  { city: "Santa Clara", propertyName: "St. Anton Apartments", line1: "2231 Calle del Mundo", dollars: 1861, plus: true, kind: "one_br" },
];

const GENERIC_NOTE =
  "Advertised price from a listing website; not confirmed with the property manager. Aggregator '1 bedroom' prices can be per-bed, student, co-living, income-restricted or promotional.";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function leadToListing(r: RawLead): Listing {
  const place = findCity(r.city);
  if (!place) throw new Error(`Unknown city ${r.city}`);
  const oneBr = r.kind === "one_br";
  const unitType: UnitType = oneBr ? "one_bedroom" : r.kind === "bed" ? "bed_in_shared_room" : r.kind === "shared_home" ? "coliving_room" : "room_in_shared_home";
  const basis = oneBr ? "PER_UNIT" : r.kind === "bed" ? "PER_BED" : "PER_ROOM";
  const title = r.propertyName
    ? `${r.propertyName} · 1BR advertised`
    : oneBr
      ? `1BR advertised · ${r.line1}`
      : `${r.kind === "bed" ? "Bed in shared room" : r.kind === "shared_home" ? "Shared home" : "Room"} · ${r.line1}`;

  return parseListing({
    id: `lead-${slug(r.city)}-${slug(r.line1)}${r.unit ? `-${slug(r.unit)}` : ""}`,
    isDemo: false,
    title,
    propertyName: r.propertyName ?? null,
    address: { line1: r.line1, unit: r.unit ?? null, city: r.city, state: "CA", zip: null, county: place.county },
    location: { lat: place.lat, lng: place.lng, precision: "city_approx" },
    unit: {
      unitType,
      bedrooms: oneBr ? 1 : null,
      bathrooms: null,
      sqft: null,
      isEntireUnit: oneBr,
      householdBedrooms: r.householdBedrooms ?? null,
      unitTypeConfirmed: false,
    },
    pricing: {
      basis,
      basisConfirmed: r.kind === "bed" || r.kind === "room",
      qualifier: r.plus ? "STARTING_AT" : "EXACT",
      baseRentCents: r.dollars * 100,
      baseRentMaxCents: null,
      recurringFees: null,
      utilitiesIncluded: null,
      depositCents: null,
      moveInCosts: null,
      concessions: null,
    },
    amenities: { pets: null, furnished: null, accessibility: null, parking: null },
    lease: { minTermMonths: null, moveInDate: null },
    eligibility: {
      incomeRestricted: false,
      amiPercent: null,
      incomeLimits: null,
      minIncomeMultipleOfRent: null,
      programType: null,
      applicationDeadline: null,
      notes: [r.note, GENERIC_NOTE].filter(Boolean).join(" "),
    },
    transit: { nearestStops: null },
    source: {
      sourceId: "research-2026-11-01",
      sourceName: oneBr ? "Apartments.com or Zillow (via research snapshot)" : "HotPads or Rent.com (via research snapshot)",
      sourceKind: "research_import",
      listingUrl: null,
      searchPageUrls: oneBr ? ONE_BR_PAGES : ROOM_PAGES,
      sourceListingId: null,
      capturedAt: RESEARCH_CAPTURED_AT,
      lastPriceCheckAt: RESEARCH_CAPTURED_AT,
    },
    verification: { level: "SOURCE_LISTED_UNVERIFIED", lastVerifiedAt: null, availabilityConfirmedAt: null, verifiedBy: null, checklist: [], signals: [] },
    status: "active",
    contact: null,
    description: null,
    imageHashes: [],
    intake: {
      observedAt: RESEARCH_CAPTURED_AT,
      rawLabel: `${oneBr ? "One-bedroom apartment leads" : "Room and shared housing leads"} · ${r.propertyName ? r.propertyName + ", " : ""}${r.line1} | $${r.dollars.toLocaleString("en-US")}${r.plus ? "+" : ""}/month`,
      reviewStatus: "pending_review",
      researchDoc: "Bay Area Affordable Housing Research Leads (2026-11-01)",
    },
  });
}

export function researchLeads(): Listing[] {
  return RAW_RESEARCH_LEADS.map(leadToListing);
}
