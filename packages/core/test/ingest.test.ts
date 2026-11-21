import { describe, expect, it } from "vitest";
import {
  IngestNotPermittedError,
  addressKey,
  checkLinks,
  demoListings,
  doorway,
  ingestBatch,
  listingToRows,
  managerCsvToListings,
  parseCsv,
  researchImport,
  researchLeads,
  zillow,
  type SourceAdapter,
} from "../src/index";

const NOW = new Date("2026-11-03T12:00:00-08:00");
const leads = researchLeads();
const pmAdapter: SourceAdapter & { consentRef: string } = {
  id: "pm-acme",
  name: "Acme Property (consented CSV)",
  kind: "property_manager",
  homeUrl: "https://example.com",
  capabilities: { ingest: true, linkOut: false },
  legalBasis: "Manager-submitted CSV with signed consent",
  ingestBlockedBy: null,
  termsUrl: null,
  consentRef: "consent-2026-11-03-acme",
};

const CSV = `source_listing_id,property_name,address_line1,unit,city,zip,unit_type,base_rent,rent_qualifier,deposit,recurring_fees,move_in_costs,utilities_included,pets,furnished,min_lease_months,contact_email,description
A-101,"Maple Court, Phase 2",123 Example Street,Apt 4,Oakland,94612,1br,"$1,350",,1350,Trash:25;Water:40,none,no,cats_only,no,12,leasing@acme.example,"Quiet unit, ""great"" light"
A-102,,9 Sample Ave,,Oakland,94612,bed,700,,,,,,,,,,
BAD-1,,1 Nowhere Rd,,Atlantis,,1br,1200,,,,,,,,,,
BAD-2,,2 Test Rd,,Oakland,94612,penthouse,1200,,,,,,,,,,
`;

describe("CSV", () => {
  it("parses quotes, escaped quotes and commas", () => {
    const rows = parseCsv(CSV);
    expect(rows[1]![1]).toBe("Maple Court, Phase 2");
    expect(rows[1]![17]).toBe('Quiet unit, "great" light');
  });
  it("turns manager rows into UNVERIFIED listings with correct basis, fees and approximate location", () => {
    const { listings, errors } = managerCsvToListings(CSV, { sourceId: "pm-acme", sourceName: "Acme", now: NOW });
    expect(listings).toHaveLength(2);
    const [a, bed] = listings;
    expect(a!.verification.level).toBe("SOURCE_LISTED_UNVERIFIED");
    expect(a!.pricing).toMatchObject({ basis: "PER_UNIT", baseRentCents: 135000, depositCents: 135000, moveInCosts: [] });
    expect(a!.pricing.recurringFees).toEqual([{ label: "Trash", amountCents: 2500 }, { label: "Water", amountCents: 4000 }]);
    expect(a!.location.precision).toBe("zip_approx");
    expect(bed!.pricing.basis).toBe("PER_BED");
    expect(bed!.pricing.recurringFees).toBeNull(); // blank = unknown, not $0
    expect(errors.map((e) => e.row)).toEqual([4, 5]);
    expect(errors[0]!.message).toMatch(/ZIP|city/);
    expect(errors[1]!.message).toMatch(/unit_type/);
  });
  it("rejects files missing required columns", () => {
    expect(managerCsvToListings("city,zip\nOakland,94612", { sourceId: "x", sourceName: "x", now: NOW }).errors[0]!.message).toMatch(/missing columns/);
  });
});

describe("ingestBatch — legal gates", () => {
  it("refuses link-out-only sources (Doorway, aggregators) without authorization", () => {
    expect(() => ingestBatch({ adapter: doorway, records: [], existing: [], now: NOW })).toThrow(IngestNotPermittedError);
    expect(() => ingestBatch({ adapter: zillow, records: [], existing: [], now: NOW })).toThrow(IngestNotPermittedError);
    expect(() => ingestBatch({ adapter: { ...doorway, capabilities: { ingest: true, linkOut: true } }, records: [], existing: [], now: NOW })).toThrow(/authorization/);
  });
  it("refuses manager imports without consent on file", () => {
    expect(() => ingestBatch({ adapter: { ...pmAdapter, consentRef: "" }, records: [], existing: [], now: NOW })).toThrow(/consent/);
  });
});

