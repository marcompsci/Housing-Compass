import { describe, expect, it } from "vitest";
import {
  atRiskObligations,
  BILL_CATEGORIES,
  BILL_SCRIPTS,
  bucketFor,
  cashFlowForecast,
  detectIncome,
  emergencyFund,
  findRecurring,
  leftoverSplit,
  listingFit,
  moneyCheck,
  moneyPlanItems,
  monthCalendar,
  nextWeeklyCheckIn,
  parseBankCsv,
  paymentPlanRequest,
  payoffDates,
  payoffPlan,
  rentReportingRequest,
  spendingSummary,
} from "../src";

describe("does this home fit", () => {
  it("rates fit and months to save the move-in cost", () => {
    const f = listingFit({ monthlyCents: 140000, moveInCents: 300000, takeHomeMonthlyCents: 400000, otherBillsCents: 50000, savedCents: 60000 });
    expect(f.status).toBe("fits");
    expect(f.leftoverCents).toBe(210000);
    expect(f.moveInGapCents).toBe(240000);
    expect(f.monthsToMoveIn).toBe(2);
    expect(listingFit({ monthlyCents: 200000, moveInCents: null, takeHomeMonthlyCents: 400000, otherBillsCents: 0, savedCents: 0 }).status).toBe("tight");
    expect(listingFit({ monthlyCents: 300000, moveInCents: 100, takeHomeMonthlyCents: 250000, otherBillsCents: 0, savedCents: 0 })).toMatchObject({ status: "over", monthsToMoveIn: null });
    expect(listingFit({ monthlyCents: 1, moveInCents: 1, takeHomeMonthlyCents: null, otherBillsCents: 0, savedCents: 0 }).status).toBe("unknown");
  });
});

describe("letters and scripts", () => {
  it("writes a rent-reporting request citing the statute", () => {
    const l = rentReportingRequest({ tenantName: "A. Renter", address: "1 Main St", landlord: "Oak Apts", today: "2026-11-20" });
    expect(l).toContain("§1954.07");
    expect(l).toContain("Oak Apts");
  });
  it("splits a balance into a payment plan", () => {
    const l = paymentPlanRequest({ kind: "utility", tenantName: "A", to: "PG&E", account: "123", amountDueCents: 30000, payments: 3, startDate: "2026-12-01", reason: "My hours were cut", today: "2026-11-20" });
    expect(l).toContain("$300");
    expect(l).toContain("3 payments of about $100");
    expect(l).toContain("hours were cut.");
    expect(l).toContain("assistance or discount programs");
  });
  it("has tips for every bill category", () => {
    for (const c of BILL_CATEGORIES) expect(BILL_SCRIPTS[c].length).toBeGreaterThan(0);
  });
});

describe("calendar", () => {
  it("lays out weeks with paydays and due dates", () => {
    const w = monthCalendar("2026-11", ["2026-11-06", "2026-11-20"], [{ id: "r", name: "Rent", amountCents: 140000, dueDate: "2026-12-01", kind: "rent" }, { id: "p", name: "Phone", amountCents: 6500, dueDate: "2026-11-12", kind: "bill" }]);
    expect(w[0]![0]!.date).toBe("2026-11-01");
    expect(w.length).toBe(5);
    const cells = w.flat();
    expect(cells.find((c) => c.date === "2026-11-06")!.payday).toBe(true);
    expect(cells.find((c) => c.date === "2026-11-12")!.due[0]!.name).toBe("Phone");
    expect(cells.find((c) => c.date === "2026-12-01")!.inMonth).toBe(false);
  });
});

