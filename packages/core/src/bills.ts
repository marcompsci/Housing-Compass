/**
 * Bills beyond rent (utilities, phone, insurance, loans…), a simple monthly budget, on-time
 * milestones, a rent-increase checker for California's statewide cap, a payment-history
 * summary for rental applications, and recurring calendar events. Pure; works offline.
 * General information, not legal or financial advice.
 */
import type { CalendarEvent } from "./calendar";
import { dueDateFor, rentSummary, type PlanItem, type RentPayment, type RentSetup } from "./renterTools";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const atNoonUtc = (s: string) => new Date(`${s}T12:00:00Z`);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return ymd(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
};

// ───────── Bills ─────────
export const BILL_CATEGORIES = ["utilities", "phone", "internet", "insurance", "car", "credit_card", "loan", "subscription", "other"] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];

export interface Bill {
  id: string;
  name: string;
  amountCents: number;
  dueDay: number;
  category: BillCategory;
  autopay: boolean;
}

export function validateBill(b: Omit<Bill, "id">): string | null {
  if (b.name.trim().length < 2) return "Enter the bill's name.";
  if (!Number.isInteger(b.amountCents) || b.amountCents <= 0 || b.amountCents > 2_000_000) return "Enter the usual amount.";
  if (!Number.isInteger(b.dueDay) || b.dueDay < 1 || b.dueDay > 31) return "Enter a due day from 1 to 31.";
  return null;
}

export interface BillStatus {
  bill: Bill;
  nextDue: string;
  daysUntilDue: number;
  paidThisMonth: boolean;
  state: "paid" | "overdue" | "due_soon" | "upcoming";
}

