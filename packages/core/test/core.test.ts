import { describe, expect, it } from "vitest";
import {
  ADAPTERS,
  DEFAULT_FILTERS,
  RAW_RESEARCH_LEADS,
  VERIFICATION_CHECKS,
  apartmentsCom,
  budgetStatus,
  categorize,
  clampBudget,
  coarsen,
  demoListings,
  detectAll,
  detectImpersonation,
  detectPriceAnomaly,
  doorway,
  expireIfStale,
  flagForReview,
  formatRent,
  groupByBasis,
  hotpads,
  assertSameBasis,
  isPubliclyVisible,
  jaccard,
  markManagerVerified,
  markOfficialPortal,
  moveInTotal,
  parseListing,
  recommend,
  rentCom,
  researchLeads,
  screenMessage,
  search,
  totalMonthly,
  zillow,
  type ChecklistItem,
  type Listing,
} from "../src/index";

const NOW = new Date("2026-11-02T10:00:00-08:00");
const leads = researchLeads();
const demo = demoListings(NOW);
const all = [...leads, ...demo];
const byId = (id: string) => all.find((l) => l.id === id)!;
const reviewer = { kind: "human", id: "rev-1", role: "reviewer" } as const;
const system = { kind: "system", id: "system:fraud" } as const;

function fullChecklist(): ChecklistItem[] {
  return VERIFICATION_CHECKS.map((check) => ({ check, passed: true, evidenceIds: [`ev-${check}`], checkedAt: NOW.toISOString(), checkedBy: "rev-1" }));
}

describe("research lead seed", () => {
  it("imports all 28 leads and every one is SOURCE_LISTED_UNVERIFIED, never verified", () => {
    expect(leads).toHaveLength(28);
    expect(RAW_RESEARCH_LEADS).toHaveLength(28);
    for (const l of leads) {
      expect(l.verification.level).toBe("SOURCE_LISTED_UNVERIFIED");
      expect(l.verification.lastVerifiedAt).toBeNull();
      expect(l.isDemo).toBe(false);
      expect(l.location.precision).toBe("city_approx");
      expect(l.unit.unitTypeConfirmed).toBe(false);
      expect(l.source.searchPageUrls.length).toBeGreaterThan(0);
    }
  });

  it("keeps unknowns unknown (no invented fees, deposits, amenities)", () => {
    for (const l of leads) {
      expect(l.pricing.recurringFees).toBeNull();
      expect(l.pricing.depositCents).toBeNull();
      expect(l.amenities.pets).toBeNull();
      expect(totalMonthly(l).amountCents).toBeNull();
      expect(moveInTotal(l).complete).toBe(false);
    }
  });

  it("prices the Berkeley bed per-bed and 1BRs per-unit", () => {
    const bed = leads.find((l) => l.address.line1 === "1801 Milvia St")!;
    expect(bed.pricing.basis).toBe("PER_BED");
    expect(categorize(bed)).toBe("SHARED_COLIVING");
    expect(formatRent(bed)).toBe("$795 / bed / mo");
    const oak = leads.find((l) => l.propertyName === "Doolittle Apartments")!;
    expect(formatRent(oak)).toBe("$1,600+ / unit / mo");
    expect(categorize(oak)).toBe("ENTIRE_1BR");
  });

  it("are IDs unique", () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });
});

describe("schema integrity", () => {
  const lead = leads[0]!;
  it("rejects a lead that claims manager verification without evidence", () => {
    expect(() => parseListing({ ...lead, verification: { ...lead.verification, level: "PROPERTY_MANAGER_VERIFIED", lastVerifiedAt: NOW.toISOString() } })).toThrow(
      /requires evidence/,
    );
  });
  it("rejects OFFICIAL_PORTAL for aggregator or research sources (acceptance: listing site ≠ verified)", () => {
    expect(() =>
      parseListing({ ...lead, source: { ...lead.source, sourceKind: "aggregator" }, verification: { ...lead.verification, level: "OFFICIAL_PORTAL", lastVerifiedAt: NOW.toISOString() } }),
    ).toThrow(/official portal source/);
  });
  it("rejects per-bed pricing on an entire unit", () => {
    const one = leads.find((l) => l.unit.isEntireUnit)!;
    expect(() => parseListing({ ...one, pricing: { ...one.pricing, basis: "PER_BED" } })).toThrow();
  });
  it("demo records must say DEMO", () => {
    const d = demo[0]!;
    expect(() => parseListing({ ...d, title: "Nice apartment" })).toThrow(/DEMO/);
  });
});