describe("ingestBatch — behavior", () => {
  const { listings } = managerCsvToListings(CSV, { sourceId: "pm-acme", sourceName: "Acme", now: NOW });

  it("never lets an import claim verification", () => {
    // A payload that *looks* fully manager-verified (valid checklist) must still come in unverified.
    const checklist = demoListings(NOW).find((d) => d.verification.level === "PROPERTY_MANAGER_VERIFIED")!.verification.checklist;
    const forged = { ...listings[0]!, verification: { ...listings[0]!.verification, level: "PROPERTY_MANAGER_VERIFIED", lastVerifiedAt: NOW.toISOString(), checklist } };
    const r = ingestBatch({ adapter: pmAdapter, records: [forged], existing: [], now: NOW });
    expect(r.inserts[0]!.verification.level).toBe("SOURCE_LISTED_UNVERIFIED");
    expect(r.inserts[0]!.source.sourceId).toBe("pm-acme");
  });
  it("dedupes by source id and by normalized address, and records price changes", () => {
    const first = ingestBatch({ adapter: pmAdapter, records: listings, existing: [], now: NOW });
    expect(first.inserts).toHaveLength(2);
    const raised = { ...listings[0]!, id: "whatever", pricing: { ...listings[0]!.pricing, baseRentCents: 140000 } };
    const second = ingestBatch({ adapter: pmAdapter, records: [raised, listings[1]], existing: first.inserts, now: NOW });
    expect(second.inserts).toHaveLength(0);
    expect(second.updates.map((u) => u.id)).toEqual([listings[0]!.id]);
    expect(second.unchanged).toEqual([listings[1]!.id]);
    expect(second.checks.find((c) => c.checkKind === "price_check")).toMatchObject({ outcome: "changed", details: { fromCents: 135000, toCents: 140000 } });
  });
  it("rejects duplicates inside one batch and invalid records", () => {
    const r = ingestBatch({ adapter: pmAdapter, records: [listings[0], listings[0], { id: "junk" }], existing: [], now: NOW });
    expect(r.inserts).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual([expect.stringMatching(/duplicate/), expect.any(String)]);
  });
  it("holds risky imports for human review", () => {
    const risky = { ...listings[0]!, description: "Please wire the deposit before the tour, I am out of the country and will mail the keys." };
    const r = ingestBatch({ adapter: pmAdapter, records: [risky], existing: [], now: NOW });
    expect(r.inserts[0]!.verification.level).toBe("FLAGGED");
    expect(r.inserts[0]!.status).toBe("pending_review");
    expect(r.checks.some((c) => c.outcome === "hold")).toBe(true);
  });
  it("research import stays unverified", () => {
    const r = ingestBatch({ adapter: researchImport, records: leads.slice(0, 3), existing: [], now: NOW });
    expect(r.inserts.every((l) => l.verification.level === "SOURCE_LISTED_UNVERIFIED")).toBe(true);
  });
});

describe("addresses & rows", () => {
  it("normalizes street suffixes, punctuation and case", () => {
    expect(addressKey("1801 Milvia Street", "Unit 3", "Berkeley")).toBe(addressKey("1801 milvia st.", "unit 3", "BERKELEY"));
  });
  it("maps a listing to table rows with EWKT location", () => {
    const { listing, unit } = listingToRows(leads[0]!);
    expect(listing.location).toMatch(/^SRID=4326;POINT\(-122\.\d+ 37\.\d+\)$/);
    expect(unit.price_basis).toBe("PER_ROOM");
    expect(listing.verification_level).toBe("SOURCE_LISTED_UNVERIFIED");
  });
});

describe("link checker", () => {
  it("reports status, never retries blocked sites, rate-limits per host", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const fake = async (url: string, init: { method: string }) => {
      calls.push(`${init.method} ${url}`);
      if (url.includes("blocked")) return { status: 403, url };
      if (url.includes("nohead") && init.method === "HEAD") return { status: 405, url };
      return { status: 200, url };
    };
    const res = await checkLinks(["https://a.example/1", "https://a.example/2", "https://b.example/blocked", "https://c.example/nohead", "not a url"], fake, {
      perHostDelayMs: 1000,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(res.map((r) => r.ok)).toEqual([true, true, false, true, false]);
    expect(res[2]!.error).toMatch(/blocked/);
    expect(calls.filter((c) => c.includes("blocked"))).toHaveLength(1);
    expect(calls).toContain("GET https://c.example/nohead");
    expect(sleeps.length).toBe(1); // second hit on a.example waited
  });
});
