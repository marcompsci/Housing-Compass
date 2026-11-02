import { describe, expect, it } from "vitest";
import {
  billPlanItems,
  billReminders,
  billStatuses,
  budgetSnapshot,
  buildIcs,
  buildPlan,
  dueDateEvents,
  milestoneProgress,
  monthlyRule,
  paymentHistorySummary,
  rentIncreaseCheck,
  roomItemText,
  validateBill,
  ROOM_ITEMS,
  ROOMS,
  ROOM_ITEM_TEXT,
  type Bill,
} from "../src";

const now = new Date("2026-11-02T18:00:00Z");
const phone: Bill = { id: "b1", name: "Phone", amountCents: 6500, dueDay: 4, category: "phone", autopay: false };
const power: Bill = { id: "b2", name: "PG&E", amountCents: 9000, dueDay: 20, category: "utilities", autopay: true };
const card: Bill = { id: "b3", name: "Card", amountCents: 3500, dueDay: 1, category: "credit_card", autopay: false };

describe("bills", () => {
  it("validates", () => {
    expect(validateBill({ name: "x", amountCents: 1, dueDay: 1, category: "other", autopay: false })).toMatch(/name/);
    expect(validateBill({ name: "Phone", amountCents: 0, dueDay: 1, category: "other", autopay: false })).toMatch(/amount/);
    expect(validateBill({ name: "Phone", amountCents: 100, dueDay: 32, category: "other", autopay: false })).toMatch(/day/);
    expect(validateBill({ name: "Phone", amountCents: 100, dueDay: 5, category: "other", autopay: false })).toBeNull();
  });
  it("computes due, overdue and paid states", () => {
    const st = billStatuses([phone, power, card], { b2: ["2026-11"] }, now);
    const by = Object.fromEntries(st.map((s) => [s.bill.id, s]));
    expect(by.b1!.state).toBe("due_soon");
    expect(by.b1!.daysUntilDue).toBe(2);
    expect(by.b3!.state).toBe("overdue");
    expect(by.b2!.state).toBe("paid");
    expect(by.b2!.nextDue).toBe("2026-12-20");
    expect(st[0]!.bill.id).toBe("b3");
  });
  it("feeds My plan and reminders, skipping autopay reminders", () => {
    const st = billStatuses([phone, power], {}, now);
    const items = billPlanItems(st, now);
    expect(items.map((i) => i.detailCode)).toEqual(["in_days", "autopay"]);
    expect(items[0]!.urgent).toBe(true);
    const plan = buildPlan({ rent: null, tours: [], applications: [], moveOut: null, waitlists: [], now, extra: items });
    expect(plan.map((p) => p.kind)).toEqual(["bill_due", "bill_due"]);
    const r = billReminders(st, now, -480);
    expect(r.map((x) => x.id)).toEqual(["bill:b1:2026-11-04:0"]);
    expect(r[0]!.at).toBe("2026-11-04T17:00:00.000Z");
  });
});

describe("budget and milestones", () => {
  it("summarizes the month", () => {
    const b = budgetSnapshot(400000, 140000, [phone, power]);
    expect(b.billsCents).toBe(15500);
    expect(b.leftoverCents).toBe(244500);
    expect(b.rentShare).toBeCloseTo(0.35);
    expect(b.status).toBe("ok");
    expect(budgetSnapshot(150000, 140000, [phone, power]).status).toBe("short");
    expect(budgetSnapshot(160000, 140000, [phone]).status).toBe("tight");
    expect(budgetSnapshot(0, 140000, []).rentShare).toBeNull();
  });
  it("tracks milestones", () => {
    expect(milestoneProgress(0)).toEqual({ reached: [], next: 1, toNext: 1 });
    expect(milestoneProgress(4)).toEqual({ reached: [1, 3], next: 6, toNext: 2 });
    expect(milestoneProgress(30).next).toBeNull();
  });
});

describe("rent increase checker", () => {
  it("applies 5% + CPI capped at 10% and the notice rule", () => {
    const a = rentIncreaseCheck({ currentRentCents: 200000, newRentCents: 214000, cpiPercent: 3, noticeDate: "2026-11-01", effectiveDate: "2026-12-01" });
    expect(a).toMatchObject({ increasePct: 7, capPct: 8, overCap: false, noticeDaysRequired: 30, noticeDaysGiven: 30, noticeShort: false });
    const b = rentIncreaseCheck({ currentRentCents: 200000, newRentCents: 224000, cpiPercent: 7, noticeDate: "2026-11-01", effectiveDate: "2026-12-01" });
    expect(b).toMatchObject({ increasePct: 12, capPct: 10, overCap: true, noticeDaysRequired: 90, noticeShort: true });
    expect(rentIncreaseCheck({ currentRentCents: 100000, newRentCents: 100000, cpiPercent: -1 }).capPct).toBe(5);
    expect(() => rentIncreaseCheck({ currentRentCents: 0, newRentCents: 1, cpiPercent: 1 })).toThrow();
  });
});

describe("history summary and calendar", () => {
  const setup = { amountCents: 140000, dueDay: 1, graceDays: 3, payee: "Oak St Apts" };
  const pay = (month: string, paidOn: string) => ({ id: month, month, paidOn, amountCents: 140000, method: "portal" as const, confirmation: "" });
  it("writes a factual summary", () => {
    const t = paymentHistorySummary(setup, [pay("2026-09", "2026-09-01"), pay("2026-10", "2026-10-02")], { tenantName: "A. Renter", address: "1 Main St" }, now);
    expect(t).toContain("Months paid on time: 2 of 2");
    expect(t).toContain("(2026-09 to 2026-10)");
    expect(t).toContain("prepared by the tenant");
  });
  it("makes monthly recurring all-day events that land on short months", () => {
    expect(monthlyRule(5)).toBe("FREQ=MONTHLY;BYMONTHDAY=5");
    expect(monthlyRule(31)).toBe("FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1");
    const ics = buildIcs(dueDateEvents(setup, [phone], now), now);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
    expect(ics).toContain("RRULE:FREQ=MONTHLY;BYMONTHDAY=4");
    expect(ics).toContain("TRIGGER:-PT3780M");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("move-in checklist translations", () => {
  it("covers every item in Spanish and Chinese", () => {
    for (const r of ROOMS) for (const item of ROOM_ITEMS[r]) {
      expect(ROOM_ITEM_TEXT.es[item], item).toBeTruthy();
      expect(ROOM_ITEM_TEXT.zh[item], item).toBeTruthy();
    }
    expect(roomItemText("Fridge", "en")).toBe("Fridge");
    expect(roomItemText("Fridge", "es")).toBe("Refrigerador");
  });
});

describe("permission text", () => {
  it("explains camera, photos and Face ID, and asks for no microphone", async () => {
    const { readFileSync } = await import("node:fs");
    const app = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8"));
    const plugin = (name: string) => app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)?.[1];
    expect(plugin("expo-image-picker").cameraPermission).toMatch(/stay on your phone/);
    expect(plugin("expo-image-picker").microphonePermission).toBe(false);
    expect(plugin("expo-local-authentication").faceIDPermission).toMatch(/Face ID/);
  });
});
