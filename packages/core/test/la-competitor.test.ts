import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  LA_SOURCES,
  PROTECTED_FILTER_WORDS,
  RAW_LA_LEADS,
  budgetStatus,
  categorize,
  demoListings,
  detectAll,
  expireIfStale,
  fairHousingIssues,
  hotpads,
  inRegion,
  laResearchLeads,
  parseListing,
  programsFor,
  regionForPoint,
  researchLeads,
  roomies,
  screenMessage,
  search,
} from "../src/index";

const NOW = new Date("2026-11-02T10:00:00-08:00");
const la = laResearchLeads();
const bay = researchLeads();
const demo = demoListings(NOW);
const all = [...bay, ...la, ...demo];

describe("LA research import (48 leads)", () => {
  it("imports 20 rooms, 20 one-bedrooms and 8 co-living, all pending review and unverified", () => {
    expect(la).toHaveLength(48);
    const counts = la.reduce<Record<string, number>>((c, l) => ((c[String(categorize(l))] = (c[String(categorize(l))] ?? 0) + 1), c), {});
    expect(counts).toEqual({ PRIVATE_ROOM: 20, ENTIRE_1BR: 20, SHARED_COLIVING: 8 });
    for (const l of la) {
      expect(l.verification.level).toBe("SOURCE_LISTED_UNVERIFIED");
      expect(l.intake?.reviewStatus).toBe("pending_review");
      expect(l.intake?.observedAt).toBe("2026-11-01T12:00:00-07:00");
      expect(l.source.listingUrl).toBeNull(); // no direct URLs invented
      expect(l.address.zip).toBeNull(); // no ZIPs invented
    }
  });
  it("keeps street-only addresses as street-only and preserves raw labels", () => {
    const weidner = la.find((l) => l.address.line1 === "Weidner St")!;
    expect(weidner.address.city).toBe("Pacoima");
    expect(weidner.intake?.rawLabel).toMatch(/HotPads rooms/);
    expect(la.filter((l) => !/^\d/.test(l.address.line1)).map((l) => l.address.line1).sort()).toEqual(["El Sereno Ave", "Knollwood Ln", "South Gerhart Ave", "Weidner St"]);
  });
  it("never classifies co-living as an entire apartment, and records no source it didn't have", () => {
    const co = la.filter((l) => l.unit.unitType === "coliving_room");
    expect(co).toHaveLength(8);
    for (const l of co) {
      expect(l.unit.isEntireUnit).toBe(false);
      expect(categorize(l)).toBe("SHARED_COLIVING");
      expect(l.pricing.basisConfirmed).toBe(false);
      expect(l.source.searchPageUrls).toEqual([]);
    }
  });
  it("attributes every sourced lead to the exact page named in the research", () => {
    const allowed = new Set(Object.values(LA_SOURCES));
    for (const l of la) for (const u of l.source.searchPageUrls) expect(allowed.has(u as never)).toBe(true);
    expect(la.find((l) => l.address.line1 === "South Gerhart Ave")!.source.searchPageUrls).toEqual(["https://www.roomies.com/los-angeles-county-ca"]);
    expect(la.filter((l) => l.source.searchPageUrls[0] === LA_SOURCES.Zillow).map((l) => l.address.city).sort()).toEqual(["Chatsworth", "San Pedro", "Sherman Oaks"]);
  });
  it("matches the raw transcription row-for-row", () => {
    expect(RAW_LA_LEADS).toHaveLength(48);
    expect(la.map((l) => l.pricing.baseRentCents / 100)).toEqual(RAW_LA_LEADS.map((r) => r.dollars));
  });
  it("every conventional LA one-bedroom is above the $1,400 preference but within the $2,000 cap", () => {
    for (const l of la.filter((x) => categorize(x) === "ENTIRE_1BR")) expect(budgetStatus(l)).toBe("over_preferred");
  });
  it("expires after 14 days without a recheck", () => {
    expect(expireIfStale(la[0]!, new Date("2026-11-20T00:00:00Z")).listing.verification.level).toBe("EXPIRED");
  });
});

describe("regions", () => {
  it("LA County includes the City of LA; the City excludes Long Beach; the Bay Area excludes LA", () => {
    const lb = la.find((l) => l.address.city === "Long Beach")!;
    const noho = la.find((l) => l.address.city === "North Hollywood")!;
    expect(inRegion(lb.address, "la_county")).toBe(true);
    expect(inRegion(lb.address, "la_city")).toBe(false);
    expect(inRegion(noho.address, "la_city")).toBe(true);
    expect(inRegion(noho.address, "la_county")).toBe(true);
    expect(inRegion(noho.address, "bay_area")).toBe(false);
    expect(inRegion(bay[0]!.address, "bay_area")).toBe(true);
  });
  it("search is region-scoped and verified-only by default", () => {
    const f = { ...DEFAULT_FILTERS, region: "la_county" as const, category: "PRIVATE_ROOM" as const };
    const def = search(all, f);
    expect(def.hits).toHaveLength(0);
    expect(def.hiddenUnverifiedCount).toBe(20);
    const opt = search(all, { ...f, includeUnverified: true });
    expect(opt.hits).toHaveLength(20);
    expect(opt.hits.every((h) => h.listing.address.county === "Los Angeles")).toBe(true);
    const city = search(all, { ...f, region: "la_city", includeUnverified: true });
    expect(city.hits.length).toBeLessThan(20);
    expect(city.hits.some((h) => h.listing.address.city === "Long Beach")).toBe(false);
  });
  it("maps a device location to a supported region", () => {
    expect(regionForPoint({ lat: 34.05, lng: -118.25 })).toBe("la_county");
    expect(regionForPoint({ lat: 37.8, lng: -122.27 })).toBe("bay_area");
    expect(regionForPoint({ lat: 32.72, lng: -117.16 })).toBeNull(); // San Diego: not supported yet
  });
});

