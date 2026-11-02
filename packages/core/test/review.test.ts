import { describe, expect, it } from "vitest";
import { VERIFICATION_CHECKS, buildReviewQueue, demoListings, evidenceGaps, neutralLanguageIssue, researchLeads, type EvidenceEntry } from "../src/index";

const NOW = new Date("2026-11-03T12:00:00-08:00");

describe("review queue", () => {
  it("puts payment-related reports and hold signals first", () => {
    const all = [...researchLeads(), ...demoListings(NOW)];
    const q = buildReviewQueue(
      all,
      [
        { listingId: "lead-oakland-44th-st", reason: "not_available" },
        { listingId: "lead-richmond-421-22nd-st", reason: "upfront_payment" },
      ],
      [],
      { managers: [], now: NOW },
    );
    expect(q.map((i) => i.listing.id)).toEqual(["lead-richmond-421-22nd-st", "demo-flagged-sf", "lead-oakland-44th-st"]);
    expect(q[1]!.holdSignals).toBeGreaterThan(0);
  });
});

describe("reviewer language", () => {
  it("rejects verdict words and empty reasons", () => {
    expect(neutralLanguageIssue("total scam")).toMatch(/instead of a verdict/);
    expect(neutralLanguageIssue("ok")).toMatch(/reason/);
    expect(neutralLanguageIssue("Asked for a wire transfer before the tour")).toBeNull();
  });
});

describe("evidence gaps", () => {
  const full: EvidenceEntry[] = VERIFICATION_CHECKS.map((check) => ({ check, passed: true, kind: "phone_call", independentSource: "manager's official website", notes: "confirmed" }));
  it("is empty when all six checks have evidence", () => expect(evidenceGaps(full)).toEqual([]));
  it("requires an independent source for the contact channel", () => {
    const e = full.map((x) => (x.check === "contact_channel" ? { ...x, independentSource: "" } : x));
    expect(evidenceGaps(e)).toEqual(["say where you found the contact independently"]);
  });
  it("lists every missing check", () => expect(evidenceGaps(full.slice(0, 4))).toHaveLength(2));
});
