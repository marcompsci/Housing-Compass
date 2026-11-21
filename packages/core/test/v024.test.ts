import { describe, expect, it } from "vitest";
import {
  billPriceTrend,
  budgetProgress,
  goalEta,
  habitPlanItems,
  hourlyBySource,
  monthlyInterest,
  parseBackup,
  paydayChecklist,
  recordBillChange,
  roundUps,
  spendHabits,
  strategyCompare,
  tipOfTheDay,
  TIP_IDS,
  weeklyTotals,
  yearlyBillCost,
  type Bill,
  type Spend,
} from "../src";

const sp = (id: string, date: string, amountCents: number, category: Spend["category"] = "coffee", note = ""): Spend => ({ id, date, amountCents, note, category });

describe("spending", () => {
  const spends = [sp("1", "2026-11-17", 450), sp("2", "2026-11-18", 450), sp("3", "2026-11-19", 1000, "food"), sp("4", "2026-11-10", 500), sp("5", "2026-11-20", 450)];
  it("totals the last weeks for a chart", () => {
    const w = weeklyTotals(spends, "2026-11-20", 3);
    expect(w).toEqual([{ weekStart: "2026-11-02", cents: 0 }, { weekStart: "2026-11-09", cents: 500 }, { weekStart: "2026-11-16", cents: 2350 }]);
  });
  it("tracks monthly category budgets", () => {
    const b = budgetProgress(spends, { coffee: 1500, food: 5000, gas: 0 }, "2026-11");
    expect(b[0]).toMatchObject({ category: "coffee", spentCents: 1850, over: true, leftCents: -350, pct: 123 });
    expect(b).toHaveLength(2);
  });
  it("adds up round-ups not yet moved", () => {
    expect(roundUps(spends, ["5"])).toEqual({ pendingCents: 50 + 50, ids: ["1", "2"], count: 2 });
  });
  it("finds habits and what halving them saves", () => {
    const h = spendHabits([...spends, sp("6", "2026-11-12", 450, "coffee")], "2026-11-20");
    expect(h).toEqual([{ category: "coffee", note: "", count: 5, perWeek: 1.2, monthlyCents: 2300, halfYearlyCents: 13800 }]);
  });
});

describe("bills and debts", () => {
  const bill: Bill = { id: "p", name: "PG&E", amountCents: 12000, dueDay: 3, category: "utilities", autopay: false };
  it("records price changes and shows the trend", () => {
    let h = recordBillChange({}, "p", 9000, 10000, "2026-09-01");
    h = recordBillChange(h, "p", 10000, 12000, "2026-11-01");
    h = recordBillChange(h, "p", 12000, 12000, "2026-11-02");
    expect(h.p).toHaveLength(3);
    expect(billPriceTrend(h, bill)).toMatchObject({ firstCents: 9000, changeCents: 3000, pct: 33, changes: 2 });
    expect(billPriceTrend({}, bill)).toBeNull();
    expect(yearlyBillCost([bill]).totalCents).toBe(144000);
  });
  it("compares snowball and avalanche and shows monthly interest", () => {
    const debts = [
      { id: "a", name: "Big high", balanceCents: 500000, apr: 29, minPaymentCents: 15000 },
      { id: "b", name: "Small low", balanceCents: 50000, apr: 5, minPaymentCents: 2500 },
    ];
    const c = strategyCompare(debts, 10000);
    expect(c.interestDiffCents).toBeGreaterThan(0);
    expect(c.snowball.firstPayoffMonth!).toBeLessThan(c.avalanche.firstPayoffMonth!);
    expect(monthlyInterest(debts)).toEqual({ rows: [{ id: "a", name: "Big high", cents: 12083 }, { id: "b", name: "Small low", cents: 208 }], totalCents: 12291 });
  });
});

describe("income, payday, goals, tips, plan", () => {
  it("ranks side gigs by hourly pay", () => {
    const r = hourlyBySource([
      { id: "1", date: "2026-11-01", source: "Uber", amountCents: 10000, hours: 5 },
      { id: "2", date: "2026-11-02", source: "Tutor", amountCents: 9000, hours: 3 },
      { id: "3", date: "2026-11-03", source: "Uber", amountCents: 5000 },
    ]);
    expect(r).toEqual([{ source: "Tutor", hours: 3, perHourCents: 3000 }, { source: "Uber", hours: 5, perHourCents: 2000 }]);
  });
  it("builds a payday checklist on payday or the day before", () => {
    const obligations = [
      { id: "r", name: "Rent", amountCents: 140000, dueDate: "2026-12-01", kind: "rent" as const },
      { id: "p", name: "Phone", amountCents: 6500, dueDate: "2026-12-10", kind: "bill" as const },
    ];
    const c = paydayChecklist({ paydays: ["2026-11-27", "2026-12-11"], today: "2026-11-26", obligations });
    expect(c).toMatchObject({ payday: "2026-11-27", until: "2026-12-11", totalCents: 146500 });
    expect(paydayChecklist({ paydays: ["2026-11-27"], today: "2026-11-20", obligations })).toBeNull();
  });
  it("projects a goal date from the saving pace", () => {
    const goal = { id: "g", name: "x", targetCents: 100000, savedCents: 20000, targetDate: null };
    const e = goalEta(goal, [{ goalId: "g", date: "2026-11-10", amountCents: 8000 }, { goalId: "g", date: "2026-10-20", amountCents: 8000 }], "2026-11-20");
    expect(e).toEqual({ perWeekCents: 2000, eta: "2027-08-27", weeks: 40 });
    expect(goalEta(goal, [], "2026-11-20").eta).toBeNull();
  });
  it("rotates a tip each day", () => {
    expect(TIP_IDS).toContain(tipOfTheDay("2026-11-20"));
    expect(tipOfTheDay("2026-11-20")).not.toBe(tipOfTheDay("2026-11-21"));
  });
  it("adds over-budget, backup and payday items", () => {
    const items = habitPlanItems({ spends: [sp("1", "2026-11-02", 3000)], budgets: { coffee: 1000 }, lastBackupAt: "2026-10-01", hasData: true, payday: { payday: "2026-11-21", until: "2026-12-05", items: [{ id: "r", name: "Rent", amountCents: 100, dueDate: "2026-12-01", kind: "rent" }], totalCents: 100 }, now: new Date("2026-11-20T12:00:00Z") });
    expect(items.map((x) => x.detailCode)).toEqual(["over_budget", "backup_due", "payday_list"]);
    expect(habitPlanItems({ spends: [], budgets: {}, lastBackupAt: "2026-11-15", hasData: true, payday: null, now: new Date("2026-11-20T12:00:00Z") })).toEqual([]);
  });
  it("accepts v0.24 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], categoryBudgets: { coffee: 1500 }, billHistory: { p: [{ date: "2026-11-01", amountCents: 100 }] }, roundedSpendIds: ["a"], lastBackupAt: "2026-11-20", hideAmounts: true };
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data })).ok).toBe(true);
  });
});
