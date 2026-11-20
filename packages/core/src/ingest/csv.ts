/**
 * Property-manager CSV import (a permitted, consented import). Every row becomes an
 * UNVERIFIED listing; verification still requires the reviewer's six checks.
 */
import { lookupZip, findCity } from "../geo";
import { ListingSchema, type Listing, type UnitType } from "../schema";

/** RFC 4180 CSV parser (quotes, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export const MANAGER_CSV_COLUMNS = [
  "source_listing_id", "property_name", "address_line1", "unit", "city", "zip", "unit_type", "bedrooms",
  "base_rent", "rent_qualifier", "deposit", "recurring_fees", "move_in_costs", "utilities_included", "pets", "furnished",
  "accessibility", "min_lease_months", "move_in_date", "income_restricted", "ami_percent", "contact_email", "contact_phone", "listing_url", "description",
] as const;

const UNIT_TYPES: Record<string, UnitType> = {
  bed: "bed_in_shared_room", room: "room_in_shared_home", coliving: "coliving_room", studio: "studio", "1br": "one_bedroom", "2br+": "two_plus_bedroom",
};

const dollars = (s: string): number | null => {
  const t = s.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`not a dollar amount: "${s}"`);
  return Math.round(n * 100);
};
const bool = (s: string): boolean | null => (/^(y|yes|true|1)$/i.test(s.trim()) ? true : /^(n|no|false|0)$/i.test(s.trim()) ? false : null);
/** "Trash:25; Parking:50" → [{label, amountCents}] ; empty → null (unknown) ; "none" → [] */
const moneyList = (s: string) => {
  if (!s.trim()) return null;
  if (/^none$/i.test(s.trim())) return [];
  return s.split(";").map((p) => {
    const [label, amt] = p.split(":");
    const cents = dollars(amt ?? "");
    if (!label?.trim() || cents === null) throw new Error(`bad fee "${p}" (use Label:amount)`);
    return { label: label.trim(), amountCents: cents };
  });
};

export interface CsvImportResult {
  listings: Listing[];
  errors: Array<{ row: number; message: string }>;
}

export function managerCsvToListings(text: string, opts: { sourceId: string; sourceName: string; now: Date }): CsvImportResult {
  const rows = parseCsv(text);
  const out: CsvImportResult = { listings: [], errors: [] };
  if (!rows.length) return out;
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const missing = ["address_line1", "city", "unit_type", "base_rent"].filter((c) => !header.includes(c));
  if (missing.length) return { listings: [], errors: [{ row: 1, message: `missing columns: ${missing.join(", ")}` }] };
  const at = opts.now.toISOString();

  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const get = (c: string) => (r[header.indexOf(c)] ?? "").trim();
    try {
      const unitType = UNIT_TYPES[get("unit_type").toLowerCase()];
      if (!unitType) throw new Error(`unit_type must be one of ${Object.keys(UNIT_TYPES).join(", ")}`);
      const entire = ["studio", "one_bedroom", "two_plus_bedroom"].includes(unitType);
      const zip = get("zip") || null;
      const z = zip ? lookupZip(zip) : undefined;
      const c = findCity(get("city"));
      if (!z && !c) throw new Error("need a California ZIP or a known Bay Area city to place it on the map");
      const rent = dollars(get("base_rent"));
      if (rent === null) throw new Error("base_rent is required");
      const email = get("contact_email");
      const phone = get("contact_phone");
      const id = `pm-${opts.sourceId}-${(get("source_listing_id") || `${get("address_line1")}-${get("unit")}`).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const listing = ListingSchema.parse({
        id,
        isDemo: false,
        title: `${get("property_name") || get("address_line1")} · ${get("unit_type").toUpperCase()}`,
        propertyName: get("property_name") || null,
        address: { line1: get("address_line1"), unit: get("unit") || null, city: get("city"), state: "CA", zip, county: c?.county ?? null },
        location: z ? { lat: z.lat, lng: z.lng, precision: "zip_approx" } : { lat: c!.lat, lng: c!.lng, precision: "city_approx" },
        unit: {
          unitType,
          bedrooms: get("bedrooms") ? Number(get("bedrooms")) : unitType === "one_bedroom" ? 1 : unitType === "studio" ? 0 : null,
          bathrooms: null,
          sqft: null,
          isEntireUnit: entire,
          householdBedrooms: null,
          unitTypeConfirmed: false,
        },
        pricing: {
          basis: entire ? "PER_UNIT" : unitType === "bed_in_shared_room" ? "PER_BED" : "PER_ROOM",
          basisConfirmed: false,
          qualifier: /starting|from|\+/i.test(get("rent_qualifier")) ? "STARTING_AT" : "EXACT",
          baseRentCents: rent,
          baseRentMaxCents: null,
          recurringFees: moneyList(get("recurring_fees")),
          utilitiesIncluded: bool(get("utilities_included")),
          depositCents: dollars(get("deposit")),
          moveInCosts: moneyList(get("move_in_costs")),
          concessions: null,
        },
        amenities: {
          pets: (["allowed", "cats_only", "dogs_only", "not_allowed"] as const).find((p) => p === get("pets").toLowerCase()) ?? null,
          furnished: bool(get("furnished")),
          accessibility: get("accessibility") ? get("accessibility").split(";").map((a) => a.trim()) : null,
          parking: null,
        },
        lease: { minTermMonths: get("min_lease_months") ? Number(get("min_lease_months")) : null, moveInDate: get("move_in_date") || null },
        eligibility: {
          incomeRestricted: bool(get("income_restricted")) ?? false,
          amiPercent: get("ami_percent") ? Number(get("ami_percent")) : null,
          incomeLimits: null,
          minIncomeMultipleOfRent: null,
          programType: bool(get("income_restricted")) ? null : "market",
          applicationDeadline: null,
          notes: null,
        },
        transit: { nearestStops: null },
        source: { sourceId: opts.sourceId, sourceName: opts.sourceName, sourceKind: "property_manager", listingUrl: get("listing_url") || null, searchPageUrls: [], sourceListingId: get("source_listing_id") || null, capturedAt: at, lastPriceCheckAt: at },
        verification: { level: "SOURCE_LISTED_UNVERIFIED", lastVerifiedAt: null, verifiedBy: null, checklist: [], signals: [] },
        status: "active",
        contact: email ? { channel: "email", value: email, independentlyConfirmed: false } : phone ? { channel: "phone", value: phone, independentlyConfirmed: false } : null,
        description: get("description") || null,
        imageHashes: [],
      });
      out.listings.push(listing);
    } catch (e) {
      const msg = e instanceof Error ? ("issues" in e ? (e as { issues: Array<{ path: unknown[]; message: string }> }).issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") : e.message) : String(e);
      out.errors.push({ row: rowNo, message: msg.slice(0, 300) });
    }
  });
  return out;
}