/** paidMonths: bill id → months (YYYY-MM) marked paid. */
export function billStatuses(bills: Bill[], paidMonths: Record<string, string[]>, now: Date): BillStatus[] {
  const month = ymd(now).slice(0, 7);
  const today = atNoonUtc(ymd(now)).getTime();
  return bills
    .map((bill) => {
      const paidThisMonth = (paidMonths[bill.id] ?? []).includes(month);
      const nextDue = dueDateFor(paidThisMonth ? addMonths(month, 1) : month, bill.dueDay);
      const daysUntilDue = Math.round((atNoonUtc(nextDue).getTime() - today) / DAY);
      const state: BillStatus["state"] = paidThisMonth ? "paid" : daysUntilDue < 0 ? "overdue" : daysUntilDue <= 3 ? "due_soon" : "upcoming";
      return { bill, nextDue, daysUntilDue, paidThisMonth, state };
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.bill.name.localeCompare(b.bill.name));
}

export function billPlanItems(statuses: BillStatus[], now: Date, horizonDays = 30): PlanItem[] {
  const horizon = atNoonUtc(ymd(now)).getTime() + horizonDays * DAY;
  return statuses
    .filter((s) => atNoonUtc(s.nextDue).getTime() <= horizon)
    .map((s) => ({
      kind: "bill_due" as const,
      date: s.nextDue,
      title: `${s.bill.name} · ${usd(s.bill.amountCents)}`,
      detail: s.bill.autopay ? "Autopay — check it went through" : s.daysUntilDue < 0 ? `${-s.daysUntilDue} days late` : s.daysUntilDue === 0 ? "Due today" : `In ${s.daysUntilDue} days`,
      detailCode: s.bill.autopay ? ("autopay" as const) : s.daysUntilDue < 0 ? ("days_late" as const) : s.daysUntilDue === 0 ? ("due_today" as const) : ("in_days" as const),
      n: Math.abs(s.daysUntilDue),
      href: "/bills",
      urgent: !s.bill.autopay && s.daysUntilDue <= 2,
    }));
}

/** Local reminders for bills not on autopay: 3 days before and on the due day, 9am local. */
export function billReminders(statuses: BillStatus[], now: Date, utcOffsetMinutes: number) {
  const out: Array<{ id: string; at: string; title: string; body: string }> = [];
  for (const s of statuses) {
    if (s.bill.autopay) continue;
    for (const before of [3, 0]) {
      const at = new Date(`${s.nextDue}T09:00:00Z`).getTime() - utcOffsetMinutes * 60_000 - before * DAY;
      if (at > now.getTime()) out.push({ id: `bill:${s.bill.id}:${s.nextDue}:${before}`, at: new Date(at).toISOString(), title: before ? `${s.bill.name} due in 3 days` : `${s.bill.name} is due today`, body: `${usd(s.bill.amountCents)}. Mark it paid in Housing Compass.` });
    }
  }
  return out;
}

// ───────── Monthly budget ─────────
export interface BudgetSnapshot {
  incomeCents: number;
  rentCents: number;
  billsCents: number;
  leftoverCents: number;
  rentShare: number | null;
  housingAndBillsShare: number | null;
  status: "ok" | "tight" | "short";
}

export function budgetSnapshot(takeHomeMonthlyCents: number, rentCents: number, bills: Bill[]): BudgetSnapshot {
  const billsCents = bills.reduce((s, b) => s + b.amountCents, 0);
  const leftoverCents = takeHomeMonthlyCents - rentCents - billsCents;
  const inc = takeHomeMonthlyCents > 0 ? takeHomeMonthlyCents : null;
  return {
    incomeCents: takeHomeMonthlyCents,
    rentCents,
    billsCents,
    leftoverCents,
    rentShare: inc ? rentCents / inc : null,
    housingAndBillsShare: inc ? (rentCents + billsCents) / inc : null,
    status: leftoverCents < 0 ? "short" : inc && leftoverCents < inc * 0.1 ? "tight" : "ok",
  };
}

// ───────── On-time milestones ─────────
export const MILESTONES = [1, 3, 6, 12, 24] as const;
export function milestoneProgress(streak: number): { reached: number[]; next: number | null; toNext: number } {
  const reached = MILESTONES.filter((m) => streak >= m);
  const next = MILESTONES.find((m) => streak < m) ?? null;
  return { reached: [...reached], next, toNext: next ? next - streak : 0 };
}

// ───────── Rent increase checker (Civil Code §1947.12 and §827) ─────────
export interface IncreaseCheck {
  increasePct: number;
  /** Statewide cap: 5% + regional CPI change, never more than 10%. */
  capPct: number;
  overCap: boolean;
  noticeDaysRequired: 30 | 90;
  noticeDaysGiven: number | null;
  noticeShort: boolean;
}

export function rentIncreaseCheck(i: { currentRentCents: number; newRentCents: number; cpiPercent: number; noticeDate?: string | null; effectiveDate?: string | null }): IncreaseCheck {
  if (!(i.currentRentCents > 0) || !(i.newRentCents > 0)) throw new Error("Enter both rents.");
  const increasePct = Math.round(((i.newRentCents - i.currentRentCents) / i.currentRentCents) * 10_000) / 100;
  const capPct = Math.round(Math.min(10, 5 + Math.max(0, i.cpiPercent)) * 100) / 100;
  const noticeDaysRequired = increasePct > 10 ? 90 : 30;
  const noticeDaysGiven = i.noticeDate && i.effectiveDate ? Math.round((atNoonUtc(i.effectiveDate).getTime() - atNoonUtc(i.noticeDate).getTime()) / DAY) : null;
  return { increasePct, capPct, overCap: increasePct > capPct, noticeDaysRequired, noticeDaysGiven, noticeShort: noticeDaysGiven !== null && noticeDaysGiven < noticeDaysRequired };
}

export const RENT_CAP_SOURCE = { label: "Civil Code §1947.12 (Tenant Protection Act)", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.12" };
export const NOTICE_SOURCE = { label: "Civil Code §827 (notice of rent increase)", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=827" };

// ───────── Payment history summary (for rental applications) ─────────
export function paymentHistorySummary(setup: RentSetup, payments: RentPayment[], i: { tenantName: string; address: string }, now: Date): string {
  const s = rentSummary(setup, payments, now);
  const months = [...new Set(payments.map((p) => p.month))].sort();
  const lines = [
    "RENT PAYMENT HISTORY",
    `Tenant: ${i.tenantName || "[Your name]"}`,
    `Rental: ${i.address || "[Address]"}`,
    `Paid to: ${setup.payee || "[Landlord / manager]"}`,
    `Monthly rent: ${usd(setup.amountCents)}, due on day ${setup.dueDay}`,
    `Prepared: ${ymd(now)}`,
    "",
    `Months recorded: ${s.monthsLogged}${months.length ? ` (${months[0]} to ${months[months.length - 1]})` : ""}`,
    `Months paid on time: ${s.onTimeMonths} of ${s.monthsLogged}`,
    `Current on-time streak: ${s.onTimeStreak} month${s.onTimeStreak === 1 ? "" : "s"}`,
    "",
    "This summary was prepared by the tenant from their own records. Receipts, bank statements or the landlord's ledger can confirm it; a detailed spreadsheet is available on request.",
  ];
  return lines.join("\n");
}

// ───────── Recurring calendar events (rent and bills) ─────────
/** RRULE for "day N of every month", landing on the month's last day when N is past it. */
export function monthlyRule(dueDay: number): string {
  return dueDay <= 28 ? `FREQ=MONTHLY;BYMONTHDAY=${dueDay}` : `FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: dueDay - 27 }, (_, k) => 28 + k).join(",")};BYSETPOS=-1`;
}

export function dueDateEvents(rent: RentSetup | null, bills: Bill[], now: Date): CalendarEvent[] {
  const month = ymd(now).slice(0, 7);
  const ev = (uid: string, title: string, dueDay: number, description: string): CalendarEvent => ({
    uid,
    title,
    startsAt: dueDateFor(month, dueDay),
    durationMinutes: 0,
    allDay: true,
    rrule: monthlyRule(dueDay),
    description,
    alarmMinutesBefore: 24 * 60 * 3 - 9 * 60,
  });
  const out: CalendarEvent[] = [];
  if (rent) out.push(ev("rent-due", `Rent due · ${usd(rent.amountCents)}`, rent.dueDay, `Pay ${rent.payee || "rent"} and log it in Housing Compass.`));
  for (const b of bills) out.push(ev(`bill-${b.id}`, `${b.name} due · ${usd(b.amountCents)}`, b.dueDay, b.autopay ? "On autopay: check it went through." : "Pay and mark it paid in Housing Compass."));
  return out;
}

// ───────── Move-in checklist item names in other languages ─────────
export const ROOM_ITEM_TEXT: Record<"es" | "zh", Record<string, string>> = {
  es: {
    "Front door & lock": "Puerta de entrada y cerradura", "Smoke alarm": "Detector de humo", "Walls & floor": "Paredes y piso", "Walls & paint": "Paredes y pintura",
    "Floors / carpet": "Pisos / alfombra", "Windows & screens": "Ventanas y mosquiteros", "Outlets & lights": "Enchufes y luces", "Stove & oven": "Estufa y horno",
    Fridge: "Refrigerador", "Sink & faucet": "Fregadero y llave", "Cabinets & counters": "Gabinetes y encimeras", "Signs of pests": "Señales de plagas", Toilet: "Inodoro",
    "Shower / tub": "Regadera / tina", "Fan / ventilation": "Extractor / ventilación", "Signs of mold or leaks": "Señales de moho o fugas", "Windows & locks": "Ventanas y seguros", Closet: "Clóset",
  },
  zh: {
    "Front door & lock": "前门和门锁", "Smoke alarm": "烟雾报警器", "Walls & floor": "墙壁和地板", "Walls & paint": "墙壁和油漆", "Floors / carpet": "地板/地毯",
    "Windows & screens": "窗户和纱窗", "Outlets & lights": "插座和灯", "Stove & oven": "炉灶和烤箱", Fridge: "冰箱", "Sink & faucet": "水槽和水龙头", "Cabinets & counters": "橱柜和台面",
    "Signs of pests": "虫害迹象", Toilet: "马桶", "Shower / tub": "淋浴/浴缸", "Fan / ventilation": "排气扇/通风", "Signs of mold or leaks": "霉菌或漏水迹象", "Windows & locks": "窗户和锁", Closet: "衣柜",
  },
};
export function roomItemText(item: string, locale: string): string {
  return locale === "es" || locale === "zh" ? (ROOM_ITEM_TEXT[locale][item] ?? item) : item;
}
