import { describe, expect, it } from "vitest";
import {
  billChanges,
  crossedMilestones,
  depositInterestEstimate,
  dueDateSuggestions,
  estimatedTaxDates,
  extraPaymentImpact,
  LOCAL_INCREASES,
  LOCAL_RENT_OFFICES,
  localIncreaseCheck,
  localIncreaseFor,
  mileageRateFor,
  parseBackup,
  parseBankCsv,
  savingStreakWeeks,
  sideIncomeSummary,
  STATE_CAPS_2026_27,
  taxPlanItems,
  yearInReview,
  yearlyPlan,
  yearlyPlanItems,
  type Bill,
} from "../src";

describe("local allowed increases", () => {
  it("has a current figure for each rent-controlled city we list, linked to an official office", () => {
    for (const x of LOCAL_INCREASES) {
      expect(LOCAL_RENT_OFFICES.some((o) => o.id === x.officeId)).toBe(true);
      expect(new URL(x.url).protocol).toBe("https:");
      expect(x.from <= x.to).toBe(true);
    }
    expect(localIncreaseFor("sf_rent_board", "2026-11-20")!.pct).toBe(1.6);
    expect(localIncreaseFor("oakland_rap", "2026-11-20")!.pct).toBe(2.3);
    expect(localIncreaseFor("la_city_rso", "2026-11-20")!.pct).toBe(3);
    expect(STATE_CAPS_2026_27.find((c) => c.region.startsWith("San Francisco"))!.pct).toBe(8.8);
  });
  it("finds the most a covered rent may rise", () => {
    expect(localIncreaseCheck({ currentRentCents: 200000, newRentCents: 210000, allowedPct: 1.6 })).toEqual({ increasePct: 5, allowedPct: 1.6, maxNewRentCents: 203200, overByCents: 6800, over: true });
    expect(localIncreaseCheck({ currentRentCents: 200000, newRentCents: 203200, allowedPct: 1.6 }).over).toBe(false);
  });
  it("estimates deposit interest", () => {
    expect(depositInterestEstimate(200000, 4.2)).toBe(8400);
    expect(depositInterestEstimate(200000, 4.2, 6)).toBe(4200);
  });
});

describe("side income, mileage and taxes", () => {
  it("uses the IRS rate for the trip date", () => {
    expect(mileageRateFor("2026-03-01")).toBe(72.5);
    expect(mileageRateFor("2026-08-01")).toBe(76);
    expect(mileageRateFor("2024-01-01")).toBeNull();
  });
  it("summarizes earnings, mileage deduction and set-aside", () => {
    const s = sideIncomeSummary(
      [
        { id: "1", date: "2026-11-02", source: "Uber", amountCents: 50000 },
        { id: "2", date: "2026-11-09", source: "Uber", amountCents: 30000 },
        { id: "3", date: "2026-10-01", source: "TaskRabbit", amountCents: 20000 },
        { id: "4", date: "2025-12-01", source: "Uber", amountCents: 99999 },
      ],
      [{ id: "m", date: "2026-11-02", miles: 100, purpose: "rides" }],
      25,
      new Date("2026-11-20T12:00:00Z"),
    );
    expect(s.earnedYearCents).toBe(100000);
    expect(s.earnedMonthCents).toBe(80000);
    expect(s.mileageDeductionCents).toBe(7600);
    expect(s.setAsideYearCents).toBe(Math.round(((100000 - 7600) * 25) / 100));
    expect(s.bySource[0]).toEqual({ source: "Uber", cents: 80000 });
  });
  it("lists quarterly due dates and adds upcoming ones to the plan", () => {
    expect(estimatedTaxDates(2026).map((d) => d.due)).toEqual(["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"]);
    expect(taxPlanItems(new Date("2026-12-10T12:00:00Z"), true).map((x) => x.date)).toEqual(["2027-01-15"]);
    expect(taxPlanItems(new Date("2026-12-10T12:00:00Z"), false)).toEqual([]);
  });
});

