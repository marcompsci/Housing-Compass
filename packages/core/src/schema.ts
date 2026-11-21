/**
 * Canonical domain schema for Housing Compass.
 *
 * Rule of thumb: anything we do not KNOW is `null` (rendered "Not confirmed"),
 * never a guessed value. Zod validates every record that enters the system —
 * seed files, adapters, manual review submissions — before it is stored.
 */
import { z } from "zod";

export const VERIFICATION_LEVELS = [
  "OFFICIAL_PORTAL",
  "PROPERTY_MANAGER_VERIFIED",
  "SOURCE_LISTED_UNVERIFIED",
  "FLAGGED",
  "EXPIRED",
] as const;
export const VerificationLevel = z.enum(VERIFICATION_LEVELS);
export type VerificationLevel = z.infer<typeof VerificationLevel>;

/** What one advertised price actually buys. Never compared across bases. */
export const PRICE_BASES = ["PER_BED", "PER_ROOM", "PER_UNIT"] as const;
export const PriceBasis = z.enum(PRICE_BASES);
export type PriceBasis = z.infer<typeof PriceBasis>;

/** "$1,695+" on an aggregator is STARTING_AT, not the price of a specific unit. */
export const PriceQualifier = z.enum(["EXACT", "STARTING_AT", "RANGE"]);
export type PriceQualifier = z.infer<typeof PriceQualifier>;

export const UNIT_TYPES = [
  "bed_in_shared_room",
  "room_in_shared_home",
  "coliving_room",
  "studio",
  "one_bedroom",
  "two_plus_bedroom",
] as const;
export const UnitType = z.enum(UNIT_TYPES);
export type UnitType = z.infer<typeof UnitType>;

export const CATEGORIES = [
  "PRIVATE_ROOM",
  "SHARED_COLIVING",
  "STUDIO",
  "ENTIRE_1BR",
  "INCOME_RESTRICTED",
] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

export const SOURCE_KINDS = [
  "official_portal", // Doorway, county/city housing portals
  "official_referral", // 211 lines, housing authorities (referrals, not inventory)
  "property_manager", // direct feed / submission from a verified manager
  "aggregator", // Zillow, Apartments.com, HotPads, Rent.com …
  "research_import", // a human-compiled research document (e.g. the Nov 2026 PDF)
  "demo_fixture", // fictional records for UI development
] as const;
export const SourceKind = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof SourceKind>;

const isoDate = z.string().datetime({ offset: true });
const cents = z.number().int().nonnegative();

export const Money = z.object({ label: z.string().min(1), amountCents: cents });
export type Money = z.infer<typeof Money>;

export const FraudSignalSchema = z.object({
  code: z.enum([
    "UPFRONT_PAYMENT_BEFORE_TOUR",
    "OFF_PLATFORM_PAYMENT",
    "DUPLICATE_IMAGE",
    "PRICE_ANOMALY",
    "IMPERSONATION",
    "COPIED_DESCRIPTION",
    "USER_REPORT",
    "DISCRIMINATORY_LANGUAGE",
    "ADDRESS_MISMATCH",
  ]),
  severity: z.enum(["hold", "review", "info"]),
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).default({}),
  detectedAt: isoDate,
});
export type FraudSignal = z.infer<typeof FraudSignalSchema>;

export const VERIFICATION_CHECKS = [
  "authorization_to_rent",
  "address",
  "unit_availability",
  "rent",
  "contact_channel",
  "fees",
] as const;
export const VerificationCheck = z.enum(VERIFICATION_CHECKS);
export type VerificationCheck = z.infer<typeof VerificationCheck>;

