/**
 * FICTIONAL demo records for UI development (Phase 2). Every one is `isDemo: true`,
 * has "DEMO" in its title, an obviously fictional address, and source kind
 * `demo_fixture`. They are excluded from every query unless demo mode is on, and
 * the seed SQL never loads them into production.
 *
 * Dates are generated relative to `now` so the demo does not go stale.
 */
import { VERIFICATION_CHECKS, parseListing, type Listing } from "../schema";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

const day = 86_400_000;

function base(now: Date, id: string): Listing {
  const verifiedAt = new Date(now.getTime() - 2 * day).toISOString();
  return {
    id: `demo-${id}`,
    isDemo: true,
    title: "DEMO",
    propertyName: null,
    address: { line1: "100 Example Way (fictional)", unit: null, city: "Oakland", state: "CA", zip: null, county: "Alameda" },
    location: { lat: 37.8044, lng: -122.2712, precision: "street" },
    unit: { unitType: "room_in_shared_home", bedrooms: null, bathrooms: null, sqft: null, isEntireUnit: false, householdBedrooms: null, unitTypeConfirmed: true },
    pricing: {
      basis: "PER_ROOM",
      basisConfirmed: true,
      qualifier: "EXACT",
      baseRentCents: 0,
      baseRentMaxCents: null,
      recurringFees: [],
      utilitiesIncluded: false,
      depositCents: 0,
      moveInCosts: [],
      concessions: null,
      applicationFeeCents: 3500,
    },
    amenities: { pets: "not_allowed", furnished: false, accessibility: [], parking: false, acceptsVouchers: true },
    lease: { minTermMonths: 12, moveInDate: new Date(now.getTime() + 14 * day).toISOString().slice(0, 10) },
    eligibility: {
      incomeRestricted: false,
      amiPercent: null,
      incomeLimits: null,
      minIncomeMultipleOfRent: 2.5,
      programType: "market",
      applicationDeadline: null,
      notes: null,
    },
    transit: { nearestStops: null },
    source: {
      sourceId: "demo",
      sourceName: "Demo fixture (fictional)",
      sourceKind: "demo_fixture",
      listingUrl: null,
      searchPageUrls: [],
      sourceListingId: null,
      capturedAt: verifiedAt,
      lastPriceCheckAt: verifiedAt,
    },
    verification: {
      level: "PROPERTY_MANAGER_VERIFIED",
      lastVerifiedAt: verifiedAt,
      availabilityConfirmedAt: verifiedAt,
      verifiedBy: "demo-reviewer",
      checklist: VERIFICATION_CHECKS.map((check) => ({ check, passed: true, evidenceIds: [`demo-evidence-${id}-${check}`], checkedAt: verifiedAt, checkedBy: "demo-reviewer" })),
      signals: [],
    },
    status: "active",
    contact: { channel: "email", value: "leasing@example.com", independentlyConfirmed: true },
    description: null,
    imageHashes: [],
    managerId: "demo-manager",
    intake: null,
  };
}

function merge<T>(a: T, b: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    const cur = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur) ? merge(cur, v as never) : v;
  }
  return out as T;
}

const usd = (d: number) => d * 100;