describe("yearly expenses and due dates", () => {
  it("spreads yearly costs into monthly amounts", () => {
    const p = yearlyPlan([{ id: "r", name: "Car registration", amountCents: 24000, nextDue: "2027-05-20", savedCents: 0 }, { id: "i", name: "Renters insurance", amountCents: 15000, nextDue: "2026-12-01", savedCents: 15000 }], new Date("2026-11-20T12:00:00Z"));
    expect(p.rows.map((r) => r.id)).toEqual(["i", "r"]);
    expect(p.rows[0]!.ready).toBe(true);
    expect(p.rows[1]!.monthsLeft).toBe(6);
    expect(p.monthlyTotalCents).toBe(4000);
    expect(yearlyPlanItems([{ id: "r", name: "Reg", amountCents: 100, nextDue: "2026-12-01", savedCents: 0 }], new Date("2026-11-20T12:00:00Z"))[0]!.urgent).toBe(true);
  });
  it("suggests moving bills due just before payday", () => {
    const bills: Bill[] = [
      { id: "a", name: "Phone", amountCents: 6500, dueDay: 18, category: "phone", autopay: false },
      { id: "b", name: "Net", amountCents: 5000, dueDay: 21, category: "internet", autopay: false },
      { id: "c", name: "Auto", amountCents: 5000, dueDay: 18, category: "car", autopay: true },
    ];
    const s = dueDateSuggestions(bills, { frequency: "biweekly", amountCents: 1, anchorDate: "2026-11-20" }, new Date("2026-11-10T12:00:00Z"));
    expect(s).toEqual([{ billId: "a", name: "Phone", currentDay: 18, suggestedDay: 22, reason: "Due 2 days before payday" }]);
  });
});

describe("debts, streaks, milestones", () => {
  it("shows what an extra payment saves", () => {
    const r = extraPaymentImpact([{ id: "c", name: "Card", balanceCents: 300000, apr: 24.99, minPaymentCents: 9000 }], 5000);
    expect(r.monthsSaved!).toBeGreaterThan(10);
    expect(r.interestSavedCents!).toBeGreaterThan(50000);
    expect(extraPaymentImpact([{ id: "x", name: "X", balanceCents: 1_000_000, apr: 30, minPaymentCents: 100 }], 50000).becomesFeasible).toBe(true);
  });
  it("counts saving weeks in a row", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const c = (date: string) => ({ goalId: "g", date, amountCents: 1000 });
    expect(savingStreakWeeks([c("2026-11-18"), c("2026-11-11"), c("2026-11-04"), c("2026-10-21")], now)).toBe(3);
    expect(savingStreakWeeks([c("2026-11-11"), c("2026-11-04")], now)).toBe(2);
    expect(savingStreakWeeks([c("2026-10-28")], now)).toBe(0);
  });
  it("detects goal milestones crossed", () => {
    expect(crossedMilestones({ id: "g", name: "x", targetCents: 1000, savedCents: 200, targetDate: null }, 400)).toEqual([25, 50]);
    expect(crossedMilestones({ id: "g", name: "x", targetCents: 1000, savedCents: 900, targetDate: null }, 500)).toEqual([100]);
  });
});

describe("bill changes, year in review, backups", () => {
  it("flags bills whose latest charge changed 10% or more", () => {
    const { txns } = parseBankCsv("Date,Description,Amount\n2026-10-03,PG&E WEB ONLINE,-90.00\n2026-11-03,PG&E WEB ONLINE,-140.00\n2026-11-05,T-MOBILE,-65.00\n");
    const bills: Bill[] = [
      { id: "p", name: "PG&E", amountCents: 9000, dueDay: 3, category: "utilities", autopay: false },
      { id: "t", name: "T-Mobile", amountCents: 6500, dueDay: 5, category: "phone", autopay: false },
    ];
    expect(billChanges(txns, bills)).toEqual([{ billId: "p", name: "PG&E", trackedCents: 9000, latestCents: 14000, date: "2026-11-03", changePct: 56 }]);
  });
  it("summarizes the year", () => {
    const y = yearInReview({
      year: 2026,
      rent: { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "" },
      payments: [{ id: "1", month: "2026-10", paidOn: "2026-10-01", amountCents: 140000, method: "portal", confirmation: "" }, { id: "2", month: "2026-11", paidOn: "2026-11-09", amountCents: 140000, method: "portal", confirmation: "", lateFeeCents: 5000 }],
      billPaid: { a: ["2026-10", "2026-11", "2025-12"] },
      bills: [],
      side: [{ id: "s", date: "2026-05-01", source: "Uber", amountCents: 12345 }],
      contribs: [{ goalId: "g", date: "2026-06-01", amountCents: 5000 }],
    });
    expect(y).toMatchObject({ rentPaidCents: 280000, months: 2, onTimeMonths: 1, lateFeesCents: 5000, billsChecked: 2, sideIncomeCents: 12345, savedCents: 5000 });
    expect(y.text).toContain("MY 2026 IN MONEY");
  });
  it("accepts backups with the new optional sections", () => {
    const b = { app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data: { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], sideIncome: [{ id: "1", date: "2026-11-01", source: "Uber", amountCents: 100 }], mileage: [], sideSetAsidePct: 25, yearly: [], contribs: [] } };
    expect(parseBackup(JSON.stringify(b)).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ ...b, data: { ...b.data, sideSetAsidePct: 90 } })).ok).toBe(false);
  });
});