describe("bank statement insights", () => {
  const csv = [
    "Date,Description,Amount",
    "2026-08-15,ACME CORP PAYROLL,1500.00", "2026-08-29,ACME CORP PAYROLL,1500.00", "2026-09-12,ACME CORP PAYROLL,1510.00", "2026-09-26,ACME CORP PAYROLL,1500.00",
    "2026-08-03,NETFLIX.COM,-15.99", "2026-09-03,NETFLIX.COM,-15.99", "2026-10-03,NETFLIX.COM,-15.99",
    "2026-08-05,GEICO AUTO,-120.00", "2026-09-05,GEICO AUTO,-120.00",
    "2026-08-01,OAK APTS RENT,-1400.00", "2026-09-01,OAK APTS RENT,-1400.00",
    "2026-08-10,SAFEWAY 123,-80.00", "2026-08-21,SAFEWAY 123,-45.00", "2026-08-11,UBER TRIP,-22.00", "2026-08-12,ATM WITHDRAWAL,-60.00",
  ].join("\n");
  const { txns } = parseBankCsv(csv);
  it("buckets spending", () => {
    expect(bucketFor("SAFEWAY 123")).toBe("groceries");
    expect(bucketFor("UBER EATS")).toBe("eating_out");
    expect(bucketFor("OAK APTS RENT")).toBe("housing");
    const s = spendingSummary(txns);
    expect(s.byBucket.housing).toBe(280000);
    expect(s.byBucket.groceries).toBe(12500);
    expect(s.ranked[0]).toBe("housing");
    expect(s.moneyInCents).toBe(601000);
  });
  it("finds recurring charges not already tracked, skipping rent", () => {
    const r = findRecurring(txns, [{ id: "x", name: "Geico", amountCents: 12000, dueDay: 5, category: "insurance", autopay: true }]);
    expect(r.map((x) => [x.name, x.amountCents, x.category, x.count])).toEqual([["Netflix", 1599, "subscription", 3]]);
    expect(findRecurring(txns, []).map((x) => x.name)).toEqual(["Geico Auto", "Netflix"]);
  });
  it("detects pay frequency and amount", () => {
    expect(detectIncome(txns)).toEqual({ frequency: "biweekly", amountCents: 150000, lastDate: "2026-09-26", count: 4 });
    expect(detectIncome([])).toBeNull();
  });
});

describe("emergency fund, money check, payoff dates, splits", () => {
  it("measures months covered", () => {
    expect(emergencyFund(150000, 100000)).toMatchObject({ months: 1.5, toThreeMonthsCents: 150000, level: "started" });
    expect(emergencyFund(0, 0).level).toBe("unknown");
  });
  it("scores progress and names the next step", () => {
    const c = moneyCheck({ onTimeStreak: 2, overdueBills: 0, hasPaySetup: true, forecastGoesNegative: false, emergencyMonths: 0.5, utilization: 0.2, creditStepsDone: 1, creditStepsTotal: 6, hasGoal: false });
    expect(c.score).toBe(20 + 20 + 15 + 10);
    expect(c.next).toBe("emergency");
    expect(moneyCheck({ onTimeStreak: 9, overdueBills: 0, hasPaySetup: true, forecastGoesNegative: false, emergencyMonths: 3, utilization: 0.05, creditStepsDone: 6, creditStepsTotal: 6, hasGoal: true }).score).toBe(100);
  });
  it("turns payoff months into calendar months", () => {
    const debts = [{ id: "a", name: "Card", balanceCents: 50000, apr: 20, minPaymentCents: 10000 }];
    const d = payoffDates(debts, payoffPlan(debts, 0, "avalanche"), new Date("2026-11-20T00:00:00Z"));
    expect(d).toEqual([{ id: "a", name: "Card", month: "2027-05" }]);
  });
  it("splits leftover exactly", () => {
    expect(leftoverSplit(100001, { goals: 50, debt: 30 })).toEqual({ goalsCents: 50000, debtCents: 30000, bufferCents: 20001 });
    expect(leftoverSplit(-5, { goals: 50, debt: 80 })).toEqual({ goalsCents: 0, debtCents: 0, bufferCents: 0 });
    expect(leftoverSplit(1000, { goals: 70, debt: 80 }).debtCents).toBe(300);
  });
});

describe("plan items and check-in", () => {
  it("flags payments that may not clear and adds paydays and goal dates", () => {
    const obligations = [{ id: "r", name: "Rent", amountCents: 140000, dueDate: "2026-11-21", kind: "rent" as const }];
    const fc = cashFlowForecast(50000, null, obligations, "2026-11-20", 10);
    const risk = atRiskObligations(fc.series, obligations);
    expect(risk.map((o) => o.id)).toEqual(["r"]);
    const items = moneyPlanItems({ paydays: ["2026-11-27"], setAsideByPayday: { "2026-11-27": 6500 }, goals: [{ id: "g", name: "Deposit", targetCents: 100000, savedCents: 20000, targetDate: "2026-12-10" }], atRisk: risk, now: new Date("2026-11-20T12:00:00Z") });
    expect(items.map((x) => [x.kind, x.urgent])).toEqual([["payday", false], ["goal_date", false], ["at_risk", true]]);
  });
  it("schedules the weekly check-in for Sunday 6pm local", () => {
    expect(nextWeeklyCheckIn(new Date("2026-11-20T04:00:00Z"), -480)).toBe("2026-11-23T02:00:00.000Z");
    expect(nextWeeklyCheckIn(new Date("2026-11-23T03:00:00Z"), -480)).toBe("2026-11-30T02:00:00.000Z");
  });
});
