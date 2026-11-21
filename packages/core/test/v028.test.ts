import { describe, expect, it } from "vitest";
import { applyPartials, askExamples, monthCashFlow, parseAsk, parseBackup, partialKey, rule503020, trackerObligations, trackerReminders, type Bill } from "../src";

const bills: Bill[] = [
  { id: "p", name: "PG&E", amountCents: 9000, dueDay: 25, category: "utilities", autopay: false },
  { id: "n", name: "Netflix", amountCents: 1500, dueDay: 2, category: "subscription", autopay: true },
];

describe("partials and cash flow", () => {
  it("reduces a bill by what's already paid", () => {
    const o = [
      { id: "bill:p:2026-11", name: "PG&E", amountCents: 9000, dueDate: "2026-11-25", kind: "bill" as const },
      { id: "bill:n:2026-12", name: "Netflix", amountCents: 1500, dueDate: "2026-12-02", kind: "bill" as const },
      { id: "rent:2026-12", name: "Rent", amountCents: 140000, dueDate: "2026-12-01", kind: "rent" as const },
    ];
    const r = applyPartials(o, { [partialKey("p", "2026-11")]: 4000, [partialKey("n", "2026-12")]: 1500 });
    expect(r.map((x) => [x.name, x.amountCents])).toEqual([["PG&E", 5000], ["Rent", 140000]]);
  });
  it("sums the month's money in and out", () => {
    const f = monthCashFlow({
      month: "2026-11",
      pay: { frequency: "biweekly", amountCents: 120000, anchorDate: "2026-11-06" },
      other: [{ id: "o", date: "2026-11-10", source: "Tax refund", amountCents: 30000 }],
      side: [{ id: "s", date: "2026-11-11", source: "Uber", amountCents: 20000 }],
      rent: { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "" },
      bills,
      debts: [{ id: "d", name: "Visa", balanceCents: 50000, apr: 20, minPaymentCents: 3500 }],
      spends: [{ id: "x", date: "2026-11-02", amountCents: 6000, note: "" }],
    });
    expect(f).toMatchObject({ payCents: 260000, otherCents: 30000, sideCents: 20000, inCents: 310000, outCents: 140000 + 10500 + 3500 + 6000, leftCents: 310000 - 160000 });
  });
  it("checks 50/30/20", () => {
    const r = rule503020({ incomeCents: 300000, month: "2026-11", rent: { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "" }, bills, debts: [], spends: [{ id: "a", date: "2026-11-02", amountCents: 6000, note: "", category: "food" }, { id: "b", date: "2026-11-03", amountCents: 3000, note: "", category: "fun" }], contribs: [{ goalId: "g", date: "2026-11-04", amountCents: 30000 }] });
    expect(r).toMatchObject({ needsCents: 155000, wantsCents: 4500, savingsCents: 30000, needsPct: 52, wantsPct: 2, savingsPct: 10 });
    expect(rule503020({ incomeCents: 0, month: "x", rent: null, bills: [], debts: [], spends: [], contribs: [] })).toBeNull();
  });
});

describe("tracker reminders and calendar", () => {
  it("schedules trial, return and lease notifications", () => {
    const r = trackerReminders({
      trials: [{ id: "t", name: "StreamPlus", endsOn: "2026-11-25", costCents: 1599, cycle: "month", canceled: false }],
      returns: [{ id: "r", item: "Jacket", store: "Target", amountCents: 6000, returnBy: "2026-11-30", returned: false }],
      leaseEnd: "2027-01-30",
      now: new Date("2026-11-21T12:00:00Z"),
      utcOffsetMinutes: -480,
    });
    expect(r.map((x) => [x.id, x.at])).toEqual([
      ["trial:t", "2026-11-24T18:00:00.000Z"],
      ["return:r", "2026-11-28T18:00:00.000Z"],
      ["lease:60", "2026-12-01T18:00:00.000Z"],
      ["lease:30", "2026-12-31T18:00:00.000Z"],
    ]);
  });
  it("puts trials and returns on the calendar", () => {
    expect(trackerObligations([{ id: "t", name: "X", endsOn: "2026-11-25", costCents: 1, cycle: "month", canceled: true }], [{ id: "r", item: "Jacket", store: "", amountCents: 6000, returnBy: "2026-11-30", returned: false }])).toEqual([{ id: "return:r", name: "Return Jacket", amountCents: 6000, dueDate: "2026-11-30", kind: "bill" }]);
  });
});

describe("ask", () => {
  it("understands the new questions", () => {
    expect(parseAsk("what's due today").intent).toBe("due_today");
    expect(parseAsk("anything due tomorrow?").intent).toBe("due_tomorrow");
    expect(parseAsk("how much do I make a month").intent).toBe("income");
    expect(parseAsk("how much have I saved this month").intent).toBe("saved_month");
    expect(parseAsk("what changed compared to last month").intent).toBe("changed");
    expect(parseAsk("am I following 50/30/20?").intent).toBe("rule_503020");
    expect(parseAsk("¿Qué vence mañana?").intent).toBe("due_tomorrow");
    expect(parseAsk("How much can I spend today?").intent).toBe("safe");
  });
  it("rotates example questions daily", () => {
    expect(askExamples("2026-11-21")).toHaveLength(6);
    expect(askExamples("2026-11-21")).not.toEqual(askExamples("2026-11-22"));
  });
  it("accepts v0.28 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [], goals: [], unusedSubs: [], creditDone: [], billPartial: { "p:2026-11": 4000 }, otherIncome: [{ id: "o", date: "2026-11-10", source: "Refund", amountCents: 3000 }] };
    expect(parseBackup(JSON.stringify({ app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data })).ok).toBe(true);
  });
});
