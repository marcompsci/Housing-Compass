import { describe, expect, it } from "vitest";
import { badges, dailyDigest, monthReport, parseAsk, parseBackup, previousMonth, purchaseImpact, returnStatus, trackerPlanItems, trialStatus } from "../src";

describe("ask", () => {
  it("understands short questions in three languages", () => {
    expect(parseAsk("Can I afford $45 shoes?")).toEqual({ intent: "afford", amountCents: 4500 });
    expect(parseAsk("what's due this week")).toEqual({ intent: "due", amountCents: null });
    expect(parseAsk("How much can I spend today?").intent).toBe("safe");
    expect(parseAsk("can I spend 30").intent).toBe("afford");
    expect(parseAsk("when is payday").intent).toBe("payday");
    expect(parseAsk("¿Cuándo estaré libre de deudas?").intent).toBe("debt");
    expect(parseAsk("¿Me alcanza para 20,50?")).toEqual({ intent: "afford", amountCents: 2050 });
    expect(parseAsk("我的信用卡使用率").intent).toBe("credit");
    expect(parseAsk("净资产").intent).toBe("net_worth");
    expect(parseAsk("how's my budget").intent).toBe("budget");
    expect(parseAsk("hello").intent).toBe("unknown");
    expect(parseAsk("80").intent).toBe("afford");
  });
});

describe("trials, returns, nudges", () => {
  const today = "2026-11-20";
  const trials = [
    { id: "a", name: "StreamPlus", endsOn: "2026-11-22", costCents: 1599, cycle: "month" as const, canceled: false },
    { id: "b", name: "Music", endsOn: "2026-12-30", costCents: 9900, cycle: "year" as const, canceled: true },
  ];
  const returns = [{ id: "r", item: "Jacket", store: "Target", amountCents: 6000, returnBy: "2026-11-25", returned: false }];
  it("adds up what trials would cost and what returns are still open", () => {
    expect(trialStatus(trials, today)).toMatchObject({ active: 1, wouldCostYearCents: 19188, savedYearCents: 9900 });
    expect(returnStatus(returns, today)).toMatchObject({ openCents: 6000, recoveredCents: 0 });
  });
  it("puts trials, returns and old IOUs in My plan", () => {
    const items = trackerPlanItems({ trials, returns, ious: [{ id: "i", date: "2026-10-30", person: "Sam", amountCents: 4500, note: "", settled: false }], now: new Date("2026-11-20T12:00:00Z"), hasMoneyData: true });
    expect(items.map((x) => x.detailCode)).toEqual(["trial_ends", "return_by", "iou_nudge"]);
    expect(items[0]).toMatchObject({ date: "2026-11-20", urgent: true });
    expect(trackerPlanItems({ trials: [], returns: [], ious: [], now: new Date("2026-12-02T12:00:00Z"), hasMoneyData: true })[0]!.detailCode).toBe("month_report");
  });
});

describe("report, digest, impact, badges, backups", () => {
  it("summarizes a month", () => {
    const r = monthReport({
      month: "2026-10",
      payments: [{ id: "1", month: "2026-10", paidOn: "2026-10-03", amountCents: 140000, method: "portal", confirmation: "", lateFeeCents: 5000 }],
      billPaid: { a: ["2026-10"] },
      bills: [{ id: "a", name: "A", amountCents: 5000, dueDay: 1, category: "phone", autopay: false }, { id: "b", name: "B", amountCents: 1, dueDay: 1, category: "phone", autopay: false }],
      spends: [{ id: "s", date: "2026-10-04", amountCents: 1200, note: "" }],
      side: [{ id: "x", date: "2026-10-09", source: "Uber", amountCents: 9000 }],
      contribs: [{ goalId: "g", date: "2026-10-10", amountCents: 2500 }],
    });
    expect(r).toMatchObject({ rentCents: 140000, lateFeesCents: 5000, billsPaid: 1, billsTotal: 2, spentCents: 1200, sideCents: 9000, savedCents: 2500 });
    expect(r.text).toContain("Bills paid: 1 of 2 ($50)");
    expect(previousMonth("2026-01-03")).toBe("2025-12");
  });
  it("schedules a morning digest for days with something due", () => {
    const d = dailyDigest(
      [
        { id: "r", name: "Rent", amountCents: 140000, dueDate: "2026-11-21", kind: "rent" },
        { id: "p", name: "Phone", amountCents: 6500, dueDate: "2026-11-21", kind: "bill" },
        { id: "q", name: "Gym", amountCents: 3000, dueDate: "2026-12-20", kind: "bill" },
      ],
      new Date("2026-11-20T20:00:00Z"),
      -480,
      8,
    );
    expect(d).toEqual([{ id: "digest:2026-11-21", at: "2026-11-21T16:00:00.000Z", title: "2 payments due today", body: "Rent $1,400, Phone $65 — total $1,465" }]);
  });
  it("shows a purchase in work hours and goal delay", () => {
    expect(purchaseImpact({ priceCents: 12000, hourlyCents: 2400, goalPerWeekCents: 5000 })).toEqual({ hours: 5, goalDelayWeeks: 3 });
    expect(purchaseImpact({ priceCents: 1, hourlyCents: null, goalPerWeekCents: 0 })).toEqual({ hours: null, goalDelayWeeks: null });
  });
  it("awards badges from real progress", () => {
    const b = badges({ onTimeRentMonths: 3, rentMonths: 4, allBillsStreak: 1, goalsDone: 0, debtsPaidOff: 1, emergencyMonths: 0.5, wins: 2, underLimitWeeks: 0, challengeWeeks: 3, reportChecks: 1, netWorthChange: 200, sideIncomeEntries: 2 });
    expect(b.earned).toBe(6);
    expect(b.list.find((x) => x.id === "emergency_month")).toMatchObject({ earned: false, progress: 0.5 });
  });
  it("accepts v0.25 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], trials: [{ id: "a", name: "X", endsOn: "2026-12-01", costCents: 999, cycle: "month", canceled: false }], returns: [], digestHour: 8 };
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data })).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data: { ...data, digestHour: 3 } })).ok).toBe(false);
  });
});