describe("all-in budgets (fees count)", () => {
  it("uses rent + confirmed recurring fees for the cap", () => {
    const richmond = demo.find((d) => d.id === "demo-1br-richmond")!; // $1,395 + $45
    expect(budgetStatus(richmond)).toBe("over_preferred");
    const base = demo.find((d) => d.id === "demo-1br-hayward")!;
    const pricey = parseListing({ ...base, id: "x", pricing: { ...base.pricing, baseRentCents: 195000, recurringFees: [{ label: "Mandatory amenity fee", amountCents: 10000 }] } });
    expect(budgetStatus(pricey)).toBe("over_max"); // $1,950 advertised, $2,050 all-in → hidden
  });
});

describe("exact filters (unknown is never yes)", () => {
  const f = { ...DEFAULT_FILTERS, includeDemo: true, includeUnverified: true };
  it("excludes unknown values by default and labels them when opted in", () => {
    const strict = search(all, { ...f, category: "PRIVATE_ROOM", petsRequired: true });
    expect(strict.hits.every((h) => h.listing.amenities.pets !== null && h.listing.amenities.pets !== "not_allowed")).toBe(true);
    const loose = search(all, { ...f, category: "PRIVATE_ROOM", petsRequired: true, includeUnconfirmedMatches: true });
    expect(loose.hits.length).toBeGreaterThan(strict.hits.length);
    expect(loose.hits.filter((h) => h.listing.amenities.pets === null).every((h) => h.unconfirmed.includes("pets"))).toBe(true);
  });
  it("filters vouchers, utilities, parking and transit exactly", () => {
    const v = search(all, { ...f, category: "ENTIRE_1BR", vouchersRequired: true });
    expect(v.hits.every((h) => h.listing.amenities.acceptsVouchers === true)).toBe(true);
    const u = search(all, { ...f, category: "PRIVATE_ROOM", utilitiesIncludedRequired: true });
    expect(u.hits.map((h) => h.listing.id)).toEqual(["demo-room-fremont"]);
    const p = search(all, { ...f, category: "ENTIRE_1BR", parkingRequired: true });
    expect(p.hits.every((h) => h.listing.amenities.parking === true)).toBe(true);
    const t = search(all, { ...f, category: "SHARED_COLIVING", maxTransitWalkMinutes: 5 });
    expect(t.hits.map((h) => h.listing.id)).toEqual(["demo-bed-oakland-coliving"]);
  });
});

describe("Fair Housing safeguards", () => {
  it("flags unlawful-preference wording for review, not removal", () => {
    const s = fairHousingIssues("Nice 1BR. No Section 8. Adults only.", NOW);
    expect(s.map((x) => x.evidence.topic)).toEqual(["refusing housing vouchers / source of income", "familial status"]);
    expect(s.every((x) => x.severity === "review")).toBe(true);
    expect(fairHousingIssues("Quiet building near transit, vouchers welcome.", NOW)).toEqual([]);
  });
  it("runs inside the standard risk scan", () => {
    const l = parseListing({ ...demo[2]!, id: "fh", description: "Sunny room, no kids, christians only please" });
    expect(detectAll(l, { others: [], managers: [], now: NOW }).filter((x) => x.code === "DISCRIMINATORY_LANGUAGE")).toHaveLength(2);
  });
  it("search filters never target protected characteristics", () => {
    for (const k of Object.keys(DEFAULT_FILTERS)) expect(k, k).not.toMatch(PROTECTED_FILTER_WORDS);
  });
});

describe("new risk signals", () => {
  it("flags a description that names a different street address", () => {
    const base = demo.find((d) => d.id === "demo-1br-hayward")!;
    const l = parseListing({ ...base, address: { ...base.address, line1: "800 Template Ln" }, description: "Unit is actually located at 1234 Main Street, text me." });
    expect(detectAll(l, { others: [], managers: [], now: NOW }).map((s) => s.code)).toContain("ADDRESS_MISMATCH");
  });
  it("holds payment links in messages", () => {
    expect(screenMessage("Pay the holding deposit at paypal.me/landlord123", NOW).blocked).toBe(true);
  });
});

describe("official programs & link-outs", () => {
  it("lists LA city/county resources with programs, waitlists, eligibility and vacancies as separate fields", () => {
    const ids = programsFor("la_city").map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["la-aahr", "la-lahd-properties", "la-county-hrc", "211-la"]));
    for (const p of programsFor("la_county")) {
      expect(p.vacancyInfo).toBeTruthy();
      expect(p.waitlistInfo).toBeTruthy();
      expect(p.eligibilityInfo).toBeTruthy();
    }
    expect(programsFor("la_county").find((p) => p.id === "la-county-hrc")!.phone).toBe("1-877-428-8844");
    expect(programsFor("bay_area").map((p) => p.id)).toEqual(["doorway", "211-alameda"]);
  });
  it("builds LA link-outs in the observed URL shapes", () => {
    const q = { city: "Los Angeles", state: "CA" as const, category: "PRIVATE_ROOM" as const, maxRentDollars: 900 };
    expect(hotpads.buildSearchUrl!(q)).toBe("https://hotpads.com/los-angeles-ca/rooms-for-rent-under-1000");
    expect(hotpads.buildSearchUrl!({ ...q, region: "la_county" })).toBe("https://hotpads.com/los-angeles-county-ca/rooms-for-rent-under-1000");
    expect(roomies.buildSearchUrl!({ ...q, region: "la_county" })).toBe("https://www.roomies.com/los-angeles-county-ca");
  });
});
