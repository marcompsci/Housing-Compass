import { describe, expect, it } from "vitest";
import {
  CA_RIGHTS,
  CA_SCREENING_FEE_CAP_2026_CENTS,
  DEFAULT_FILTERS,
  REPORT_STATUS_TEXT,
  TOUR_DAY_CHECKLIST,
  applicationDocuments,
  demoListings,
  describeEdit,
  editToDb,
  feeChecks,
  localizeChecklist,
  matchesQuery,
  normalizeText,
  researchLeads,
  search,
  validateAreaName,
  validateEditRequest,
  effectiveMonthlyCents,
  type Listing,
} from "../src/index";

const NOW = new Date("2026-11-04T18:00:00Z");
const demos = demoListings(NOW);
const base = demos.find((l) => !l.isDemo || true)!;
const withCosts = (rent: number, deposit: number | null, fee: number | null, state = "CA"): Listing => ({
  ...base,
  address: { ...base.address, state },
  pricing: { ...base.pricing, baseRentCents: rent, depositCents: deposit, applicationFeeCents: fee },
});

describe("California fee and deposit checks", () => {
  it("flags deposits over one and two months, softly", () => {
    expect(feeChecks(withCosts(150000, 150000, 3000))).toEqual([]);
    expect(feeChecks(withCosts(150000, 200000, null)).map((c) => c.code)).toEqual(["deposit_over_one_month"]);
    const two = feeChecks(withCosts(150000, 450000, null));
    expect(two[0]).toMatchObject({ code: "deposit_over_two_months", severity: "warn" });
    for (const c of [...two, ...feeChecks(withCosts(150000, 200000, null))]) expect(c.message).not.toMatch(/illegal|scam|fraud/i);
  });
  it("flags application fees above the statewide cap only", () => {
    expect(feeChecks(withCosts(150000, null, CA_SCREENING_FEE_CAP_2026_CENTS))).toEqual([]);
    expect(feeChecks(withCosts(150000, null, 10000)).map((c) => c.code)).toEqual(["app_fee_over_cap"]);
  });
  it("skips unknown amounts and non-California homes", () => {
    expect(feeChecks(withCosts(150000, null, null))).toEqual([]);
    expect(feeChecks(withCosts(150000, 500000, 20000, "NV"))).toEqual([]);
  });
  it("every rights topic cites an official-looking https source", () => {
    for (const t of CA_RIGHTS) {
      expect(t.source.url).toMatch(/^https:\/\/(leginfo\.legislature\.ca\.gov|www\.dre\.ca\.gov)/);
      expect(t.summary.length).toBeGreaterThan(40);
    }
  });
});

describe("keyword search and total-cost sort", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalizeText("  Peñasquitos, CA!  ")).toBe("penasquitos ca");
  });
  it("matches every word against title, street, city and ZIP", () => {
    const l = researchLeads().find((x) => x.address.city === "Oakland")!;
    expect(matchesQuery(l, "oakland")).toBe(true);
    expect(matchesQuery(l, "OAKLAND " + l.address.line1.split(" ").pop())).toBe(true);
    expect(matchesQuery(l, "oakland zzzz")).toBe(false);
    expect(matchesQuery(l, null)).toBe(true);
  });
  it("search applies the query and can sort by all-in monthly cost", () => {
    const all = [...researchLeads(), ...demos];
    const r = search(all, { ...DEFAULT_FILTERS, includeDemo: true, includeUnverified: true, query: "oakland" });
    expect(r.hits.length).toBeGreaterThan(0);
    for (const h of r.hits) expect(matchesQuery(h.listing, "oakland")).toBe(true);
    const sorted = search(all, { ...DEFAULT_FILTERS, includeDemo: true, includeUnverified: true, sort: "total_monthly" }).hits;
    // within the same trust/basis/budget group, totals never decrease
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!, b = sorted[i]!;
      const sameGroup = a.listing.verification.level === b.listing.verification.level && a.listing.pricing.basis === b.listing.pricing.basis && a.budget === b.budget;
      if (sameGroup) expect(effectiveMonthlyCents(b.listing).cents).toBeGreaterThanOrEqual(effectiveMonthlyCents(a.listing).cents);
    }
  });
});

