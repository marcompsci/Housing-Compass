import { describe, expect, it } from "vitest";
import { debtMinStreak, debtObligations, debtPlanItems, findBillByName, FOLLOW_UPS, leasePlanItems, moneyCsv, monthReport, parseAsk, parseBackup, recurringToBill, rememberAsk, splitPaycheck, type Bill, type Debt } from "../src";

const card: Debt = { id: "c", name: "Visa", balanceCents: 50000, apr: 25, minPaymentCents: 3500, dueDay: 25 };

describe("debt minimums", () => {
  it("adds unpaid minimums with a due day as obligations", () => {
    expect(debtObligations([card, { ...card, id: "x", dueDay: undefined }], {}, "2026-11-20", 30)).toEqual([
      { id: "debt:c:2026-11", name: "Visa", amountCents: 3500, dueDate: "2026-11-25", kind: "bill" },
    ]);
    expect(debtObligations([card], { c: ["2026-11"] }, "2026-11-20", 40).map((o) => o.dueDate)).toEqual(["2026-12-25"]);
  });
  it("puts them in My plan, including missed ones", () => {
    const soon = debtPlanItems([card], {}, new Date("2026-11-20T12:00:00Z"));
    expect(soon[0]).toMatchObject({ detailCode: "debt_min", n: 5, urgent: false });
    const late = debtPlanItems([{ ...card, dueDay: 10 }], {}, new Date("2026-11-20T12:00:00Z"));
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({ n: -10, urgent: true });
  });
  it("counts months with every minimum paid", () => {
    expect(debtMinStreak([card], { c: ["2026-09", "2026-10"] }, new Date("2026-11-20T12:00:00Z"))).toBe(2);
    expect(debtMinStreak([{ ...card, dueDay: undefined }], {}, new Date())).toBe(0);
  });
});

describe("pay split, lease, ask helpers", () => {
  it("splits a paycheck and gives rounding to spending", () => {
    expect(splitPaycheck(100001, { bills: 50, savings: 20, debt: 10, spending: 20 })).toEqual({ rows: { bills: 50000, savings: 20000, debt: 10000, spending: 20001 }, balanced: true });
    expect(splitPaycheck(1000, { bills: 0, savings: 0, debt: 0, spending: 0 })).toBeNull();
  });
  it("reminds about the lease within 90 days", () => {
    expect(leasePlanItems("2027-01-10", new Date("2026-11-20T12:00:00Z"))[0]).toMatchObject({ n: 51, urgent: false, detailCode: "lease_end" });
    expect(leasePlanItems("2027-06-10", new Date("2026-11-20T12:00:00Z"))).toEqual([]);
  });
  it("understands the new questions", () => {
    expect(parseAsk("How am I doing?").intent).toBe("overview");
    expect(parseAsk("when is rent due").intent).toBe("rent");
    expect(parseAsk("how much did I make from Uber").intent).toBe("side");
    expect(parseAsk("next tax payment").intent).toBe("tax");
    expect(parseAsk("what do my subscriptions cost").intent).toBe("subs");
    expect(parseAsk("any free trial ending?").intent).toBe("trials");
    expect(parseAsk("¿Cuánto tengo de emergencia?").intent).toBe("emergency");
    expect(parseAsk("我的房租").intent).toBe("rent");
  });
  it("finds a bill named in a question", () => {
    const bills: Bill[] = [{ id: "p", name: "PG&E", amountCents: 9000, dueDay: 3, category: "utilities", autopay: false }, { id: "t", name: "T-Mobile", amountCents: 6500, dueDay: 5, category: "phone", autopay: false }];
    expect(findBillByName("how much is my pg&e bill", bills)!.id).toBe("p");
    expect(findBillByName("hello", bills)).toBeNull();
    expect(FOLLOW_UPS.due).toEqual(["safe", "payday"]);
    expect(rememberAsk(["a", "B"], "b")).toEqual(["b", "a"]);
  });
});

describe("imports, exports, report, backups", () => {
  it("turns a recurring charge into a bill", () => {
    expect(recurringToBill({ name: "Netflix", amountCents: 1549, dueDay: 12, category: "subscription" })).toEqual({ name: "Netflix", amountCents: 1549, dueDay: 12, category: "subscription", autopay: true });
  });
  it("exports one combined CSV", () => {
    const csv = moneyCsv({ bills: [{ id: "p", name: "PG&E", amountCents: 9000, dueDay: 3, category: "utilities", autopay: false }], spends: [{ id: "s", date: "2026-11-02", amountCents: 450, note: "latte", category: "coffee" }], side: [], debts: [card] });
    expect(csv.split("\n")).toEqual(["type,date_or_due_day,name,category,amount_usd", "bill,day 3,PG&E,utilities,90.00", "debt,day 25,Visa,apr 25%,500.00", "spend,2026-11-02,latte,coffee,4.50"]);
  });
  it("adds debt minimums to the monthly report", () => {
    const r = monthReport({ month: "2026-10", payments: [], billPaid: {}, bills: [], spends: [], side: [], contribs: [], debts: [card], debtPaid: { c: ["2026-10"] } });
    expect(r.debtPaidCents).toBe(3500);
    expect(r.text).toContain("Debt minimums paid: $35");
  });
  it("accepts v0.26 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [card], goals: [], unusedSubs: [], creditDone: [], debtPaid: { c: ["2026-10"] }, paySplit: { bills: 50, savings: 20, debt: 10, spending: 20 }, leaseEnd: "2027-01-10", askHistory: ["when is payday"] };
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data })).ok).toBe(true);
  });
});