export function demoListings(now: Date = new Date()): Listing[] {
  const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * day).toISOString();
  const defs: Array<[string, DeepPartial<Listing>]> = [
    [
      "official-1br-oakland",
      {
        title: "DEMO · Lakeside Commons 1BR (60% AMI)",
        propertyName: "Lakeside Commons (fictional)",
        address: { line1: "200 Sample St (fictional)", city: "Oakland", county: "Alameda" },
        location: { lat: 37.8079, lng: -122.2591, precision: "street" },
        unit: { unitType: "one_bedroom", bedrooms: 1, bathrooms: 1, sqft: 610, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(1248), recurringFees: [], utilitiesIncluded: false, depositCents: usd(500), moveInCosts: [] },
        amenities: { pets: "cats_only", accessibility: ["wheelchair_accessible", "elevator"], parking: false },
        eligibility: {
          incomeRestricted: true,
          amiPercent: 60,
          incomeLimits: [
            { householdSize: 1, maxAnnualIncomeCents: usd(70000) },
            { householdSize: 2, maxAnnualIncomeCents: usd(80000) },
          ],
          minIncomeMultipleOfRent: 2,
          programType: "lottery",
          applicationDeadline: iso(30),
          notes: "Fictional numbers for UI testing. Real income limits come from the official listing.",
        },
        transit: { nearestStops: [{ name: "Lake Merritt BART (demo)", mode: "bart", walkMinutes: 7 }] },
        source: { sourceName: "Demo fixture styled as an official portal record", sourceKind: "demo_fixture" },
        verification: { level: "OFFICIAL_PORTAL", checklist: [] },
        contact: { channel: "official_portal", value: "Apply through the official portal", independentlyConfirmed: true },
      },
    ],
    [
      "official-studio-sanjose",
      {
        title: "DEMO · Alameda Row Studio (waitlist)",
        address: { line1: "300 Placeholder Ave (fictional)", city: "San Jose", county: "Santa Clara" },
        location: { lat: 37.3337, lng: -121.8987, precision: "street" },
        unit: { unitType: "studio", bedrooms: 0, bathrooms: 1, sqft: 420, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(985), recurringFees: [], depositCents: usd(500), moveInCosts: [] },
        amenities: { pets: "allowed", accessibility: ["step_free_entry"], furnished: false },
        eligibility: { incomeRestricted: true, amiPercent: 50, programType: "waitlist", applicationDeadline: null, notes: "Fictional demo record." },
        transit: { nearestStops: [{ name: "VTA light rail (demo)", mode: "rail", walkMinutes: 5 }] },
        verification: { level: "OFFICIAL_PORTAL", checklist: [] },
        contact: { channel: "official_portal", value: "Apply through the official portal", independentlyConfirmed: true },
      },
    ],
    [
      "room-sf-mission",
      {
        title: "DEMO · Sunny room in 3BR flat",
        address: { line1: "400 Fictional St (fictional)", city: "San Francisco", county: "San Francisco" },
        location: { lat: 37.7599, lng: -122.4148, precision: "street" },
        unit: { unitType: "room_in_shared_home", householdBedrooms: 3, bathrooms: 1 },
        pricing: {
          baseRentCents: usd(1150),
          recurringFees: [{ label: "Utilities share", amountCents: usd(80) }],
          utilitiesIncluded: false,
          depositCents: usd(1150),
          moveInCosts: [{ label: "First month", amountCents: usd(1150) }],
        },
        amenities: { furnished: true, pets: "not_allowed" },
        lease: { minTermMonths: 6 },
        transit: { nearestStops: [{ name: "16th St Mission BART (demo)", mode: "bart", walkMinutes: 6 }] },
      },
    ],
    [
      "room-fremont",
      {
        title: "DEMO · Quiet room near Central Park",
        address: { line1: "500 Imaginary Ct (fictional)", city: "Fremont", county: "Alameda" },
        location: { lat: 37.5502, lng: -121.9703, precision: "street" },
        unit: { unitType: "room_in_shared_home", householdBedrooms: 4 },
        pricing: { baseRentCents: usd(950), recurringFees: [], utilitiesIncluded: true, depositCents: usd(500), moveInCosts: [{ label: "First month", amountCents: usd(950) }] },
        amenities: { pets: "allowed", furnished: false, accessibility: ["step_free_entry"] },
        lease: { minTermMonths: 3 },
      },
    ],
    [
      "bed-oakland-coliving",
      {
        title: "DEMO · Co-living bed, 2-person room",
        address: { line1: "600 Mockup Blvd (fictional)", city: "Oakland", county: "Alameda" },
        location: { lat: 37.8113, lng: -122.2681, precision: "street" },
        unit: { unitType: "bed_in_shared_room", householdBedrooms: 5 },
        pricing: { basis: "PER_BED", baseRentCents: usd(725), recurringFees: [{ label: "House fee (cleaning, internet)", amountCents: usd(60) }], utilitiesIncluded: true, depositCents: usd(300), moveInCosts: [] },
        amenities: { furnished: true },
        lease: { minTermMonths: 1 },
        transit: { nearestStops: [{ name: "19th St BART (demo)", mode: "bart", walkMinutes: 4 }] },
      },
    ],
    [
      "1br-richmond",
      {
        title: "DEMO · Garden 1BR apartment",
        address: { line1: "700 Specimen Rd (fictional)", city: "Richmond", county: "Contra Costa" },
        location: { lat: 37.9377, lng: -122.3356, precision: "street" },
        unit: { unitType: "one_bedroom", bedrooms: 1, bathrooms: 1, sqft: 640, isEntireUnit: true },
        pricing: {
          basis: "PER_UNIT",
          baseRentCents: usd(1395),
          recurringFees: [{ label: "Trash & water", amountCents: usd(45) }],
          utilitiesIncluded: false,
          depositCents: usd(1395),
          moveInCosts: [{ label: "First month", amountCents: usd(1395) }],
        },
        amenities: { pets: "cats_only", parking: true },
        transit: { nearestStops: [{ name: "Richmond BART (demo)", mode: "bart", walkMinutes: 12 }] },
      },
    ],
    [
      "1br-hayward",
      {
        title: "DEMO · Updated 1BR, in-unit laundry",
        address: { line1: "800 Template Ln (fictional)", city: "Hayward", county: "Alameda" },
        location: { lat: 37.6713, lng: -122.0861, precision: "street" },
        unit: { unitType: "one_bedroom", bedrooms: 1, bathrooms: 1, sqft: 700, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(1690), recurringFees: [{ label: "Parking", amountCents: usd(50) }], depositCents: usd(1690), moveInCosts: [] },
        amenities: { pets: "allowed", parking: true, accessibility: ["elevator", "step_free_entry"] },
      },
    ],
    [
      "studio-berkeley",
      {
        title: "DEMO · Compact studio by campus",
        address: { line1: "900 Example Pl (fictional)", city: "Berkeley", county: "Alameda" },
        location: { lat: 37.8686, lng: -122.2681, precision: "street" },
        unit: { unitType: "studio", bedrooms: 0, bathrooms: 1, sqft: 350, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(1375), recurringFees: [], utilitiesIncluded: true, depositCents: usd(1375), moveInCosts: [] },
        lease: { minTermMonths: 9 },
        transit: { nearestStops: [{ name: "Downtown Berkeley BART (demo)", mode: "bart", walkMinutes: 5 }] },
      },
    ],
    [
      "flagged-sf",
      {
        title: "DEMO · Held for review (risk signals)",
        address: { line1: "1000 Sample Sq (fictional)", city: "San Francisco", county: "San Francisco" },
        location: { lat: 37.7765, lng: -122.4241, precision: "street" },
        unit: { unitType: "one_bedroom", bedrooms: 1, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(650), recurringFees: null, depositCents: null, moveInCosts: null },
        description:
          "DEMO TEXT. I am out of the country so please wire the deposit before the tour and I will mail you the keys. Gift cards accepted.",
        verification: { level: "FLAGGED", checklist: [] },
        status: "pending_review",
        contact: { channel: "email", value: "owner.demo@example.com", independentlyConfirmed: false },
      },
    ],
    [
      "expired-official",
      {
        title: "DEMO · Expired lottery (deadline passed)",
        address: { line1: "1100 Fictional Ter (fictional)", city: "Concord", county: "Contra Costa" },
        location: { lat: 37.9779, lng: -122.0301, precision: "street" },
        unit: { unitType: "one_bedroom", bedrooms: 1, isEntireUnit: true },
        pricing: { basis: "PER_UNIT", baseRentCents: usd(1100) },
        eligibility: { incomeRestricted: true, amiPercent: 50, programType: "lottery", applicationDeadline: iso(-3) },
        verification: { level: "EXPIRED", checklist: [] },
        status: "expired",
      },
    ],
  ];
  return defs.map(([id, patch]) => parseListing(merge(base(now, id), patch)));
}
