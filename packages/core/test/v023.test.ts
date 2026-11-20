import { describe, expect, it } from "vitest";
import {
  autopayChecklist,
  cardUtilization,
  challengeAmount,
  challengeStatus,
  growPlanItems,
  lateFeeWaiverLetter,
  monthRecap,
  netWorthHistory,
  netWorthNow,
  noteKey,
  paidThisMonth,
  parseBackup,
  setupProgress,
  spendsCsv,
  upsertSnapshot,
  type Bill,
  type Challenge,
} from "../src";

const bill = (id: string, category: Bill["category"], autopay: boolean, dueDay = 5): Bill => ({ id, name: id.toUpperCase(), amountCents: 1000, dueDay, category, autopay });

describe("cards", () => {
  it("shows per-card use and what to pay to get under 30% / 10%", () => {
    const u = cardUtilization([
      { id: "a", name: "Visa", balanceCents: 90000, apr: 25, minPaymentCents: 1, limitCents: 100000 },
      { id: "b", name: "MC", balanceCents: 10000, apr: 25, minPaymentCents: 1, limitCents: 100000 },
      { id: "c", name: "Car", balanceCents: 900000, apr: 7, minPaymentCents: 1 },
    ]);
    expect(u.rows[0]).toMatchObject({ pct: 90, payTo30Cents: 60000, payTo10Cents: 80000 });
    expect(u).toMatchObject({ overallPct: 50, payTo30Cents: 40000, payTo10Cents: 80000 });
    expect(cardUtilization([]).overallPct).toBeNull();
  });
});

describe("bills", () => {
  it("lists this month's paid bills with confirmation notes", () => {
    const r = paidThisMonth([bill("a", "phone", false), bill("b", "internet", false)], { a: ["2026-11"], b: ["2026-10"] }, { [noteKey("a", "2026-11")]: "Conf #123" }, "2026-11");
    expect(r).toEqual([{ id: "a", name: "A", amountCents: 1000, note: "Conf #123" }]);
  });
  it("orders autopay suggestions by what matters most for credit", () => {
    const c = autopayChecklist([bill("s", "subscription", false, 1), bill("u", "utilities", false, 3), bill("c", "credit_card", false, 20), bill("p", "phone", true)]);
    expect(c.off.map((b) => b.id)).toEqual(["c", "u", "s"]);
    expect(c).toMatchObject({ onCount: 1, total: 4 });
  });
  it("writes a late fee waiver letter", () => {
    const l = lateFeeWaiverLetter({ name: "Omari", company: "PG&E", account: "", feeCents: 1000, paidOn: "2026-11-10", reason: "my paycheck came late", today: "2026-11-20" });
    expect(l).toContain("waive the $10 late fee");
    expect(l).toContain("I paid in full on 2026-11-10 — the payment was late because my paycheck came late.");
  });
});

describe("net worth", () => {
  it("adds up assets and subtracts debts", () => {
    const n = netWorthNow({ otherAssetsCents: 50000, emergencyCents: 100000, goals: [{ id: "g", name: "x", targetCents: 1, savedCents: 20000, targetDate: null }], balanceCents: 30000, debts: [{ id: "d", name: "x", balanceCents: 80000, apr: 1, minPaymentCents: 1 }] });
    expect(n).toMatchObject({ assetsCents: 200000, debtsCents: 80000, netCents: 120000 });
  });
  it("keeps one snapshot per month and shows the change", () => {
    let s = upsertSnapshot([], { month: "2026-10", assetsCents: 100, debtsCents: 500 });
    s = upsertSnapshot(s, { month: "2026-11", assetsCents: 300, debtsCents: 400 });
    s = upsertSnapshot(s, { month: "2026-11", assetsCents: 400, debtsCents: 400 });
    const h = netWorthHistory(s);
    expect(h.rows.map((r) => r.netCents)).toEqual([-400, 0]);
    expect(h.changeCents).toBe(400);
  });
});

describe("spending recap", () => {
  const spends = [
    { id: "1", date: "2026-11-02", amountCents: 1200, note: "", category: "food" as const },
    { id: "2", date: "2026-11-02", amountCents: 500, note: "latte", category: "coffee" as const },
    { id: "3", date: "2026-11-09", amountCents: 3000, note: "" },
    { id: "4", date: "2026-10-05", amountCents: 2000, note: "", category: "food" as const },
  ];
  it("totals by category against last month", () => {
    const r = monthRecap(spends, "2026-11");
    expect(r).toMatchObject({ totalCents: 4700, lastTotalCents: 2000, changeCents: 2700, top: "other", spendDays: 2 });
    expect(r.rows.find((x) => x.category === "food")).toMatchObject({ cents: 1200, lastCents: 2000, changeCents: -800 });
    expect(monthRecap(spends, "2026-01").top).toBeNull();
  });
  it("exports a CSV", () => {
    expect(spendsCsv(spends).split("\n")[1]).toBe("2026-10-05,food,20.00,");
  });
});

describe("52-week challenge and setup", () => {
  const c: Challenge = { start: "2026-11-02", reverse: false, unitCents: 100, done: [1] };
  it("works out this week's amount and progress", () => {
    expect(challengeAmount(c, 52)).toBe(5200);
    expect(challengeAmount({ ...c, reverse: true }, 1)).toBe(5200);
    const s = challengeStatus(c, "2026-11-20");
    expect(s).toMatchObject({ week: 3, thisWeekCents: 300, totalCents: 137800, savedCents: 100, behind: [2, 3], weekDue: "2026-11-22" });
  });
  it("adds plan items for the challenge and a monthly net worth update", () => {
    const items = growPlanItems({ challenge: c, netWorth: [{ month: "2026-10", assetsCents: 1, debtsCents: 0 }], hasMoneySetup: true, now: new Date("2026-11-20T12:00:00Z") });
    expect(items.map((x) => x.detailCode)).toEqual(["challenge_week", "net_worth_update"]);
    expect(growPlanItems({ challenge: null, netWorth: [{ month: "2026-11", assetsCents: 1, debtsCents: 0 }], hasMoneySetup: true, now: new Date("2026-11-20T12:00:00Z") })).toEqual([]);
  });
  it("tracks money setup progress", () => {
    const p = setupProgress({ pay: true, balance: true, rent: false, bills: 2, debts: 0, goals: 1, emergency: false, weeklyLimit: false, remindersOn: false });
    expect(p).toMatchObject({ done: 4, total: 9, pct: 44 });
    expect(p.next!.id).toBe("rent");
  });
  it("accepts v0.23 backups", () => {
    const data = { rentSetup: null, payments: [], bills: [], billPaid: {}, takeHomeCents: null, waitlists: [], pay: null, debts: [{ id: "d", name: "Visa", balanceCents: 1, apr: 1, minPaymentCents: 1, limitCents: 100000 }], goals: [], unusedSubs: [], creditDone: [], spends: [{ id: "s", date: "2026-11-01", amountCents: 1, note: "", category: "coffee" }], billNotes: { "a:2026-11": "Conf 1" }, netWorth: [{ month: "2026-11", assetsCents: 1, debtsCents: 1 }], otherAssetsCents: null, challenge: { start: "2026-11-02", reverse: false, unitCents: 100, done: [1] } };
    const b = { app: "housing-compass", kind: "renter-backup", version: 1, createdAt: "x", data };
    expect(parseBackup(JSON.stringify(b)).ok).toBe(true);
    expect(parseBackup(JSON.stringify({ ...b, data: { ...data, challenge: { ...data.challenge, done: [53] } } })).ok).toBe(false);
  });
});