describe("categories & price basis", () => {
  it("Entire 1BR tab contains only entire units priced per unit (acceptance)", () => {
    const res = search(all, { ...DEFAULT_FILTERS, category: "ENTIRE_1BR", includeUnverified: true, includeDemo: true });
    expect(res.hits.length).toBeGreaterThan(0);
    for (const h of res.hits) {
      expect(h.listing.unit.isEntireUnit).toBe(true);
      expect(h.listing.pricing.basis).toBe("PER_UNIT");
      expect(h.listing.unit.unitType).toBe("one_bedroom");
    }
  });
  it("room and shared tabs never contain entire units", () => {
    for (const category of ["PRIVATE_ROOM", "SHARED_COLIVING"] as const) {
      const res = search(all, { ...DEFAULT_FILTERS, category, includeUnverified: true, includeDemo: true });
      for (const h of res.hits) expect(h.listing.unit.isEntireUnit).toBe(false);
    }
  });
  it("income-restricted homes are only in the Income-Restricted tab", () => {
    const ir = demo.filter((l) => l.eligibility.incomeRestricted);
    for (const l of ir) expect(categorize(l)).toBe("INCOME_RESTRICTED");
  });
  it("comparison refuses to mix bases", () => {
    const bed = leads.find((l) => l.pricing.basis === "PER_BED")!;
    const unit = leads.find((l) => l.pricing.basis === "PER_UNIT")!;
    expect(() => assertSameBasis([bed, unit])).toThrow(/across bases/);
    const g = groupByBasis([bed, unit]);
    expect(g.PER_BED).toHaveLength(1);
    expect(g.PER_UNIT).toHaveLength(1);
  });
  it("sorts beds and rooms in separate blocks", () => {
    const res = search(all, { ...DEFAULT_FILTERS, category: "SHARED_COLIVING", includeUnverified: true, includeDemo: true });
    const bases = res.hits.map((h) => h.listing.pricing.basis);
    const firstBed = bases.indexOf("PER_BED");
    const lastRoom = bases.lastIndexOf("PER_ROOM");
    if (firstBed >= 0 && lastRoom >= 0) {
      // Within each trust tier the blocks are contiguous.
      const tiers = res.hits.map((h) => h.listing.verification.level === "SOURCE_LISTED_UNVERIFIED");
      for (const tier of [true, false]) {
        const b = res.hits.filter((_, i) => tiers[i] === tier).map((h) => h.listing.pricing.basis);
        const switches = b.filter((x, i) => i > 0 && x !== b[i - 1]).length;
        expect(switches).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("budget", () => {
  it("defaults: rooms $500–$1,400, 1BR preferred ≤$1,400, hard max $2,000", () => {
    const oakVillage = leads.find((l) => l.propertyName === "Oak Village")!; // $1,433
    expect(budgetStatus(oakVillage)).toBe("over_preferred");
    const bayVillage = leads.find((l) => l.propertyName === "Bay Village")!; // $1,373+
    expect(budgetStatus(bayVillage)).toBe("within");
    const room = leads.find((l) => l.address.line1 === "1761 22nd Ave")!; // $1,000
    expect(budgetStatus(room)).toBe("within");
  });
  it("hard max is adjustable but never above $2,000", () => {
    const b = clampBudget({ roomMinCents: 50000, roomMaxCents: 140000, unitPreferredMaxCents: 300000, unitHardMaxCents: 500000 });
    expect(b.unitHardMaxCents).toBe(200000);
    expect(b.unitPreferredMaxCents).toBe(200000);
    const lower = clampBudget({ ...b, unitHardMaxCents: 160000 });
    const prescott = leads.find((l) => l.propertyName === "Prescott Station")!; // $1,995
    expect(budgetStatus(prescott, lower)).toBe("over_max");
  });
});

describe("visibility defaults", () => {
  it("shows only official / manager-verified by default; unverified leads are counted, not shown", () => {
    const res = search(all, { ...DEFAULT_FILTERS, category: "ENTIRE_1BR" });
    expect(res.hits).toHaveLength(0); // no demo, no unverified → nothing verified yet in real data
    expect(res.hiddenUnverifiedCount).toBeGreaterThan(0);
  });
  it("never shows FLAGGED or EXPIRED to the public, even with every toggle on", () => {
    for (const l of demo.filter((d) => ["FLAGGED", "EXPIRED"].includes(d.verification.level))) {
      expect(isPubliclyVisible(l, { includeUnverified: true, includeDemo: true })).toBe(false);
    }
  });
  it("demo records are hidden unless demo mode is on", () => {
    const res = search(demo, { ...DEFAULT_FILTERS, category: "PRIVATE_ROOM" });
    expect(res.hits).toHaveLength(0);
  });
});

describe("verification state machine", () => {
  const lead = leads[0]!;
  it("cannot be verified by automation", () => {
    expect(() => markManagerVerified(lead, { checklist: fullChecklist(), independentContact: { method: "phone", foundVia: "official_website", contactedAt: NOW.toISOString() } }, system as never, NOW)).toThrow();
  });
  it("requires all six checks with evidence", () => {
    const partial = fullChecklist().slice(0, 5);
    expect(() => markManagerVerified(lead, { checklist: partial, independentContact: { method: "phone", foundVia: "official_website", contactedAt: NOW.toISOString() } }, reviewer, NOW)).toThrow(
      /cannot be marked verified/,
    );
  });
  it("a reviewer with full evidence can verify, and it is audited", () => {
    const { listing, audit } = markManagerVerified(lead, { checklist: fullChecklist(), independentContact: { method: "phone", foundVia: "official_website", contactedAt: NOW.toISOString() } }, reviewer, NOW);
    expect(listing.verification.level).toBe("PROPERTY_MANAGER_VERIFIED");
    expect(() => parseListing(listing)).not.toThrow();
    expect(audit).toMatchObject({ from: "SOURCE_LISTED_UNVERIFIED", to: "PROPERTY_MANAGER_VERIFIED", actor: { id: "rev-1" } });
  });
  it("OFFICIAL_PORTAL is reserved for official sources", () => {
    expect(() => markOfficialPortal(lead, reviewer, NOW)).toThrow(/official portal/);
  });
  it("automation can flag (hide) but the result reads 'under review', not fraud", () => {
    const { listing, audit } = flagForReview(lead, system, "PRICE_ANOMALY", NOW);
    expect(listing.verification.level).toBe("FLAGGED");
    expect(listing.status).toBe("pending_review");
    expect(audit.actor.kind).toBe("system");
  });
});

describe("staleness", () => {
  it("leads auto-expire 14 days after capture unless rechecked", () => {
    const lead = leads[0]!;
    expect(expireIfStale(lead, new Date("2026-11-10T00:00:00Z")).audit).toBeNull();
    const { listing, audit } = expireIfStale(lead, new Date("2026-11-20T00:00:00Z"));
    expect(listing.verification.level).toBe("EXPIRED");
    expect(audit?.reason).toBe("verification_too_old");
  });
  it("expires when the application deadline passes", () => {
    const ir = byId("demo-official-1br-oakland");
    const { listing } = expireIfStale(ir, new Date(NOW.getTime() + 40 * 86_400_000));
    expect(listing.verification.level).toBe("EXPIRED");
  });
});

describe("risk signals", () => {
  it("holds the demo listing that asks for a wire before the tour, and never says fraud", () => {
    const flagged = byId("demo-flagged-sf");
    const signals = detectAll(flagged, { others: all, managers: [], now: NOW });
    const codes = signals.map((s) => s.code);
    expect(codes).toContain("UPFRONT_PAYMENT_BEFORE_TOUR");
    expect(codes).toContain("OFF_PLATFORM_PAYMENT");
    expect(recommend(signals)).toBe("hold_for_human_review");
    for (const s of signals) expect(s.message.toLowerCase()).not.toMatch(/fraud|scam/);
  });
  it("screens messages for upfront, crypto and gift-card payment", () => {
    expect(screenMessage("Send a $500 deposit before viewing to hold the room", NOW).blocked).toBe(true);
    expect(screenMessage("Pay with bitcoin please", NOW).blocked).toBe(true);
    expect(screenMessage("Can we schedule a tour Saturday?", NOW).blocked).toBe(false);
  });
  it("flags a price far below comparable listings (with ≥5 comparables)", () => {
    const oak1br = leads.filter((l) => l.address.city === "Oakland" && l.unit.isEntireUnit);
    expect(oak1br.length).toBe(5);
    const cheap = parseListing({ ...oak1br[0]!, id: "x-cheap", address: { ...oak1br[0]!.address, line1: "1 Test St" }, pricing: { ...oak1br[0]!.pricing, baseRentCents: 60000 } });
    expect(detectPriceAnomaly(cheap, oak1br, NOW)).toHaveLength(1);
    expect(detectPriceAnomaly(oak1br[0]!, oak1br.slice(1), NOW)).toHaveLength(0); // only 4 comps
  });
  it("detects impersonation of a known manager via a free-mail address", () => {
    const l = parseListing({ ...demo[2]!, description: "Managed by Acme Property Co.", contact: { channel: "email", value: "acme.rentals@gmail.com", independentlyConfirmed: false } });
    const sig = detectImpersonation(l, [{ id: "m1", name: "Acme Property Co", aliases: [], officialDomains: ["acmeproperty.example"], officialPhones: [] }], NOW);
    expect(sig[0]).toMatchObject({ code: "IMPERSONATION", severity: "hold" });
  });
  it("detects copied descriptions and duplicate images at different addresses", () => {
    const text = "Bright and spacious one bedroom apartment with hardwood floors, large windows, modern kitchen, quiet street, close to transit, shops and restaurants, laundry on site, parking available, cats welcome, available now.";
    expect(jaccard(text, text)).toBe(1);
    const a = parseListing({ ...demo[5]!, id: "a", description: text, imageHashes: ["f0f0f0f0f0f0f0f0"] });
    const b = parseListing({ ...demo[6]!, id: "b", description: text, imageHashes: ["f0f0f0f0f0f0f0f1"], contact: { channel: "email", value: "other@example.com", independentlyConfirmed: false } });
    const codes = detectAll(a, { others: [b], managers: [], now: NOW }).map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(["COPIED_DESCRIPTION", "DUPLICATE_IMAGE"]));
  });
});

describe("adapters (link-out only; no scraping)", () => {
  it("no aggregator or official portal is allowed to ingest without authorization", () => {
    for (const a of ADAPTERS.filter((x) => x.kind === "aggregator" || x.kind === "official_portal")) {
      expect(a.capabilities.ingest).toBe(false);
      expect(a.ingestBlockedBy).toBeTruthy();
    }
  });
  it("builds URLs only in shapes observed on the sites", () => {
    const q = { city: "Oakland", state: "CA" as const, category: "ENTIRE_1BR" as const, maxRentDollars: 2000 };
    expect(apartmentsCom.buildSearchUrl!(q)).toBe("https://www.apartments.com/oakland-ca/1-bedrooms-under-2000/");
    expect(zillow.buildSearchUrl!(q)).toBe("https://www.zillow.com/oakland-ca/apartments-under-2000/");
    expect(hotpads.buildSearchUrl!({ ...q, category: "PRIVATE_ROOM", maxRentDollars: 1400 })).toBe("https://hotpads.com/oakland-ca/rooms-for-rent");
    expect(hotpads.buildSearchUrl!({ ...q, category: "PRIVATE_ROOM", maxRentDollars: 900 })).toBe("https://hotpads.com/oakland-ca/rooms-for-rent-under-1000");
    expect(rentCom.buildSearchUrl!({ ...q, category: "PRIVATE_ROOM" })).toBe("https://www.rent.com/california/oakland-rooms-for-rent");
    expect(doorway.buildSearchUrl!(q)).toBe("https://housingbayarea.mtc.ca.gov/listings");
  });
});

describe("privacy", () => {
  it("coarsens device location to ~1 km before storage", () => {
    expect(coarsen({ lat: 37.774929, lng: -122.419416 })).toEqual({ lat: 37.77, lng: -122.42 });
  });
});

describe("demo fixtures", () => {
  it("are all marked demo and validate", () => {
    for (const d of demo as Listing[]) {
      expect(d.isDemo).toBe(true);
      expect(d.title).toMatch(/^DEMO/);
      expect(d.source.sourceKind).toBe("demo_fixture");
    }
  });
});

import { parseDocuments, planSync } from "../src/index";

describe("account sync planning", () => {
  it("uploads only new favorites/searches/valid reports and merges favorites", () => {
    const plan = planSync(
      {
        favorites: ["a", "b", "gone"],
        savedSearches: [
          { id: "1", name: "East Bay rooms", filters: {}, createdAt: "x" },
          { id: "2", name: "Already there", filters: {}, createdAt: "x" },
          { id: "3", name: "Synced", filters: {}, createdAt: "x", serverId: "srv" },
        ],
        reports: [
          { id: "r1", listingId: "a", reason: "upfront_payment", details: "", createdAt: "x" },
          { id: "r2", listingId: "a", reason: "bogus", details: "", createdAt: "x" },
          { id: "r3", listingId: "a", reason: "other", details: "", createdAt: "x", syncedAt: "y" },
        ],
      },
      { favorites: ["b", "c"], savedSearchNames: ["already there"] },
      new Set(["a", "b", "c"]),
    );
    expect(plan.favoritesToUpload).toEqual(["a"]);
    expect(plan.mergedFavorites.sort()).toEqual(["a", "b", "c", "gone"]);
    expect(plan.searchesToUpload.map((s) => s.id)).toEqual(["1"]);
    expect(plan.reportsToUpload.map((r) => r.id)).toEqual(["r1"]);
    expect(plan.reportsRejected.map((r) => r.id)).toEqual(["r2"]);
  });
  it("drops invalid API documents instead of rendering them", () => {
    const good = researchLeads()[0]!;
    const { listings, invalid } = parseDocuments([good, { id: "bad", title: "x" }]);
    expect(listings).toHaveLength(1);
    expect(invalid[0]!.id).toBe("bad");
  });
});
