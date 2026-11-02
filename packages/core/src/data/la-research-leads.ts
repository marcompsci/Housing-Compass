/**
 * Leads transcribed from "LOS ANGELES | Affordable Housing Lead Research" (research date 2026-11-01).
 * 48 leads: 20 room/shared, 20 conventional one-bedroom ads, 8 co-living ads.
 *
 * The research says: sources are genuine websites, but that does NOT establish that any
 * listing, advertiser, rent or availability is genuine. So every lead is
 * SOURCE_LISTED_UNVERIFIED with intake.reviewStatus = "pending_review".
 *
 * Rules applied:
 *  - Only the source search page named in the research is stored. No direct listing URL
 *    was recorded, so none is invented. Co-living rows name no source at all → none stored.
 *  - Street-only addresses stay street-only. No numbers or ZIPs were added.
 *  - Co-living "from" prices are NOT entire apartments: SHARED_COLIVING, basis unconfirmed.
 *  - Pins sit at the named city/neighborhood center (precision city_approx).
 */
import { findCity } from "../geo";
import { parseListing, type Listing } from "../schema";

export const LA_RESEARCH_OBSERVED_AT = "2026-11-01T12:00:00-07:00";
export const LA_RESEARCH_DOC = "Los Angeles Affordable Housing Lead Research (2026-11-01)";

/** Exact source pages listed in section F of the research. */
export const LA_SOURCES = {
  "HotPads rooms": "https://hotpads.com/los-angeles-ca/rooms-for-rent",
  "HotPads rooms under $1000": "https://hotpads.com/los-angeles-ca/rooms-for-rent-under-1000",
  "HotPads county rooms": "https://hotpads.com/los-angeles-county-ca/rooms-for-rent-under-1000",
  "Roomies county": "https://www.roomies.com/los-angeles-county-ca",
  "Apartments.com": "https://www.apartments.com/los-angeles-ca/1-bedrooms-under-2000/",
  Zillow: "https://www.zillow.com/los-angeles-ca/apartments-under-2000/",
} as const;
type LaSource = keyof typeof LA_SOURCES;

interface RawLaLead {
  section: "rooms" | "one_br" | "coliving";
  property?: string;
  line1: string;
  unit?: string;
  city: string;
  dollars: number;
  plus: boolean;
  source: LaSource | null;
}

const R = (line1: string, city: string, dollars: number, source: LaSource, unit?: string): RawLaLead => ({ section: "rooms", line1, unit, city, dollars, plus: false, source });
const B = (property: string, line1: string, city: string, dollars: number, source: LaSource): RawLaLead => ({ section: "one_br", property, line1, city, dollars, plus: true, source });
const C = (property: string, line1: string, dollars: number): RawLaLead => ({ section: "coliving", property, line1, city: "Los Angeles", dollars, plus: true, source: null });

