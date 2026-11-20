import { describe, expect, it } from "vitest";
import {
  billPromoItems,
  canAfford,
  debtProgress,
  disputeLetter,
  parseBackup,
  reportReminder,
  scoreTrend,
  underLimitStreak,
  weekSpending,
  weekStart,
  weeklyReview,
  windfallPlan,
  type Bill,
  type ForecastDay,
} from "../src";

const day = (date: string, balanceCents: number): ForecastDay => ({ date, inCents: 0, outCents: 0, balanceCents });

describe("can I afford this?", () => {
  const series = [day("2026-11-20", 30000), day("2026-11-25", 8000), day("2026-11-28", 150000), day("2026-12-05", 120000)];
  it("gives a clear verdict", () => {
    expect(canAfford({ priceCents: 4000, safeCents: 20000, series, nextPayday: "2026-11-28" }).verdict).toBe("yes");
    expect(canAfford({ priceCents: 18000, safeCents: 20000, series, nextPayday: "2026-11-28" }).verdict).toBe("tight");
    const w = canAfford({ priceCents: 60000, safeCents: 20000, series, nextPayday: "2026-11-28" });
    expect(w).toMatchObject({ verdict: "wait", waitUntil: "2026-11-28", leftCents: -40000 });
    expect(canAfford({ priceCents: 200000, safeCents: 20000, series, nextPayday: "2026-11-28" }).verdict).toBe("no");
  });
});

describe("weekly spending", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-20")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });
  const spends = [
    { id: "1", date: "2026-11-17", amountCents: 3000, note: "" },
    { id: "2", date: "2026-11-20", amountCents: 4500, note: "" },
    { id: "3", date: "2026-11-10", amountCents: 9000, note: "" },
    { id: "4", date: "2026-11-03", amountCents: 20000, note: "" },
  ];
  it("tracks what's left this week", () => {
    expect(weekSpending(spends, 10000, "2026-11-20")).toMatchObject({ spentCents: 7500, leftCents: 2500, over: false, daysLeft: 3, perDayLeftCents: 833, count: 2 });
    expect(weekSpending(spends, null, "2026-11-20").leftCents).toBeNull();
  });
  it("counts finished weeks under the limit", () => {
    expect(underLimitStreak(spends, 10000, "2026-11-20")).toBe(1);
    expect(underLimitStreak(spends, 25000, "2026-11-20")).toBe(2);
    expect(underLimitStreak([], 10000, "2026-11-20")).toBe(0);
  });
  it("writes a weekly review", () => {
    const bills: Bill[] = [{ id: "a", name: "A", amountCents: 1, dueDay: 1, category: "phone", autopay: false }];
    const r = weeklyReview({ today: "2026-11-20", spends, limitCents: 10000, side: [{ id: "s", date: "2026-11-18", source: "x", amountCents: 5000 }], billPaid: { a: ["2026-11"] }, bills });
    expect(r.text).toBe("Week of 2026-11-16: spent $75 of $100, side income $50, 1/1 bills paid this month.");
  });
});

describe("windfall, scores, debts", () => {
  it("splits a windfall in a sensible order", () => {
    const p = windfallPlan({ amountCents: 200000, overdueCents: 10000, emergencyCents: 50000, monthlyEssentialsCents: 150000, debts: [{ id: "a", name: "Card", balanceCents: 40000, apr: 29, minPaymentCents: 1 }, { id: "b", name: "Car", balanceCents: 900000, apr: 7, minPaymentCents: 1 }], goalsLeftCents: 100000, funPct: 10 });
    expect(p.rows).toEqual([
      { id: "overdue", cents: 10000 },
      { id: "emergency", cents: 100000 },
      { id: "debt", cents: 40000, name: "Card" },
      { id: "goals", cents: 30000 },
      { id: "fun", cents: 20000 },
    ]);
  });
  it("shows score changes from the user's own entries", () => {
    const t = scoreTrend([
      { id: "1", date: "2026-09-01", score: 640, source: "Bank app" },
      { id: "2", date: "2026-10-01", score: 655, source: "Card app" },
      { id: "3", date: "2026-11-01", score: 662, source: "Bank app" },
    ]);
    expect(t).toMatchObject({ change: 7, sameSourceChange: 22, min: 640, max: 662 });
    expect(t.latest!.score).toBe(662);
    expect(scoreTrend([]).latest).toBeNull();
  });
  it("tracks progress against starting balances", () => {
    const p = debtProgress([
      { id: "a", name: "Card", balanceCents: 0, startBalanceCents: 50000, apr: 20, minPaymentCents: 1 },
      { id: "b", name: "Loan", balanceCents: 75000, startBalanceCents: 100000, apr: 8, minPaymentCents: 1 },
      { id: "c", name: "Old", balanceCents: 1000, apr: 8, minPaymentCents: 1 },
    ]);
    expect(p).toMatchObject({ startCents: 151000, paidCents: 75000, pct: 50, paidOff: 1 });
    expect(p.rows[1]!.pct).toBe(25);
  });
});

describe("promo watch, letters, reminders, backups", () => {
  it("flags bills whose promo price ends soon", () => {
    const bills: Bill[] = [
      { id: "i", name: "Internet", amountCents: 5000, dueDay: 3, category: "internet", autopay: true, promoEnds: "2026-12-01" },
      { id: "p", name: "Phone", amountCents: 5000, dueDay: 3, category: "phone", autopay: true, promoEnds: "2027-06-01" },
    ];
    const items = billPromoItems(bills, new Date("2026-11-20T12:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ date: "2026-11-24", n: 11, urgent: false, detailCode: "promo_call" });
  });
  it("writes a dispute letter with placeholders for anything missing", () => {
    const l = disputeLetter({ name: "Omari Bell", address: "", bureau: "experian", item: "Acme Card ending 1234: late payment in March 2026", why: "", today: "2026-11-20" });
    expect(l).toContain("To: Experian — Dispute department");
    expect(l).toContain("[Your mailing address]");
    expect(l).toContain("never send originals");
  });
  it("schedules a reminder for the next free report", () => {
    const r = reportReminder([{ bureau: "experian", date: "2026-11-18" }, { bureau: "equifax", date: "2026-11-19" }], new Date("2026-11-20T17:00:00Z"), -480);
    expect(r).toEqual([{ id: "report:2026-11-25", at: "2026-11-25T18:00:00.000Z", title: "Free credit report available", body: expect.stringContaining("AnnualCreditReport.com") }]);
    expect(reportReminder([], new Date(), 0)).toEqual([]);
  });
  it("accepts v0.22 backups and rejects impossible scores", () => {
    const data = { rentSetup: null, payments: [], bills: [{ id: "b", name: "Net", amountCents: 1, dueDay: 1, category: "internet", autopay: false, promoEnds: "2027-01-01" }], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], weeklyLimitCents: 10000, spends: [{ id: "s", date: "2026-11-20", amountCents: 500, note: "" }], scores: [{ id: "x", date: "2026-11-01", score: 700, source: "Bank" }] };
    const b = { app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data };
    expect(parseBackup(JSON.stringify(b)).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ ...b, data: { ...data, scores: [{ id: "x", date: "2026-11-01", score: 1200, source: "" }] } })).ok).toBe(false);
  });
});