export const ChecklistItem = z.object({
  check: VerificationCheck,
  passed: z.boolean(),
  evidenceIds: z.array(z.string()).default([]),
  checkedAt: isoDate.nullable(),
  checkedBy: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const ListingSchema = z
  .object({
    id: z.string().min(1),
    isDemo: z.boolean(),
    title: z.string().min(1),
    propertyName: z.string().nullable(),
    address: z.object({
      line1: z.string().min(1),
      unit: z.string().nullable(),
      city: z.string().min(1),
      state: z.string().length(2),
      zip: z.string().nullable(),
      county: z.string().nullable(),
    }),
    location: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      /** zip_approx / city_approx = pin is a ZIP or city centroid; the address was NOT geocoded. */
      precision: z.enum(["rooftop", "street", "zip_approx", "city_approx"]),
    }),
    unit: z.object({
      unitType: UnitType,
      bedrooms: z.number().int().nonnegative().nullable(),
      bathrooms: z.number().nonnegative().nullable(),
      sqft: z.number().int().positive().nullable(),
      isEntireUnit: z.boolean(),
      /** Total bedrooms in the shared home, if a room/bed. */
      householdBedrooms: z.number().int().positive().nullable(),
      /** false until a human confirms the advertised unit type with the manager. */
      unitTypeConfirmed: z.boolean(),
    }),
    pricing: z.object({
      basis: PriceBasis,
      basisConfirmed: z.boolean(),
      qualifier: PriceQualifier,
      baseRentCents: cents,
      baseRentMaxCents: cents.nullable(),
      /** Recurring monthly fees beyond base rent. null = not yet confirmed. */
      recurringFees: z.array(Money).nullable(),
      utilitiesIncluded: z.boolean().nullable(),
      depositCents: cents.nullable(),
      /** One-time costs due at move-in (application fee, first month, etc.). null = unknown. */
      moveInCosts: z.array(Money).nullable(),
      concessions: z.string().nullable(),
      /** Non-refundable application/screening charge per applicant. null = not confirmed. */
      applicationFeeCents: cents.nullable().default(null),
    }),
    amenities: z.object({
      pets: z.enum(["allowed", "cats_only", "dogs_only", "not_allowed"]).nullable(),
      furnished: z.boolean().nullable(),
      accessibility: z.array(
        z.enum(["wheelchair_accessible", "step_free_entry", "elevator", "accessible_bathroom", "hearing_visual_accessible"]),
      ).nullable(),
      parking: z.boolean().nullable(),
      /** Confirmed to accept housing vouchers (Section 8 / HCV / VASH). null = not confirmed. */
      acceptsVouchers: z.boolean().nullable().default(null),
    }),
    lease: z.object({
      minTermMonths: z.number().int().positive().nullable(),
      moveInDate: z.string().date().nullable(),
    }),
    eligibility: z.object({
      incomeRestricted: z.boolean(),
      amiPercent: z.number().int().positive().max(200).nullable(),
      incomeLimits: z
        .array(z.object({ householdSize: z.number().int().positive(), maxAnnualIncomeCents: cents }))
        .nullable(),
      minIncomeMultipleOfRent: z.number().positive().nullable(),
      programType: z.enum(["lottery", "waitlist", "first_come_first_served", "market"]).nullable(),
      applicationDeadline: isoDate.nullable(),
      notes: z.string().nullable(),
    }),
    transit: z.object({
      nearestStops: z
        .array(z.object({ name: z.string(), mode: z.enum(["bart", "muni", "bus", "rail", "ferry"]), walkMinutes: z.number().int().nonnegative() }))
        .nullable(),
    }),
    source: z.object({
      sourceId: z.string().min(1),
      sourceName: z.string().min(1),
      sourceKind: SourceKind,
      /** Exact listing URL, when captured. */
      listingUrl: z.string().url().nullable(),
      /** Search/results pages the lead was found on (when the exact listing URL was not recorded). */
      searchPageUrls: z.array(z.string().url()),
      sourceListingId: z.string().nullable(),
      capturedAt: isoDate,
      lastPriceCheckAt: isoDate.nullable(),
    }),
    verification: z.object({
      level: VerificationLevel,
      lastVerifiedAt: isoDate.nullable(),
      /** When someone last confirmed THIS unit is available (separate from identity/authority checks). */
      availabilityConfirmedAt: isoDate.nullable().default(null),
      verifiedBy: z.string().nullable(),
      checklist: z.array(ChecklistItem),
      signals: z.array(FraudSignalSchema),
    }),
    status: z.enum(["active", "pending_review", "expired", "leased", "removed"]),
    contact: z
      .object({
        channel: z.enum(["official_portal", "phone", "email", "web_form", "source_site"]),
        value: z.string().min(1),
        independentlyConfirmed: z.boolean(),
      })
      .nullable(),
    description: z.string().nullable(),
    imageHashes: z.array(z.string()).default([]),
    /** Verified property-manager account behind this listing (enables in-app messaging). */
    managerId: z.string().nullable().default(null),
    /** How a research lead entered the system: kept verbatim for moderators. */
    intake: z
      .object({
        observedAt: isoDate,
        rawLabel: z.string(),
        reviewStatus: z.enum(["source_found", "pending_review", "rejected"]),
        researchDoc: z.string(),
      })
      .nullable()
      .default(null),
  })
  .superRefine((l, ctx) => {
    // Integrity rules that must hold for EVERY record, including seeds.
    if (l.pricing.basis === "PER_UNIT" && !l.unit.isEntireUnit) {
      ctx.addIssue({ code: "custom", message: "PER_UNIT pricing requires an entire unit" });
    }
    if (l.pricing.basis !== "PER_UNIT" && l.unit.isEntireUnit) {
      ctx.addIssue({ code: "custom", message: "Entire units must be priced PER_UNIT" });
    }
    if (l.unit.unitType === "bed_in_shared_room" && l.pricing.basis !== "PER_BED") {
      ctx.addIssue({ code: "custom", message: "A bed in a shared room must be priced PER_BED" });
    }
    if (l.pricing.baseRentMaxCents !== null && l.pricing.baseRentMaxCents < l.pricing.baseRentCents) {
      ctx.addIssue({ code: "custom", message: "baseRentMaxCents < baseRentCents" });
    }
    const verified = l.verification.level === "OFFICIAL_PORTAL" || l.verification.level === "PROPERTY_MANAGER_VERIFIED";
    if (verified && !l.verification.lastVerifiedAt) {
      ctx.addIssue({ code: "custom", message: "Verified listings need lastVerifiedAt" });
    }
    if (l.verification.level === "PROPERTY_MANAGER_VERIFIED") {
      // Being on Zillow/Apartments.com/etc. is never enough: every check needs a pass + evidence.
      for (const check of VERIFICATION_CHECKS) {
        const item = l.verification.checklist.find((c) => c.check === check);
        if (!item || !item.passed || item.evidenceIds.length === 0) {
          ctx.addIssue({ code: "custom", message: `PROPERTY_MANAGER_VERIFIED requires evidence for ${check}` });
        }
      }
    }
    if (l.verification.level === "OFFICIAL_PORTAL" && !["official_portal", "demo_fixture"].includes(l.source.sourceKind)) {
      ctx.addIssue({ code: "custom", message: "OFFICIAL_PORTAL requires an official portal source" });
    }
    if (l.source.sourceKind === "demo_fixture" && !l.isDemo) {
      ctx.addIssue({ code: "custom", message: "Demo fixtures must be flagged isDemo" });
    }
    if (l.isDemo && !/demo/i.test(l.title)) {
      ctx.addIssue({ code: "custom", message: "Demo listing titles must contain the word DEMO" });
    }
  });
export type Listing = z.infer<typeof ListingSchema>;

export function parseListing(input: unknown): Listing {
  return ListingSchema.parse(input);
}
