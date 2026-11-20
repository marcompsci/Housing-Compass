import { describe, expect, it } from "vitest";
import {
  backupSummary,
  cashFlowForecast,
  FOUND_MONEY,
  goalPlan,
  lateFeesThisYear,
  matchTransactions,
  monthlyIncomeCents,
  parseBackup,
  parseBankCsv,
  paycheckPlan,
  paydays,
  payoffPlan,
  splitByShares,
  subscriptionSavings,
  upcomingObligations,
  utilization,
  validatePaySetup,
  type Bill,
} from "../src";

const rent = { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "Oak Street Apts" };
const phone: Bill = { id: "b1", name: "T-Mobile", amountCents: 6500, dueDay: 12, category: "phone", autopay: false };
const net: Bill = { id: "b2", name: "Netflix", amountCents: 1599, dueDay: 20, category: "subscription", autopay: true };

describe("paychecks", () => {
  it("validates", () => {
    expect(validatePaySetup({ frequency: "biweekly", amountCents: 0, anchorDate: "2026-11-20" })).toMatch(/take-home/);
    expect(validatePaySetup({ frequency: "biweekly", amountCents: 150000, anchorDate: "x" })).toMatch(/payday/);
  });
  it("lists paydays for each frequency", () => {
    expect(paydays({ frequency: "biweekly", amountCents: 1, anchorDate: "2026-11-06" }, "2026-11-19", 30)).toEqual(["2026-11-20", "2026-12-04", "2026-12-18"]);
    expect(paydays({ frequency: "weekly", amountCents: 1, anchorDate: "2026-12-04" }, "2026-11-19", 14)).toEqual(["2026-11-20", "2026-11-27"]);
    expect(paydays({ frequency: "semimonthly", amountCents: 1, anchorDate: "2026-11-01" }, "2026-11-19", 30)).toEqual(["2026-12-01", "2026-12-15"]);
    expect(paydays({ frequency: "monthly", amountCents: 1, anchorDate: "2026-10-31" }, "2026-11-19", 45)).toEqual(["2026-11-30", "2026-12-31"]);
    expect(monthlyIncomeCents({ frequency: "biweekly", amountCents: 120000, anchorDate: "2026-11-06" })).toBe(260000);
  });
  it("assigns rent and bills to the paycheck before they're due", () => {
    const obligations = upcomingObligations({ rent, rentPayments: [], bills: [phone, net], billPaid: { b2: ["2026-11"] }, from: "2026-11-19", days: 40 });
    expect(obligations.map((o) => o.id)).toEqual(["rent:2026-12", "bill:b1:2026-12", "bill:b2:2026-12"]);
    const plan = paycheckPlan({ frequency: "biweekly", amountCents: 150000, anchorDate: "2026-11-06" }, obligations, "2026-11-19");
    expect(plan.buckets[0]!.payday).toBe("2026-11-20");
    expect(plan.buckets[0]!.covers.map((o) => o.id)).toEqual(["rent:2026-12"]);
    expect(plan.buckets[0]!.leftCents).toBe(10000);
    expect(plan.buckets[1]!.covers.map((o) => o.id)).toEqual(["bill:b1:2026-12"]);
    const early = paycheckPlan({ frequency: "monthly", amountCents: 300000, anchorDate: "2026-11-30" }, [{ id: "x", name: "Phone", amountCents: 100, dueDate: "2026-11-25", kind: "bill" }], "2026-11-19");
    expect(early.dueBeforeFirstPay.map((o) => o.id)).toEqual(["x"]);
  });
  it("forecasts the lowest balance", () => {
    const f = cashFlowForecast(50000, { frequency: "biweekly", amountCents: 150000, anchorDate: "2026-11-06" }, [{ id: "r", name: "Rent", amountCents: 140000, dueDate: "2026-11-19", kind: "rent" }], "2026-11-19", 30);
    expect(f.lowest).toMatchObject({ date: "2026-11-19", balanceCents: -90000 });
    expect(f.goesNegative).toBe(true);
    expect(f.endBalanceCents).toBe(50000 - 140000 + 3 * 150000);
  });
});

