import { describe, expect, it } from "vitest";
import {
  allPaidStreak,
  creditPlanItems,
  disputeStatus,
  hoursToCover,
  inquiryStatus,
  iouBalances,
  parseBackup,
  paymentForMonths,
  promoPlan,
  reportCheckStatus,
  safeToSpend,
  savingsWon,
  shareMessage,
  sideGoalProgress,
  sideProfit,
  statementTiming,
  weekAhead,
  yearInReview,
  type Bill,
  type Debt,
  type Obligation,
} from "../src";

const ob = (dueDate: string, amountCents: number, name = "x"): Obligation => ({ id: name + dueDate, name, amountCents, dueDate, kind: "bill" });

describe("safe to spend and the week ahead", () => {
  it("subtracts what's due before payday, set-aside and buffer", () => {
    const r = safeToSpend({ balanceCents: 100000, obligations: [ob("2026-11-21", 20000), ob("2026-11-27", 30000), ob("2026-12-01", 99999)], nextPayday: "2026-11-28", today: "2026-11-20", setAsideCents: 10000, bufferCents: 5000 });
    expect(r).toMatchObject({ safeCents: 35000, dueCents: 50000, dueCount: 2, days: 8, perDayCents: 4375 });
  });
  it("reports a shortfall instead of a negative number", () => {
    const r = safeToSpend({ balanceCents: 1000, obligations: [ob("2026-11-22", 5000)], nextPayday: null, today: "2026-11-20" });
    expect(r.safeCents).toBe(0);
    expect(r.shortCents).toBe(4000);
    expect(r.until).toBe("2026-12-04");
  });
  it("lists the next 7 days", () => {
    const w = weekAhead([ob("2026-11-26", 100), ob("2026-11-20", 200), ob("2026-11-27", 300)], "2026-11-20");
    expect(w.items.map((x) => x.dueDate)).toEqual(["2026-11-20", "2026-11-26"]);
    expect(w).toMatchObject({ totalCents: 300, todayCount: 1 });
  });
});

describe("side work", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("computes profit, set-aside and real hourly pay", () => {
    const p = sideProfit({
      income: [
        { id: "1", date: "2026-11-02", source: "Uber", amountCents: 20000, hours: 8 },
        { id: "2", date: "2026-11-03", source: "Uber", amountCents: 20000 },
      ],
      miles: [{ id: "m", date: "2026-11-02", miles: 50, purpose: "x" }],
      expenses: [{ id: "e", date: "2026-11-01", category: "phone", amountCents: 2000, note: "" }],
      setAsidePct: 25,
      now,
    });
    expect(p).toMatchObject({ grossCents: 40000, mileageCents: 3800, expensesCents: 2000, profitCents: 34200, setAsideCents: 8550, hours: 8, grossHourlyCents: 2500 });
    expect(p.netHourlyCents).toBe(Math.round((20000 - 5800 * 0.5) / 8));
  });
  it("tracks a monthly goal", () => {
    const g = sideGoalProgress([{ id: "1", date: "2026-11-02", source: "x", amountCents: 30000 }], 100000, now);
    expect(g).toMatchObject({ earnedCents: 30000, leftCents: 70000, progress: 0.3, perDayCents: Math.ceil(70000 / 11) });
    expect(sideGoalProgress([], null, now).progress).toBeNull();
  });
});

describe("wins, credit and cards", () => {
  it("adds up bill-lowering wins and cut subscriptions", () => {
    const bills: Bill[] = [{ id: "s", name: "Stream", amountCents: 1500, dueDay: 3, category: "subscription", autopay: true }];
    const w = savingsWon(
      [
        { id: "1", date: "2026-11-01", company: "Comcast", ask: "lower rate", result: "lower", monthlySavingsCents: 2000, oneTimeCents: 0 },
        { id: "2", date: "2026-11-02", company: "PG&E", ask: "waive fee", result: "credit", monthlySavingsCents: 0, oneTimeCents: 1500 },
        { id: "3", date: "2026-11-03", company: "T-Mobile", ask: "", result: "no", monthlySavingsCents: 0, oneTimeCents: 0 },
      ],
      bills,
      ["s"],
    );
    expect(w).toMatchObject({ wins: 2, asked: 3, monthlyCents: 2000, oneTimeCents: 1500, subsMonthlyCents: 1500, nextYearCents: 3500 * 12 + 1500 });
  });
  it("knows when each free report can be checked again", () => {
    const s = reportCheckStatus([{ bureau: "experian", date: "2026-11-18" }, { bureau: "equifax", date: "2026-11-10" }], "2026-11-20");
    expect(s.find((x) => x.bureau === "experian")).toMatchObject({ next: "2026-11-25", canCheck: false });
    expect(s.find((x) => x.bureau === "equifax")!.canCheck).toBe(true);
    expect(s.find((x) => x.bureau === "transunion")).toMatchObject({ last: null, canCheck: true });
  });
  it("tracks hard inquiries and dispute deadlines", () => {
    const q = inquiryStatus([{ id: "a", date: "2025-06-01", lender: "Car" }, { id: "b", date: "2024-10-01", lender: "Card" }], "2026-11-20");
    expect(q.rows[0]).toMatchObject({ scoreUntil: "2026-06-01", reportUntil: "2027-06-01", counts: false, onReport: true });
    expect(q).toMatchObject({ countingNow: 0, onReportNow: 1 });
    const d = disputeStatus([{ id: "1", bureau: "equifax", item: "Old card", sentOn: "2026-10-10", resolved: false }], "2026-11-20");
    expect(d[0]).toMatchObject({ responseDue: "2026-11-09", late: true });
  });
  it("times card payments before the statement closes and before a promo ends", () => {
    const card: Debt = { id: "c", name: "Visa", balanceCents: 120000, apr: 0, minPaymentCents: 3500, statementDay: 31, promoEnds: "2027-05-20" };
    expect(statementTiming(card, "2026-11-20")).toEqual({ closes: "2026-11-30", payBy: "2026-11-28", daysLeft: 10 });
    expect(statementTiming({ ...card, statementDay: 5 }, "2026-12-20")!.closes).toBe("2027-01-05");
    expect(promoPlan(card, "2026-11-20")).toMatchObject({ ended: false, monthsLeft: 5, perMonthCents: 24000 });
    expect(promoPlan({ ...card, promoEnds: "2026-01-01" }, "2026-11-20")!.ended).toBe(true);
    const items = creditPlanItems({ reportChecks: [], disputes: [], debts: [{ ...card, statementDay: 25, promoEnds: "2026-12-15" }], now: new Date("2026-11-20T12:00:00Z") });
    expect(items.map((x) => x.detailCode)).toEqual(["pay_before_close", "promo_end"]);
  });
  it("finds the fixed payment for a payoff date", () => {
    expect(paymentForMonths(120000, 0, 12)).toEqual({ perMonthCents: 10000, totalInterestCents: 0 });
    const p = paymentForMonths(300000, 24, 24);
    expect(p.perMonthCents).toBe(15862);
    expect(p.totalInterestCents).toBe(15862 * 24 - 300000);
  });
});