describe("manager edit requests", () => {
  const l = { ...base, status: "active" as const };
  it("validates changes", () => {
    expect(validateEditRequest(l, {}, "note here", NOW)).toMatch(/at least one/);
    expect(validateEditRequest(l, { baseRentCents: 120000 }, "x", NOW)).toMatch(/note/);
    expect(validateEditRequest(l, { baseRentCents: 0 }, "rent change", NOW)).toMatch(/\$0/);
    expect(validateEditRequest(l, { baseRentCents: l.pricing.baseRentCents }, "same rent", NOW)).toMatch(/already/);
    expect(validateEditRequest(l, { markLeased: true, depositCents: 1 }, "rented it", NOW)).toMatch(/can't be combined/);
    expect(validateEditRequest(l, { moveInDate: "2030-01-01" }, "far future", NOW)).toMatch(/within the next year/);
    expect(validateEditRequest({ ...l, status: "leased" }, { confirmAvailable: true }, "still open", NOW)).toMatch(/active/);
    expect(validateEditRequest(l, { baseRentCents: 131500, confirmAvailable: true }, "New rent from Dec 1", NOW)).toBeNull();
  });
  it("describes and maps to database columns", () => {
    expect(describeEdit(l, { baseRentCents: 131500, markLeased: undefined })[0]).toMatch(/Rent .* → \$1,315/);
    expect(editToDb({ baseRentCents: 1, depositCents: 2, applicationFeeCents: 3, moveInDate: "2026-12-01", confirmAvailable: true })).toEqual({
      base_rent_cents: 1, deposit_cents: 2, application_fee_cents: 3, move_in_date: "2026-12-01", confirm_available: true,
    });
  });
});

describe("report status, saved areas, checklist translations", () => {
  it("every report status has plain text", () => {
    for (const k of ["local", "open", "triaged", "actioned", "dismissed"] as const) expect(REPORT_STATUS_TEXT[k].label).toBeTruthy();
  });
  it("area names", () => {
    expect(validateAreaName(" ", [])).toMatch(/2–40/);
    expect(validateAreaName("Near work", ["near WORK"])).toMatch(/already/);
    expect(validateAreaName("Downtown Oakland", [])).toBeNull();
  });
  it("checklists translate every item, keep ids and order, and keep numbers", () => {
    const restricted = demos.find((l) => l.eligibility.incomeRestricted)!;
    const items = [...TOUR_DAY_CHECKLIST, ...applicationDocuments({ ...restricted, amenities: { ...restricted.amenities, acceptsVouchers: true }, eligibility: { ...restricted.eligibility, minIncomeMultipleOfRent: 2.5 } })];
    for (const loc of ["es", "zh"] as const) {
      const tr = localizeChecklist(items, loc);
      expect(tr.map((i) => i.id)).toEqual(items.map((i) => i.id));
      tr.forEach((t, i) => expect(t.label, `${loc}:${t.id}`).not.toBe(items[i]!.label));
      expect(tr.find((i) => i.id === "income_multiple")?.label).toContain("2.5");
    }
    expect(localizeChecklist(items, "en")).toBe(items);
  });
});

describe("message-checker warnings are translated", () => {
  it("keeps codes and severity, swaps text", async () => {
    const { checkReceivedMessage, localizeWarning } = await import("../src/index");
    const r = checkReceivedMessage("Send the deposit by Zelle before the tour, many people are interested, text me on WhatsApp");
    expect(r.warnings.length).toBeGreaterThan(1);
    for (const loc of ["es", "zh"] as const) {
      for (const w of r.warnings) {
        const t = localizeWarning(w, loc);
        expect(t.code).toBe(w.code);
        expect(t.severity).toBe(w.severity);
        expect(t.why).not.toBe(w.why);
        expect(t.why).not.toContain("{method}");
      }
    }
  });
});
