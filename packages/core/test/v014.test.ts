import { describe, expect, it } from "vitest";
import {
  AUTHORITY_CHECKS,
  DEFAULT_ALERT_PREFS,
  DEFAULT_FILTERS,
  DOMAIN_TEXT,
  LOCALES,
  TOUR_DAY_CHECKLIST,
  applicationDocuments,
  areaToGeoJSON,
  buildDataExport,
  buildIcs,
  canPublishPhoto,
  checklistProgress,
  demoListings,
  directionsUrl,
  estimateTravel,
  findReusedPhoto,
  formatResponseStats,
  historyFromRows,
  icsEscape,
  icsFold,
  leadExpiry,
  leadExpiryQueue,
  leadExpirySummary,
  listingShareContent,
  listingInArea,
  neededPerPeriod,
  normalizeAlertPrefs,
  observePrices,
  parseListingLink,
  pickLocale,
  planAlerts,
  pointInPolygon,
  polygonAreaKm2,
  priceTrend,
  pruneHistory,
  quarantinePath,
  releaseNeedsSecondLook,
  researchLeads,
  responseStatsFromRow,
  savingsPlan,
  search,
  tourEvent,
  validateArea,
  validateHeldDecision,
  validateLandlordDecision,
  validatePhotoUpload,
  type LatLng,
  type Listing,
} from "../src/index";

const NOW = new Date("2026-11-03T18:00:00Z");
const demos = demoListings(NOW);

// A box around downtown Oakland.
const OAKLAND: LatLng[] = [
  { lat: 37.79, lng: -122.29 },
  { lat: 37.79, lng: -122.25 },
  { lat: 37.82, lng: -122.25 },
  { lat: 37.82, lng: -122.29 },
];

describe("draw-an-area search", () => {
  it("point in polygon, including edges", () => {
    expect(pointInPolygon({ lat: 37.80, lng: -122.27 }, OAKLAND)).toBe(true);
    expect(pointInPolygon({ lat: 37.77, lng: -122.42 }, OAKLAND)).toBe(false);
    expect(pointInPolygon({ lat: 37.79, lng: -122.27 }, OAKLAND)).toBe(true);
    expect(pointInPolygon({ lat: 37.8, lng: -122.27 }, OAKLAND.slice(0, 2))).toBe(false);
  });
  it("validates shapes", () => {
    expect(validateArea(OAKLAND)).toBeNull();
    expect(validateArea(OAKLAND.slice(0, 2))).toBe("too_few_points");
    const bowtie = [OAKLAND[0]!, OAKLAND[2]!, OAKLAND[1]!, OAKLAND[3]!];
    expect(validateArea(bowtie)).toBe("self_intersecting");
    const huge = [{ lat: 36, lng: -123 }, { lat: 36, lng: -120 }, { lat: 39, lng: -120 }, { lat: 39, lng: -123 }];
    expect(validateArea(huge)).toBe("too_large");
    expect(polygonAreaKm2(OAKLAND)).toBeGreaterThan(10);
    expect(polygonAreaKm2(OAKLAND)).toBeLessThan(15);
  });
  it("GeoJSON ring is closed and [lng, lat]", () => {
    const g = areaToGeoJSON(OAKLAND);
    expect(g.coordinates[0]![0]).toEqual([-122.29, 37.79]);
    expect(g.coordinates[0]!.at(-1)).toEqual(g.coordinates[0]![0]);
  });
  it("never places a city-centroid pin inside a drawn area, and counts what it left out", () => {
    const lead = researchLeads().find((l) => l.location.precision === "city_approx" && l.address.city === "Oakland");
    if (lead) {
      expect(listingInArea(lead, [{ lat: 37.7, lng: -122.4 }, { lat: 37.7, lng: -122.1 }, { lat: 37.9, lng: -122.1 }, { lat: 37.9, lng: -122.4 }])).toBe(false);
    }
    const r = search([...researchLeads(), ...demos], { ...DEFAULT_FILTERS, includeDemo: true, includeUnverified: true, area: [{ lat: 37.7, lng: -122.4 }, { lat: 37.7, lng: -122.1 }, { lat: 37.9, lng: -122.1 }, { lat: 37.9, lng: -122.4 }] });
    for (const h of r.hits) expect(["rooftop", "street"]).toContain(h.listing.location.precision);
    expect(r.hiddenApproximateCount).toBeGreaterThanOrEqual(0);
  });
});