describe("bank CSV import", () => {
  const csv = `Date,Description,Amount\n11/01/2026,"OAK STREET APTS RENT",-1400.00\n2026-11-12,T-MOBILE AUTOPAY,(65.00)\n11/15/2026,PAYROLL,1500.00\nbad,row,\n`;
  it("parses common formats and skips bad rows", () => {
    const r = parseBankCsv(csv);
    expect(r.error).toBeNull();
    expect(r.skipped).toBe(1);
    expect(r.txns).toEqual([
      { date: "2026-11-01", description: "OAK STREET APTS RENT", amountCents: -140000 },
      { date: "2026-11-12", description: "T-MOBILE AUTOPAY", amountCents: -6500 },
      { date: "2026-11-15", description: "PAYROLL", amountCents: 150000 },
    ]);
    const deb = parseBankCsv("Posted Date,Payee,Debit,Credit\n2026-11-02,PG&E,90.10,\n2026-11-03,Refund,,5.00\n");
    expect(deb.txns.map((t) => t.amountCents)).toEqual([-9010, 500]);
    expect(parseBankCsv("x").error).toMatch(/header/);
    expect(parseBankCsv("A,B\n1,2").error).toMatch(/columns/);
  });
  it("suggests matches only for unrecorded months", () => {
    const { txns } = parseBankCsv(csv);
    const m = matchTransactions(txns, { rent, rentPayments: [], bills: [phone], billPaid: {} });
    expect(m.map((x) => [x.label, x.confidence])).toEqual([["Rent · 2026-11", "high"], ["T-Mobile · 2026-11", "high"]]);
    const none = matchTransactions(txns, { rent, rentPayments: [{ id: "p", month: "2026-11", paidOn: "2026-11-01", amountCents: 140000, method: "portal", confirmation: "" }], bills: [phone], billPaid: { b1: ["2026-11"] } });
    expect(none).toEqual([]);
  });
});

describe("debts, credit, goals", () => {
  const debts = [
    { id: "card", name: "Card", balanceCents: 300000, apr: 24.99, minPaymentCents: 9000 },
    { id: "loan", name: "Loan", balanceCents: 100000, apr: 8, minPaymentCents: 5000 },
  ];
  it("avalanche pays less interest; snowball clears the small debt first", () => {
    const a = payoffPlan(debts, 10000, "avalanche");
    const s = payoffPlan(debts, 10000, "snowball");
    expect(a.feasible && s.feasible).toBe(true);
    expect(a.order[0]).toBe("card");
    expect(s.order[0]).toBe("loan");
    expect(a.totalInterestCents).toBeLessThanOrEqual(s.totalInterestCents);
    expect(s.payoffMonthById.loan!).toBeLessThan(a.payoffMonthById.loan!);
    expect(payoffPlan([{ id: "x", name: "X", balanceCents: 1_000_000, apr: 30, minPaymentCents: 100 }], 0, "avalanche").feasible).toBe(false);
  });
  it("computes utilization and pay-down targets", () => {
    const u = utilization([{ name: "A", balanceCents: 90000, limitCents: 200000 }, { name: "B", balanceCents: 10000, limitCents: 100000 }]);
    expect(u.overall).toBeCloseTo(1 / 3);
    expect(u.band).toBe("high");
    expect(u.payDownTo30Cents).toBe(10000);
    expect(u.payDownTo10Cents).toBe(70000);
    expect(utilization([]).overall).toBeNull();
  });
  it("plans savings per month and per paycheck", () => {
    const g = goalPlan({ id: "g", name: "Move-in", targetCents: 300000, savedCents: 60000, targetDate: "2027-03-01" }, new Date("2026-11-19T12:00:00Z"), { frequency: "biweekly", amountCents: 150000, anchorDate: "2026-11-06" });
    expect(g.remainingCents).toBe(240000);
    expect(g.progress).toBeCloseTo(0.2);
    expect(g.months).toBe(4);
    expect(g.perMonthCents).toBe(60000);
    expect(g.perPaycheckCents).toBe(Math.ceil(240000 / 8));
  });
});

describe("subscriptions, late fees, split", () => {
  it("adds up savings and fees", () => {
    expect(subscriptionSavings([phone, net], ["b2"])).toEqual({ subscriptions: 1, monthlyAllCents: 1599, cutMonthlyCents: 1599, cutYearlyCents: 19188 });
    expect(lateFeesThisYear([{ date: "2026-02-03", amountCents: 5000 }, { date: "2025-12-03", amountCents: 5000 }], new Date("2026-11-19T00:00:00Z"))).toEqual({ count: 1, totalCents: 5000 });
  });
  it("splits exactly", () => {
    expect(splitByShares(100001, [1, 1, 1])).toEqual([33334, 33334, 33333]);
    expect(splitByShares(300000, [2, 1])).toEqual([200000, 100000]);
    expect(splitByShares(1000, [0, 0])).toEqual([0, 0]);
  });
});

describe("found money and backups", () => {
  it("lists only official https sites", () => {
    for (const p of FOUND_MONEY) expect(new URL(p.url).protocol).toBe("https:");
    expect(FOUND_MONEY.map((p) => p.id)).toContain("unclaimed");
  });
  it("round-trips a backup and rejects bad input", () => {
    const b = {
      app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "2026-11-19T00:00:00Z",
      data: { rentSetup: rent, payments: [], bills: [phone], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: ["reports"] },
    };
    const ok = parseBackup(JSON.stringify(b));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(backupSummary(ok.backup)).toContain("1 bills");
    expect(parseBackup("{").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...b, data: { ...b.data, bills: [{ ...phone, amountCents: -5 }] } })).ok).toBe(false);
  });
});
