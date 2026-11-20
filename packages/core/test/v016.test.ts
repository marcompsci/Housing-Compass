import { describe, expect, it } from "vitest";
import {
  buildPlan,
  conditionProgress,
  conditionReport,
  csvCell,
  depositRequestLetter,
  depositReturnStatus,
  dueDateFor,
  paymentsCsv,
  paymentTiming,
  rememberSearch,
  reminderSchedule,
  rentOfficesFor,
  rentSummary,
  validatePayment,
  waitlistAttention,
  LOCAL_RENT_OFFICES,
  ROOM_ITEMS,
  type RentPayment,
  type RentSetup,
} from "../src";

const setup: RentSetup = { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "Oak Street Apts" };
const pay = (month: string, paidOn: string, amountCents = 140000): RentPayment => ({ id: `${month}-${paidOn}`, month, paidOn, amountCents, method: "portal", confirmation: "" });

describe("rent tracker", () => {
  it("clamps due day to month length", () => {
    expect(dueDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateFor("2026-11", 1)).toBe("2026-11-01");
  });
  it("counts the grace period as on time", () => {
    expect(paymentTiming(pay("2026-10", "2026-10-04"), setup)).toBe("on_time");
    expect(paymentTiming(pay("2026-10", "2026-10-05"), setup)).toBe("late");
  });
  it("builds a streak from the newest month back and stops at a late month", () => {
    const ps = [pay("2026-07", "2026-07-01"), pay("2026-08", "2026-08-09"), pay("2026-09", "2026-09-01"), pay("2026-10", "2026-09-30")];
    const s = rentSummary(setup, ps, new Date("2026-10-15T12:00:00Z"));
    expect(s.onTimeStreak).toBe(2);
    expect(s.onTimeMonths).toBe(3);
    expect(s.monthsLogged).toBe(4);
    expect(s.currentMonthPaid).toBe(true);
    expect(s.nextDue).toBe("2026-11-01");
    expect(s.daysUntilDue).toBe(17);
  });
  it("treats split payments as a full month only when they add up", () => {
    const ps = [pay("2026-10", "2026-10-01", 70000)];
    expect(rentSummary(setup, ps, new Date("2026-10-02T12:00:00Z")).currentMonthPaid).toBe(false);
    ps.push(pay("2026-10", "2026-10-02", 70000));
    expect(rentSummary(setup, ps, new Date("2026-10-02T12:00:00Z")).onTimeStreak).toBe(1);
  });
  it("reports overdue rent as negative days", () => {
    const s = rentSummary(setup, [], new Date("2026-11-06T12:00:00Z"));
    expect(s.nextDue).toBe("2026-11-01");
    expect(s.daysUntilDue).toBe(-5);
  });
  it("validates payments", () => {
    expect(validatePayment({ month: "2026-13", paidOn: "2026-10-01", amountCents: 1, method: "portal", confirmation: "" }, [])).toMatch(/month/);
    expect(validatePayment({ month: "2026-10", paidOn: "bad", amountCents: 1, method: "portal", confirmation: "" }, [])).toMatch(/date/);
    expect(validatePayment({ month: "2026-10", paidOn: "2026-10-01", amountCents: 0, method: "portal", confirmation: "" }, [])).toMatch(/amount/);
    const p = pay("2026-10", "2026-10-01");
    expect(validatePayment(p, [p])).toMatch(/already/);
    expect(validatePayment(p, [])).toBeNull();
  });
});