describe("travel estimates", () => {
  const home = { lat: 37.8044, lng: -122.2712 };
  const work = { lat: 37.7749, lng: -122.4194 };
  it("returns a wide, labeled range and never a single number", () => {
    const t = estimateTravel(home, work, "transit");
    expect(t.maxMinutes).toBeGreaterThan(t.minMinutes);
    expect(t.label).toMatch(/estimate/);
    const w = estimateTravel(home, work, "walk");
    expect(w.minMinutes).toBeGreaterThan(t.minMinutes);
  });
  it("widens the range for approximate pins", () => {
    expect(estimateTravel(home, work, "drive", { approximateEndpoint: true }).maxMinutes).toBeGreaterThan(estimateTravel(home, work, "drive").maxMinutes);
  });
  it("builds directions links with coordinates only", () => {
    expect(directionsUrl("apple", home, work, "transit")).toBe("https://maps.apple.com/?saddr=37.80440,-122.27120&daddr=37.77490,-122.41940&dirflg=r");
    expect(directionsUrl("google", home, work, "walk")).toContain("travelmode=walking");
  });
});

describe("price history", () => {
  const l = demos[0]!;
  const priced = (cents: number, at: string): Listing => ({ ...l, isDemo: false, source: { ...l.source, lastPriceCheckAt: at }, pricing: { ...l.pricing, baseRentCents: cents } });
  it("records changes only, and reports drops", () => {
    let h = observePrices({}, [priced(150000, "2026-10-01T00:00:00Z")], NOW).history;
    const same = observePrices(h, [priced(150000, "2026-10-08T00:00:00Z")], NOW);
    expect(same.changes).toEqual([]);
    const drop = observePrices(same.history, [priced(140000, "2026-10-15T00:00:00Z")], NOW);
    expect(drop.changes).toEqual([{ listingId: l.id, oldCents: 150000, newCents: 140000, at: "2026-10-15T00:00:00Z" }]);
    h = drop.history;
    expect(priceTrend(h[l.id]!)).toMatchObject({ direction: "down", changeCents: -10000, points: 2 });
  });
  it("resets when the price basis changes (never compares bed vs room)", () => {
    const h = observePrices({}, [priced(90000, "2026-10-01T00:00:00Z")], NOW).history;
    const other = { ...priced(80000, "2026-10-02T00:00:00Z"), pricing: { ...priced(80000, "x").pricing, basis: l.pricing.basis === "PER_BED" ? "PER_ROOM" : "PER_BED" } } as Listing;
    const r = observePrices(h, [other], NOW);
    expect(r.changes).toEqual([]);
    expect(r.history[l.id]).toHaveLength(1);
  });
  it("ignores demo listings and prunes unsaved ones", () => {
    expect(observePrices({}, [l], NOW).history).toEqual({});
    expect(pruneHistory({ a: [], b: [] }, ["b"])).toEqual({ b: [] });
  });
  it("maps database rows in time order", () => {
    const obs = historyFromRows("x", "PER_ROOM", [{ new_cents: 2, observed_at: "2026-02-01" }, { new_cents: 1, observed_at: "2026-01-01" }]);
    expect(obs.map((o) => o.cents)).toEqual([1, 2]);
  });
});

describe("calendar export", () => {
  it("escapes and folds per RFC 5545", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = icsFold("X".repeat(160));
    expect(folded.split("\r\n ").every((p) => p.length <= 75)).toBe(true);
    expect(icsFold("é".repeat(60)).split("\r\n ").every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true);
  });
  it("builds a tour event with a reminder and the safety note", () => {
    const ev = tourEvent({ id: "t1", startsAt: "2026-11-05T22:00:00Z", mode: "in_person" }, { title: "DEMO Oakland room", addressText: "100 Demo St, Oakland, CA" });
    const ics = buildIcs([ev], NOW);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261105T220000Z");
    expect(ics).toContain("DTEND:20261105T223000Z");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("LOCATION:100 Demo St\\, Oakland\\, CA");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(() => buildIcs([{ ...ev, startsAt: "nope" }], NOW)).toThrow();
  });
});

describe("sharing", () => {
  it("always states trust status and includes no personal data", () => {
    const demo = listingShareContent(demos[0]!);
    expect(demo.message).toMatch(/FICTIONAL DEMO/);
    expect(demo.message).not.toMatch(/Original listing/);
    const lead = researchLeads()[0]!;
    expect(listingShareContent(lead).message).toMatch(/UNVERIFIED lead/);
    expect(listingShareContent(lead).message).toContain(`housingcompass://listing/${encodeURIComponent(lead.id)}`);
  });
  it("parses links safely", () => {
    expect(parseListingLink("housingcompass://listing/lead-oakland-1")).toBe("lead-oakland-1");
    expect(parseListingLink("https://example.org/listing/demo-a?x=1")).toBe("demo-a");
    expect(parseListingLink("housingcompass://listing/%3Cscript%3E")).toBeNull();
    expect(parseListingLink("https://example.org/other/1")).toBeNull();
  });
});

