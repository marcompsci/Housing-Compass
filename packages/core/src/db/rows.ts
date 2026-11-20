/**
 * Listing ↔ table rows. The inverse of the `listing_documents` view; shared by the seed
 * builder (SQL) and the ingest edge function (supabase-js upserts) so they can't drift.
 */
import { addressKey } from "../ingest";
import { regionOf } from "../geo";
import type { Listing } from "../schema";

export interface ListingRow {
  id: string; is_demo: boolean; title: string; property_name: string | null;
  address_line1: string; address_unit: string | null; city: string; state: string; zip: string | null; county: string | null;
  /** EWKT; PostgREST and Postgres both accept this for geography columns. */
  location: string; location_precision: string; address_key: string;
  program_type: string | null; income_restricted: boolean; application_deadline: string | null; eligibility_notes: string | null;
  description: string | null; image_hashes: string[]; transit: unknown;
  contact_channel: string | null; contact_value: string | null; contact_independently_confirmed: boolean;
  source_id: string; source_display_name: string; listing_url: string | null; search_page_urls: string[]; source_listing_id: string | null;
  captured_at: string; last_price_check_at: string | null;
  verification_level: string; last_verified_at: string | null; status: string;
  region: string | null; availability_confirmed_at: string | null; intake: unknown; property_manager_id: string | null;
}

export interface UnitRow {
  listing_id: string; unit_type: string; is_entire_unit: boolean; bedrooms: number | null; bathrooms: number | null; sqft: number | null;
  household_bedrooms: number | null; unit_type_confirmed: boolean; price_basis: string; basis_confirmed: boolean; price_qualifier: string;
  base_rent_cents: number; base_rent_max_cents: number | null; recurring_fees: unknown; utilities_included: boolean | null; deposit_cents: number | null;
  move_in_costs: unknown; concessions: string | null; pets: string | null; furnished: boolean | null; accessibility: string[] | null; parking: boolean | null;
  min_lease_months: number | null; move_in_date: string | null; ami_percent: number | null; income_limits: unknown; min_income_multiple: number | null;
  application_fee_cents: number | null; accepts_vouchers: boolean | null;
}

export const JSONB_COLUMNS = new Set(["transit", "recurring_fees", "move_in_costs", "income_limits", "intake"]);

export function listingToRows(l: Listing): { listing: ListingRow; unit: UnitRow } {
  return {
    listing: {
      id: l.id, is_demo: l.isDemo, title: l.title, property_name: l.propertyName,
      address_line1: l.address.line1, address_unit: l.address.unit, city: l.address.city, state: l.address.state, zip: l.address.zip, county: l.address.county,
      location: `SRID=4326;POINT(${l.location.lng} ${l.location.lat})`, location_precision: l.location.precision,
      address_key: addressKey(l.address.line1, l.address.unit, l.address.city),
      program_type: l.eligibility.programType, income_restricted: l.eligibility.incomeRestricted, application_deadline: l.eligibility.applicationDeadline,
      eligibility_notes: l.eligibility.notes, description: l.description, image_hashes: l.imageHashes, transit: l.transit.nearestStops,
      contact_channel: l.contact?.channel ?? null, contact_value: l.contact?.value ?? null, contact_independently_confirmed: l.contact?.independentlyConfirmed ?? false,
      source_id: l.source.sourceId, source_display_name: l.source.sourceName, listing_url: l.source.listingUrl, search_page_urls: l.source.searchPageUrls,
      source_listing_id: l.source.sourceListingId, captured_at: l.source.capturedAt, last_price_check_at: l.source.lastPriceCheckAt,
      verification_level: l.verification.level, last_verified_at: l.verification.lastVerifiedAt, status: l.status,
      region: regionOf(l.address), availability_confirmed_at: l.verification.availabilityConfirmedAt, intake: l.intake,
      property_manager_id: l.managerId && /^[0-9a-f-]{36}$/i.test(l.managerId) ? l.managerId : null,
    },
    unit: {
      listing_id: l.id, unit_type: l.unit.unitType, is_entire_unit: l.unit.isEntireUnit, bedrooms: l.unit.bedrooms, bathrooms: l.unit.bathrooms, sqft: l.unit.sqft,
      household_bedrooms: l.unit.householdBedrooms, unit_type_confirmed: l.unit.unitTypeConfirmed, price_basis: l.pricing.basis, basis_confirmed: l.pricing.basisConfirmed,
      price_qualifier: l.pricing.qualifier, base_rent_cents: l.pricing.baseRentCents, base_rent_max_cents: l.pricing.baseRentMaxCents, recurring_fees: l.pricing.recurringFees,
      utilities_included: l.pricing.utilitiesIncluded, deposit_cents: l.pricing.depositCents, move_in_costs: l.pricing.moveInCosts, concessions: l.pricing.concessions,
      pets: l.amenities.pets, furnished: l.amenities.furnished, accessibility: l.amenities.accessibility, parking: l.amenities.parking,
      min_lease_months: l.lease.minTermMonths, move_in_date: l.lease.moveInDate, ami_percent: l.eligibility.amiPercent, income_limits: l.eligibility.incomeLimits,
      min_income_multiple: l.eligibility.minIncomeMultipleOfRent,
      application_fee_cents: l.pricing.applicationFeeCents, accepts_vouchers: l.amenities.acceptsVouchers,
    },
  };
}

/** SQL literal for one value (seed files only — never for user input at runtime). */
export function sqlLiteral(col: string, v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (col === "location") return `st_geogfromtext('${String(v)}')`;
  if (JSONB_COLUMNS.has(col)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (Array.isArray(v)) return v.length ? `array[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]` : "'{}'::text[]";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function insertSql(table: string, row: object, conflict = "do nothing"): string {
  const cols = Object.keys(row);
  return `insert into ${table} (${cols.join(", ")}) values (${cols.map((c) => sqlLiteral(c, (row as Record<string, unknown>)[c])).join(", ")}) on conflict ${conflict};`;
}
