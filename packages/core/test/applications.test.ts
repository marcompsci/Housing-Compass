import { describe, expect, it } from "vitest";
import { NEXT_STEP, attention, canMove, moveApplication, sortApplications, type TrackedApplication } from "../src/index";

const NOW = new Date("2026-11-03T12:00:00Z");
const app = (p: Partial<TrackedApplication> = {}): TrackedApplication => ({
  id: "a1", listingId: "x", title: "Home", status: "interested", deadline: null, nextActionAt: null, notes: "", history: [{ status: "interested", at: NOW.toISOString() }], updatedAt: NOW.toISOString(), ...p,
});

describe("applications", () => {
  it("only allows sensible moves and records history", () => {
    expect(canMove("interested", "leased")).toBe(false);
    const a = moveApplication(moveApplication(app(), "applied", NOW), "offered", NOW);
    expect(a.history.map((h) => h.status)).toEqual(["interested", "applied", "offered"]);
    expect(() => moveApplication(a, "lottery_entered", NOW)).toThrow(/Can't move/);
  });
  it("flags deadlines, follow-ups and stale applications", () => {
    expect(attention(app({ deadline: "2026-11-04T12:00:00Z" }), NOW)).toBe("deadline_soon");
    expect(attention(app({ deadline: "2026-11-01T12:00:00Z" }), NOW)).toBe("deadline_passed");
    expect(attention(app({ status: "applied", nextActionAt: "2026-11-02T00:00:00Z" }), NOW)).toBe("follow_up_due");
    expect(attention(app({ status: "waitlisted", updatedAt: "2026-10-01T00:00:00Z" }), NOW)).toBe("stale");
    expect(attention(app({ status: "leased", updatedAt: "2026-01-01T00:00:00Z" }), NOW)).toBeNull();
  });
  it("sorts urgent first and finished last", () => {
    const xs = [app({ id: "done", status: "leased" }), app({ id: "plain" }), app({ id: "urgent", deadline: "2026-11-04T00:00:00Z" })];
    expect(sortApplications(xs, NOW).map((a) => a.id)).toEqual(["urgent", "plain", "done"]);
  });
  it("offer step includes payment safety", () => expect(NEXT_STEP.offered).toMatch(/never wire/));
});