describe("checklists", () => {
  it("adds household documents for income-restricted homes and always ends with the privacy rule", () => {
    const restricted = demos.find((l) => l.eligibility.incomeRestricted)!;
    const docs = applicationDocuments(restricted).map((d) => d.id);
    expect(docs).toContain("household_income");
    expect(docs.at(-1)).toBe("privacy");
    const market = demos.find((l) => !l.eligibility.incomeRestricted)!;
    expect(applicationDocuments(market).map((d) => d.id)).not.toContain("household_income");
  });
  it("tour-day list includes never paying first, and progress counts only known ids", () => {
    expect(TOUR_DAY_CHECKLIST.find((c) => c.id === "no_pay")?.caution).toBe(true);
    expect(checklistProgress(TOUR_DAY_CHECKLIST, ["address", "bogus"])).toEqual({ done: 1, total: TOUR_DAY_CHECKLIST.length });
  });
});

describe("move-in savings", () => {
  it("weeks to goal and ready date", () => {
    const p = savingsPlan({ targetCents: 300000, savedCents: 100000, perPeriodCents: 25000, period: "week", now: NOW });
    expect(p).toMatchObject({ remainingCents: 200000, periodsNeeded: 8, readyBy: "2026-12-29", status: "on_track" });
    expect(savingsPlan({ targetCents: 1000, savedCents: 5000, perPeriodCents: 0, period: "week", now: NOW }).status).toBe("ready");
    expect(savingsPlan({ targetCents: 1000, savedCents: 0, perPeriodCents: 0, period: "week", now: NOW }).status).toBe("no_savings_rate");
    expect(savingsPlan({ targetCents: 1_000_000, savedCents: 0, perPeriodCents: 1000, period: "month", now: NOW }).status).toBe("long_way");
  });
  it("amount needed per period by a date", () => {
    expect(neededPerPeriod(200000, new Date("2026-12-01T18:00:00Z"), "week", NOW)).toBe(50000);
    expect(neededPerPeriod(100, new Date("2026-01-01"), "week", NOW)).toBeNull();
  });
});

describe("manager response metrics", () => {
  it("hidden below 5 conversations", () => {
    expect(formatResponseStats(responseStatsFromRow({ manager_id: "m", conversations: 4, reply_rate_pct: 100, median_reply_hours: 1 })).show).toBe(false);
    expect(formatResponseStats(null).show).toBe(false);
  });
  it("plain-language summary from the view row", () => {
    const f = formatResponseStats(responseStatsFromRow({ manager_id: "m", conversations: "12", reply_rate_pct: "92", median_reply_hours: "5.2" }));
    expect(f).toMatchObject({ show: true, headline: "Replies to 92% of messages · usually within 6 hours" });
  });
});