describe("CSV export", () => {
  it("neutralizes spreadsheet formulas and quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
  it("writes one row per payment in month order", () => {
    const csv = paymentsCsv(setup, [pay("2026-10", "2026-10-09"), pay("2026-09", "2026-09-01")]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"2026-09"');
    expect(lines[2]).toContain('"no"');
    expect(lines[1]).toContain('"1400.00"');
  });
});

describe("move-in and move-out", () => {
  it("tracks progress and reports damaged items", () => {
    const at = "2026-11-01T10:00:00Z";
    const entries = [
      { room: "kitchen" as const, item: ROOM_ITEMS.kitchen[0]!, condition: "damaged" as const, note: "burner 2 dead", at },
      { room: "bathroom" as const, item: ROOM_ITEMS.bathroom[0]!, condition: "good" as const, note: "", at },
    ];
    const p = conditionProgress(entries);
    expect(p.done).toBe(2);
    expect(p.damaged).toBe(1);
    expect(p.total).toBeGreaterThan(15);
    const r = conditionReport(entries, { address: "1 Main St", moveInDate: "2026-11-01" }, new Date(at));
    expect(r).toContain("KITCHEN");
    expect(r).toContain("burner 2 dead");
    expect(r).not.toContain("BEDROOM");
  });
  it("counts 21 days for the deposit", () => {
    expect(depositReturnStatus("2026-10-01", new Date("2026-10-05T08:00:00Z"))).toEqual({ deadline: "2026-10-22", daysLeft: 17, state: "waiting" });
    expect(depositReturnStatus("2026-10-01", new Date("2026-10-20T08:00:00Z")).state).toBe("due_soon");
    expect(depositReturnStatus("2026-10-01", new Date("2026-10-25T08:00:00Z")).state).toBe("overdue");
  });
  it("writes a factual request letter", () => {
    const l = depositRequestLetter({ tenantName: "A. Renter", address: "1 Main St", moveOutDate: "2026-10-01", depositCents: 140000, forwardingAddress: "2 Elm St" });
    expect(l).toContain("$1,400.00");
    expect(l).toContain("21 days");
    expect(l).toContain("2 Elm St");
  });
});

describe("waitlists, plan and reminders", () => {
  const now = new Date("2026-11-02T15:00:00Z");
  const w = { id: "w1", programName: "Section 8", joinedOn: "2026-01-01", confirmation: "", nextCheckIn: "2026-11-05", status: "waiting" as const, notes: "" };
  it("flags check-ins due within a week or overdue", () => {
    expect(waitlistAttention(w, now)).toBe("check_in_soon");
    expect(waitlistAttention({ ...w, nextCheckIn: "2026-10-30" }, now)).toBe("check_in_overdue");
    expect(waitlistAttention({ ...w, nextCheckIn: "2026-12-30" }, now)).toBeNull();
    expect(waitlistAttention({ ...w, status: "invited" }, now)).toBeNull();
  });
  it("orders the plan by date and leaves out far-off or finished items", () => {
    const plan = buildPlan({
      rent: { setup, payments: [] },
      tours: [
        { id: "t1", threadId: "c1", title: "Studio on 14th", startsAt: "2026-11-03T18:00:00Z", status: "confirmed" },
        { id: "t2", threadId: "c2", title: "Far", startsAt: "2027-03-01T18:00:00Z", status: "confirmed" },
      ],
      applications: [
        { id: "a1", title: "Lottery", deadline: "2026-11-10", nextActionAt: null, status: "interested" },
        { id: "a2", title: "Done", deadline: "2026-11-10", nextActionAt: null, status: "applied" },
      ],
      moveOut: { moveOutDate: "2026-10-20", depositCents: 100000 },
      waitlists: [w],
      now,
    });
    expect(plan.map((p) => p.kind)).toEqual(["rent_due", "tour", "waitlist_check_in", "app_deadline", "deposit_return"]);
    expect(plan[0]!.urgent).toBe(true);
    expect(plan[1]!.urgent).toBe(true);
    expect(plan.find((p) => p.kind === "deposit_return")!.date).toBe("2026-11-10");
  });
  it("schedules rent and tour reminders only in the future", () => {
    const r = reminderSchedule({
      rent: { setup, payments: [pay("2026-11", "2026-11-01")] },
      tours: [
        { id: "t1", threadId: "c1", title: "Studio", startsAt: "2026-11-03T18:00:00Z", status: "confirmed" },
        { id: "t0", threadId: "c0", title: "Past", startsAt: "2026-11-02T15:30:00Z", status: "confirmed" },
        { id: "t3", threadId: "c3", title: "Pending", startsAt: "2026-11-04T18:00:00Z", status: "proposed" },
      ],
      now,
      utcOffsetMinutes: -480,
    });
    expect(r.map((x) => x.id)).toEqual(["tour:t1", "rent:2026-12-01:3", "rent:2026-12-01:0"]);
    expect(r[0]!.at).toBe("2026-11-03T17:00:00.000Z");
    expect(r[2]!.at).toBe("2026-12-01T17:00:00.000Z");
  });
});

describe("local rent rules and recent searches", () => {
  it("finds the city's office plus the statewide fallback", () => {
    const o = rentOfficesFor("San Francisco");
    expect(o.map((x) => x.id)).toEqual(["sf_rent_board", "ca_statewide"]);
    expect(rentOfficesFor("Fremont").map((x) => x.id)).toEqual(["ca_statewide"]);
    expect(rentOfficesFor("", "Los Angeles County")[0]!.id).toBe("la_county_dcba");
  });
  it("only lists official government sites", () => {
    for (const o of LOCAL_RENT_OFFICES) expect(new URL(o.url).hostname).toMatch(/(\.gov|sanjoseca\.gov|berkeleyca\.gov|oaklandca\.gov|lacounty\.gov|lacity\.gov)$/);
  });
  it("keeps recent searches unique, newest first, capped", () => {
    let r: string[] = [];
    for (const q of ["oakland", "studio", "Oakland ", "a", "q1", "q2", "q3", "q4", "q5"]) r = rememberSearch(r, q);
    expect(r[0]).toBe("q5");
    expect(r).not.toContain("a");
    expect(r).toEqual(["q5", "q4", "q3", "q2", "q1", "Oakland"]);
    expect(r.length).toBe(6);
  });
});

describe("App Store privacy manifest", () => {
  it("app.json declares exactly what PRIVACY_DECLARATION says, with no tracking", async () => {
    const { readFileSync } = await import("node:fs");
    const { PRIVACY_DECLARATION } = await import("../src");
    const app = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8"));
    const pm = app.expo.ios.privacyManifests;
    expect(pm.NSPrivacyTracking).toBe(false);
    expect(pm.NSPrivacyCollectedDataTypes.map((d: { NSPrivacyCollectedDataType: string }) => d.NSPrivacyCollectedDataType)).toEqual(PRIVACY_DECLARATION.collected.map((c) => c.type));
    expect(pm.NSPrivacyCollectedDataTypes.every((d: { NSPrivacyCollectedDataTypeTracking: boolean }) => !d.NSPrivacyCollectedDataTypeTracking)).toBe(true);
    expect(app.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription).toMatch(/approximate location/);
    expect(app.expo.android.blockedPermissions).toContain("ACCESS_FINE_LOCATION");
  });
});