export const RAW_LA_LEADS: RawLaLead[] = [
  // A. Rooms and shared spaces (20)
  R("Weidner St", "Pacoima", 550, "HotPads rooms"),
  R("El Sereno Ave", "Los Angeles", 700, "HotPads rooms under $1000"),
  R("2408 S Grand Ave", "Los Angeles", 750, "HotPads rooms under $1000", "#18B"),
  R("1377 W 23rd St", "Los Angeles", 795, "HotPads rooms under $1000"),
  R("7858 Irvine Ave", "North Hollywood", 815, "HotPads rooms under $1000"),
  R("1301 N Kingsley Dr", "Los Angeles", 850, "HotPads rooms under $1000"),
  R("841 W 73rd St", "Los Angeles", 850, "HotPads rooms under $1000"),
  R("2702 Kenwood Ave", "Los Angeles", 875, "HotPads rooms under $1000", "#4"),
  R("5515 Klump Ave", "North Hollywood", 900, "HotPads rooms under $1000", "#A"),
  R("912 S Kenmore Ave", "Los Angeles", 900, "HotPads rooms under $1000", "#A"),
  R("12534 Woodgreen St", "Los Angeles", 935, "HotPads rooms under $1000"),
  R("1126 Wilcox Pl", "Los Angeles", 950, "HotPads rooms under $1000", "#6-4"),
  R("10799 Ohio Ave", "Los Angeles", 995, "HotPads rooms under $1000"),
  R("1328 Magnolia Ave", "Los Angeles", 999, "HotPads rooms under $1000"),
  R("Knollwood Ln", "San Dimas", 700, "HotPads county rooms"),
  R("2332 E 17th St", "Long Beach", 800, "HotPads county rooms", "#216"),
  R("16004 Cadwell St", "La Puente", 840, "HotPads county rooms", "#1"),
  R("213 La France Ave", "Alhambra", 800, "HotPads county rooms", "#0"),
  R("27909 Wellston Dr", "Santa Clarita", 800, "HotPads county rooms"),
  R("South Gerhart Ave", "East Los Angeles", 800, "Roomies county"),
  // B. Conventional one-bedroom leads (20)
  B("226 South Serrano", "226 S Serrano Ave", "Los Angeles", 1498, "Apartments.com"),
  B("315 South Virgil Ave", "315-319 S Virgil Ave", "Los Angeles", 1498, "Apartments.com"),
  B("Metro at Florence", "1642 E Florence Ave", "Los Angeles", 1486, "Apartments.com"),
  B("951 S Oxford", "951 S Oxford Ave", "Los Angeles", 1548, "Apartments.com"),
  B("The Monroe at Virgil Village", "800 N Vermont Ave", "Los Angeles", 1595, "Apartments.com"),
  B("3121 W Slauson Ave", "3121 W Slauson Ave", "Los Angeles", 1595, "Apartments.com"),
  B("Park Gramercy Apartments", "849 S Gramercy Dr", "Los Angeles", 1695, "Apartments.com"),
  B("Randolph Lofts", "215 W 6th St", "Los Angeles", 1730, "Apartments.com"),
  B("1423 Magnolia Ave", "1423 Magnolia Ave", "Los Angeles", 1750, "Apartments.com"),
  B("The Asbury Apartments", "2505 W 6th St", "Los Angeles", 1874, "Apartments.com"),
  B("The Chadwick", "209 S Westmoreland Ave", "Los Angeles", 1874, "Apartments.com"),
  B("Violet on Virgil", "160 S Virgil Ave", "Los Angeles", 1935, "Apartments.com"),
  B("Luna on Wilshire", "3640 Wilshire Blvd", "Los Angeles", 1960, "Apartments.com"),
  B("30Sixty", "3060 W Olympic Blvd", "Los Angeles", 1983, "Apartments.com"),
  B("Hazeltine Apartments", "4452-60 Hazeltine Ave", "Sherman Oaks", 1850, "Zillow"),
  B("Waterstone", "9901 Lurline Ave", "Chatsworth", 1945, "Zillow"),
  B("La Corona del Mar", "514 W 26th St", "San Pedro", 1825, "Zillow"),
  B("Lankershim Apartments", "6300 Lankershim Blvd", "North Hollywood", 1995, "Apartments.com"),
  B("6405 8th Ave", "6405 8th Ave", "Los Angeles", 1995, "Apartments.com"),
  B("West Adams Apartments", "2675 Arlington Ave", "Los Angeles", 1995, "Apartments.com"),
  // C. Co-living: classification requires confirmation (8)
  C("M1 by CLG (+ Coliving)", "1221 N Myra Ave", 1195),
  C("Gardner by Category", "1350 N Gardner St", 1105),
  C("Miles at Highland CoLiving", "1410 N Highland Ave", 1395),
  C("Ecco Norton", "418 N Norton Ave", 1200),
  C("Ecco Fountain", "5460 W Fountain Ave", 1100),
  C("Comma Barrington Co-Living", "1503-1507 S Barrington Ave", 1375),
  C("Beverly by Category", "4839-4847 Beverly Blvd", 1027),
  C("Wilton by Category", "726 S Wilton Pl", 945),
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SECTION_LABEL = { rooms: "A. Rooms and shared spaces", one_br: "B. Conventional one-bedroom leads", coliving: "C. Co-living: classification requires confirmation" };

export function laLeadToListing(r: RawLaLead): Listing {
  const place = findCity(r.city);
  if (!place || place.county !== "Los Angeles") throw new Error(`Unknown LA place ${r.city}`);
  const oneBr = r.section === "one_br";
  const coliving = r.section === "coliving";
  const note = coliving
    ? "Co-living advertisement. Whether the price is for a private room, a shared room or a bed is NOT confirmed. This is not an entire apartment. The research did not record which website it came from."
    : oneBr
      ? "Advertised 'from' price for a one-bedroom on a listing site. The exact unit, fees and availability are not confirmed. Conventional one-bedroom ads in this research all start above $1,400."
      : "Room advertisement. Private vs shared bedroom, occupancy and fees are not confirmed.";
  return parseListing({
    id: `la-lead-${slug(r.city)}-${slug(r.line1)}${r.unit ? `-${slug(r.unit)}` : ""}`,
    isDemo: false,
    title: r.property ? `${r.property} · ${coliving ? "co-living advertised" : "1BR advertised"}` : `Room · ${r.line1}`,
    propertyName: r.property ?? null,
    address: { line1: r.line1, unit: r.unit ?? null, city: r.city, state: "CA", zip: null, county: "Los Angeles" },
    location: { lat: place.lat, lng: place.lng, precision: "city_approx" },
    unit: {
      unitType: oneBr ? "one_bedroom" : coliving ? "coliving_room" : "room_in_shared_home",
      bedrooms: oneBr ? 1 : null,
      bathrooms: null,
      sqft: null,
      isEntireUnit: oneBr,
      householdBedrooms: null,
      unitTypeConfirmed: false,
    },
    pricing: {
      basis: oneBr ? "PER_UNIT" : "PER_ROOM",
      basisConfirmed: false,
      qualifier: r.plus ? "STARTING_AT" : "EXACT",
      baseRentCents: r.dollars * 100,
      baseRentMaxCents: null,
      recurringFees: null,
      utilitiesIncluded: null,
      depositCents: null,
      moveInCosts: null,
      concessions: null,
      applicationFeeCents: null,
    },
    amenities: { pets: null, furnished: null, accessibility: null, parking: null, acceptsVouchers: null },
    lease: { minTermMonths: null, moveInDate: null },
    eligibility: { incomeRestricted: false, amiPercent: null, incomeLimits: null, minIncomeMultipleOfRent: null, programType: null, applicationDeadline: null, notes: `${note} Prices are snapshots and may exclude fees.` },
    transit: { nearestStops: null },
    source: {
      sourceId: "research-la-2026-11-01",
      sourceName: r.source ? `${r.source} (via LA research snapshot)` : "Source not recorded in research",
      sourceKind: "research_import",
      listingUrl: null,
      searchPageUrls: r.source ? [LA_SOURCES[r.source]] : [],
      sourceListingId: null,
      capturedAt: LA_RESEARCH_OBSERVED_AT,
      lastPriceCheckAt: LA_RESEARCH_OBSERVED_AT,
    },
    verification: { level: "SOURCE_LISTED_UNVERIFIED", lastVerifiedAt: null, availabilityConfirmedAt: null, verifiedBy: null, checklist: [], signals: [] },
    status: "active",
    contact: null,
    description: null,
    imageHashes: [],
    intake: { observedAt: LA_RESEARCH_OBSERVED_AT, rawLabel: `${SECTION_LABEL[r.section]} · ${r.source ?? "no source named"} · ${r.plus ? "$" + r.dollars.toLocaleString("en-US") + "+" : "$" + r.dollars}/mo`, reviewStatus: "pending_review", researchDoc: LA_RESEARCH_DOC },
  });
}

export function laResearchLeads(): Listing[] {
  return RAW_LA_LEADS.map(laLeadToListing);
}