describe("roommates, hours, streaks, year in review, backups", () => {
  it("nets IOUs per person", () => {
    const b = iouBalances([
      { id: "1", date: "2026-11-01", person: "Sam", amountCents: 4500, note: "PG&E", settled: false },
      { id: "2", date: "2026-11-02", person: "Sam", amountCents: -1500, note: "groceries", settled: false },
      { id: "3", date: "2026-11-02", person: "Ana", amountCents: -2000, note: "", settled: false },
      { id: "4", date: "2026-11-02", person: "Ana", amountCents: 9999, note: "", settled: true },
    ]);
    expect(b).toEqual({ people: [{ person: "Sam", cents: 3000 }, { person: "Ana", cents: -2000 }], owedToYouCents: 3000, youOweCents: 2000 });
  });
  it("writes a share message", () => {
    expect(shareMessage({ bill: "PG&E", totalCents: 9000, shareCents: 4500, dueDate: "2026-12-03", payTo: "Venmo @omari" })).toBe("Hi! Your share of PG&E is $45 (total $90), due 2026-12-03. You can send it to Venmo @omari. Thanks!");
  });
  it("measures bills in work hours", () => {
    expect(hoursToCover(140000, 2500)).toBe(56);
    expect(hoursToCover(100, null)).toBeNull();
  });
  it("counts months with every bill checked off", () => {
    const bills: Bill[] = [{ id: "a", name: "A", amountCents: 1, dueDay: 1, category: "phone", autopay: false }, { id: "b", name: "B", amountCents: 1, dueDay: 1, category: "internet", autopay: false }];
    const now = new Date("2026-11-20T12:00:00Z");
    expect(allPaidStreak(bills, { a: ["2026-09", "2026-10", "2026-11"], b: ["2026-09", "2026-10"] }, now)).toBe(2);
    expect(allPaidStreak(bills, { a: ["2026-11", "2026-10"], b: ["2026-11", "2026-10"] }, now)).toBe(2);
    expect(allPaidStreak([], {}, now)).toBe(0);
  });
  it("adds expenses and wins to the year in review", () => {
    const y = yearInReview({ year: 2026, rent: null, payments: [], billPaid: {}, bills: [], side: [], contribs: [], expenses: [{ date: "2026-03-01", amountCents: 5000 }], wins: [{ date: "2026-11-01", result: "lower", monthlySavingsCents: 1000, oneTimeCents: 500 }] });
    expect(y).toMatchObject({ sideExpensesCents: 5000, wins: 1, winsCents: 2500 });
    expect(y.text).toContain("Saved by asking for lower bills: $25 (1 win)");
  });
  it("accepts backups with the v0.21 sections and rejects bad ones", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [{ id: "d", name: "Visa", balanceCents: 1, apr: 1, minPaymentCents: 1, statementDay: 20, promoEnds: "2027-01-01" }], goals: [], unusedSubs: [], creditDone: [], sideExpenses: [{ id: "e", date: "2026-11-01", category: "phone", amountCents: 100, note: "" }], negotiations: [], reportChecks: [{ bureau: "experian", date: "2026-11-01" }], inquiries: [], disputes: [], ious: [{ id: "i", date: "2026-11-01", person: "Sam", amountCents: -500, note: "", settled: false }], hourlyCents: 2500, sideGoalCents: null };
    const b = { app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data };
    expect(parseBackup(JSON.stringify(b)).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ ...b, data: { ...data, reportChecks: [{ bureau: "acme", date: "2026-11-01" }] } })).ok).toBe(false);
  });
});