describe("moderation", () => {
  it("held messages: release needs a fuller, neutral reason", () => {
    expect(validateHeldDecision("reject", "ok")).toMatch(/reason/);
    expect(validateHeldDecision("release", "looks fine")).toMatch(/15\+/);
    expect(validateHeldDecision("release", "Manager confirmed the deposit is due at lease signing, after tour")).toBeNull();
    expect(validateHeldDecision("reject", "This is a scam")).toMatch(/verdict/);
    expect(releaseNeedsSecondLook(["payment link"])).toBe(false);
    expect(releaseNeedsSecondLook(["payment before tour"])).toBe(true);
  });
  it("landlord approval needs every authority check with a note", () => {
    const all = AUTHORITY_CHECKS.map((check) => ({ check, passed: true, note: "county assessor record" }));
    expect(validateLandlordDecision("approve", all, "Called office via official site")).toBeNull();
    expect(validateLandlordDecision("approve", all.slice(1), "Called office via official site")).toMatch(/Can't approve/);
    expect(validateLandlordDecision("approve", all.map((c) => ({ ...c, note: "" })), "Called office via official site")).toMatch(/Add a note/);
    expect(validateLandlordDecision("needs_info", [], "Need the management agreement")).toBeNull();
  });
  it("lead expiry countdown and queue order", () => {
    const leads = researchLeads();
    const q = leadExpiryQueue(leads, NOW);
    expect(q.length).toBeGreaterThan(0);
    for (let i = 1; i < q.length; i++) expect(q[i]!.daysLeft).toBeGreaterThanOrEqual(q[i - 1]!.daysLeft);
    const s = leadExpirySummary(q);
    expect(s.expired + s.this_week_urgent + s.this_week + s.later).toBe(q.length);
    const l = { ...leads[0]!, source: { ...leads[0]!.source, lastPriceCheckAt: "2026-11-01T18:00:00Z" } };
    expect(leadExpiry(l, NOW)).toMatchObject({ daysLeft: 12, bucket: "later" });
  });
});

describe("photo pipeline", () => {
  const ok = { mime: "image/jpeg", bytes: 2_000_000, width: 1600, height: 1200, rightsAttested: true };
  it("validates uploads", () => {
    expect(validatePhotoUpload(ok)).toBeNull();
    expect(validatePhotoUpload({ ...ok, mime: "image/gif" })).toBe("type");
    expect(validatePhotoUpload({ ...ok, rightsAttested: false })).toBe("no_attestation");
    expect(validatePhotoUpload({ ...ok, width: 300 })).toBe("too_small");
  });
  it("blocks publishing until scanned, attested and not reused", () => {
    const p = { id: "p1", listingId: "L1", status: "clean" as const, dhash: "ffffffff00000000", rightsAttested: true };
    const other = { id: "p2", listingId: "L2", status: "published" as const, dhash: "ffffffff00000001", rightsAttested: true };
    expect(findReusedPhoto(p.dhash, "L1", [other])?.id).toBe("p2");
    expect(canPublishPhoto(p, [other])).toBe("reused");
    expect(canPublishPhoto(p, [])).toBeNull();
    expect(canPublishPhoto({ ...p, status: "quarantined" }, [])).toBe("not_scanned");
    expect(canPublishPhoto({ ...p, status: "infected" }, [])).toBe("infected");
    expect(quarantinePath("m/1", "L 1", "p..1", "image/png")).toBe("m_1/L_1/p__1.png");
  });
});

describe("alert preferences", () => {
  it("drops kinds the user turned off", () => {
    const fav = demos.find((l) => l.eligibility.applicationDeadline)!;
    const base = { userId: "u", savedSearches: [], favorites: [fav.id], applications: [], listings: [fav], priceChanges: [{ listingId: fav.id, oldCents: 200000, newCents: 190000 }], now: new Date(new Date(fav.eligibility.applicationDeadline!).getTime() - 86_400_000) };
    const all = planAlerts({ ...base, prefs: DEFAULT_ALERT_PREFS });
    expect(all.map((a) => a.kind)).toEqual(expect.arrayContaining(["deadline_reminder", "listing_changed"]));
    const some = planAlerts({ ...base, prefs: { ...DEFAULT_ALERT_PREFS, kinds: ["listing_changed"] } });
    expect(some.map((a) => a.kind)).toEqual(["listing_changed"]);
  });
  it("normalizes bad input", () => {
    expect(normalizeAlertPrefs({ quietStart: 99 as number, maxPushPerDay: 100, kinds: ["listing_changed", "bogus" as never] })).toMatchObject({ quietStart: 21, maxPushPerDay: 20, kinds: ["listing_changed"] });
    expect(normalizeAlertPrefs({ quietStart: null, quietEnd: null })).toMatchObject({ quietStart: null, quietEnd: null });
  });
});

describe("data export + languages", () => {
  it("export is readable JSON with the device data", () => {
    const j = JSON.parse(buildDataExport({ favorites: ["a"], savedSearches: [], reports: [], applications: [], conversations: [], priceHistory: {}, alertPrefs: null, checklists: {}, savings: null }, null, NOW));
    expect(j).toMatchObject({ format: "housing-compass-export", version: 1, device: { favorites: ["a"] }, server: null });
  });
  it("every locale has every domain label; Chinese is selectable", () => {
    expect(LOCALES).toContain("zh");
    for (const loc of LOCALES) {
      for (const key of ["category", "level", "levelExplainer", "basis"] as const) {
        expect(Object.keys(DOMAIN_TEXT[loc][key]).sort()).toEqual(Object.keys(DOMAIN_TEXT.en[key]).sort());
      }
    }
    expect(pickLocale(["zh-Hans-CN"])).toBe("zh");
    expect(DOMAIN_TEXT.zh.levelExplainer.SOURCE_LISTED_UNVERIFIED).toMatch(/绝不要付钱/);
  });
});

describe("programs table", () => {
  it("maps rows and rejects bad ones", async () => {
    const { programFromRow, PROGRAMS } = await import("../src/index");
    const p = PROGRAMS[0]!;
    const row = { id: p.id, regions: p.regions, name: p.name, operator: p.operator, kind: p.kind, url: p.url, phone: p.phone, tty: p.tty, hours: p.hours, what_it_is: p.whatItIs, waitlist_info: p.waitlistInfo, eligibility_info: p.eligibilityInfo, vacancy_info: p.vacancyInfo, checked_on: p.checkedOn, sources: p.sources };
    expect(programFromRow(row)).toEqual(p);
    expect(programFromRow({ ...row, url: "http://insecure.example" })).toBeNull();
    expect(programFromRow({ ...row, regions: ["mars"] })).toBeNull();
  });
});
