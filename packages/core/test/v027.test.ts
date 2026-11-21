import { describe, expect, it } from "vitest";
import { biggestCosts, coverage, debtMilestonesCrossed, detectCategory, filterPlan, findByName, nextUp, parseAsk, parseBackup, payPriority, planItemKey, type Bill, type PlanItem } from "../src";

const bills: Bill[] = [
  { id: "n", name: "Netflix", amountCents: 1549, dueDay: 2, category: "subscription", autopay: true },
  { id: "p", name: "PG&E", amountCents: 9000, dueDay: 25, category: "utilities", autopay: false },
  { id: "g", name: "Gym", amountCents: 3000, dueDay: 1, category: "other", autopay: false },
];
const obligations = [
  { id: "bill:n:2026-12", name: "Netflix", amountCents: 1549, dueDate: "2026-12-02", kind: "bill" as const },
  { id: "bill:g:2026-12", name: "Gym", amountCents: 3000, dueDate: "2026-12-01", kind: "bill" as const },
  { id: "debt:c:2026-11", name: "Visa", amountCents: 3500, dueDate: "2026-11-30", kind: "bill" as const },
  { id: "bill:p:2026-11", name: "PG&E", amountCents: 9000, dueDate: "2026-11-25", kind: "bill" as const },
  { id: "rent:2026-12", name: "Rent", amountCents: 140000, dueDate: "2026-12-01", kind: "rent" as const },
];

describe("pay first", () => {
  it("orders housing, utilities, minimums, other, subscriptions", () => {
    const p = payPriority(obligations, bills);
    expect(p.map((x) => [x.name, x.reason])).toEqual([["Rent", "housing"], ["PG&E", "utilities"], ["Visa", "minimum"], ["Gym", "other"], ["Netflix", "subscription"]]);
    expect(coverage(p, 150000).map((x) => x.covered)).toEqual([true, true, false, false, false]);
    expect(coverage(p, 152000).map((x) => x.covered)).toEqual([true, true, false, true, false]);
  });
});

describe("plan focus", () => {
  const item = (kind: PlanItem["kind"], date: string, urgent: boolean): PlanItem => ({ kind, date, title: kind, detail: "", href: "/", urgent });
  const items = [item("tour", "2026-11-22", false), item("credit", "2026-11-25", true), item("bill_due", "2026-11-21", false), item("lease", "2026-11-20", true)];
  it("picks the next thing to do", () => {
    expect(nextUp(items)!.kind).toBe("lease");
    expect(nextUp([item("tour", "2026-11-22", false), item("bill_due", "2026-11-21", false)])!.kind).toBe("bill_due");
    expect(nextUp([])).toBeNull();
  });
  it("filters by area and gives stable keys", () => {
    expect(filterPlan(items, "home").map((x) => x.kind)).toEqual(["tour", "lease"]);
    expect(filterPlan(items, "credit").map((x) => x.kind)).toEqual(["credit"]);
    expect(filterPlan(items, "money").map((x) => x.kind)).toEqual(["bill_due"]);
    expect(planItemKey(items[0]!)).toBe("tour|2026-11-22|tour");
  });
});

describe("debts and ask", () => {
  it("celebrates payoff milestones", () => {
    const d = { id: "c", name: "Visa", balanceCents: 80000, startBalanceCents: 100000, apr: 20, minPaymentCents: 1 };
    expect(debtMilestonesCrossed(d, 45000)).toEqual([25, 50]);
    expect(debtMilestonesCrossed(d, 0)).toEqual([25, 50, 75, 100]);
    expect(debtMilestonesCrossed(d, 79000)).toEqual([]);
  });
  it("understands the new questions", () => {
    expect(parseAsk("who owes me money?").intent).toBe("roommates");
    expect(parseAsk("what should I pay first?").intent).toBe("pay_first");
    expect(parseAsk("what's my biggest bill").intent).toBe("biggest");
    expect(parseAsk("when does my lease end").intent).toBe("lease");
    expect(parseAsk("how much did I spend on coffee").intent).toBe("category");
    expect(parseAsk("¿Cuánto gasté en comida?").intent).toBe("category");
    expect(parseAsk("我花在咖啡上多少").intent).toBe("category");
    expect(parseAsk("¿Qué pago primero?").intent).toBe("pay_first");
    expect(parseAsk("我的租约什么时候到期").intent).toBe("lease");
    expect(detectCategory("spent on coffee and gas")).toBe("coffee");
    expect(detectCategory("how much on gas")).toBe("gas");
    expect(detectCategory("gasolina")).toBe("gas");
    expect(detectCategory("nothing")).toBeNull();
    expect(findByName("how close am i to my move-in fund", [{ name: "Move-in fund" }, { name: "Car" }])!.name).toBe("Move-in fund");
  });
  it("lists the biggest monthly costs", () => {
    const b = biggestCosts({ rentCents: 140000, bills, debts: [{ id: "c", name: "Visa", balanceCents: 1000, apr: 1, minPaymentCents: 3500 }] });
    expect(b.rows.map((r) => [r.name, r.cents])).toEqual([["Rent", 140000], ["PG&E", 9000], ["Gym", 3000], ["Netflix", 1549], ["Visa", 1000]]);
  });
  it("accepts v0.27 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], favSpends: [{ amountCents: 550, category: "coffee", note: "Latte" }], billPayInfo: { p: "pge.com or 1-800 on bill" }, planHidden: { date: "2026-11-20", ids: ["a"] } };
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data })).ok).toBe(true);
  });
});
