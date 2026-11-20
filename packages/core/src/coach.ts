/**
 * v0.22: everyday spending and decisions — "can I afford this?", a weekly spending limit with
 * quick logging and an under-limit streak, a windfall planner, a credit score journal (scores
 * the user enters — never estimated), debt progress, bill promo-price watch, a dispute letter,
 * a free-report reminder and a weekly review. Device-only. Not financial or legal advice.
 */
import type { Bill } from "./bills";
import type { Debt, ForecastDay } from "./money";
import type { PlanItem, ReminderPlan } from "./renterTools";
import type { SideIncome } from "./earn";
import { reportCheckStatus, type Bureau } from "./assist";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Can I afford this? ─────────
export type AffordVerdict = "yes" | "tight" | "wait" | "no";
/**
 * Checks a one-time purchase against today's safe-to-spend amount and the 30-day forecast.
 * yes: fits and keeps a cushion; tight: fits but leaves under the cushion; wait: would push the
 * forecast below $0 before money comes in, but fits after the next payday; no: doesn't fit.
 */
export function canAfford(i: { priceCents: number; safeCents: number; series: ForecastDay[]; nextPayday: string | null; cushionCents?: number }) {
  const cushion = i.cushionCents ?? 5000;
  const lowestAfter = i.series.length ? Math.min(...i.series.map((d) => d.balanceCents)) - i.priceCents : null;
  const afterPay = i.nextPayday ? i.series.filter((d) => d.date >= i.nextPayday!) : [];
  const lowestFromPayday = afterPay.length ? Math.min(...afterPay.map((d) => d.balanceCents)) - i.priceCents : null;
  let verdict: AffordVerdict;
  if (i.priceCents <= i.safeCents - cushion) verdict = "yes";
  else if (i.priceCents <= i.safeCents) verdict = "tight";
  else if (lowestFromPayday !== null && lowestFromPayday >= cushion) verdict = "wait";
  else verdict = "no";
  return { verdict, leftCents: i.safeCents - i.priceCents, lowestAfterCents: lowestAfter, waitUntil: verdict === "wait" ? i.nextPayday : null };
}

// ───────── Weekly spending limit ─────────
export interface Spend {
  id: string;
  date: string;
  amountCents: number;
  note: string;
}
/** Weeks start on Monday. */
export function weekStart(date: string): string {
  const d = noon(date);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}
export function weekSpending(spends: Spend[], limitCents: number | null, today: string) {
  const start = weekStart(today);
  const end = addDays(start, 7);
  const items = spends.filter((s) => s.date >= start && s.date < end);
  const spent = items.reduce((s, x) => s + x.amountCents, 0);
  const daysLeft = daysBetween(today, end);
  return {
    weekStart: start,
    spentCents: spent,
    count: items.length,
    leftCents: limitCents === null ? null : limitCents - spent,
    over: limitCents !== null && spent > limitCents,
    perDayLeftCents: limitCents === null ? null : Math.max(0, Math.floor((limitCents - spent) / Math.max(1, daysLeft))),
    daysLeft,
  };
}
/** Finished weeks in a row (before this one) that stayed within the limit. Weeks with no spends count as within. */
export function underLimitStreak(spends: Spend[], limitCents: number | null, today: string): number {
  if (limitCents === null || !spends.length) return 0;
  const first = spends.map((s) => s.date).sort()[0]!;
  let start = addDays(weekStart(today), -7);
  let n = 0;
  while (start >= weekStart(first) && n < 520) {
    const end = addDays(start, 7);
    const spent = spends.filter((s) => s.date >= start && s.date < end).reduce((s, x) => s + x.amountCents, 0);
    if (spent > limitCents) break;
    n++;
    start = addDays(start, -7);
  }
  return n;
}

// ───────── Windfall planner ─────────
/**
 * Splits a tax refund, bonus or gift: first anything overdue, then the emergency fund up to one
 * month of essentials, then the highest-APR debt, then goals; whatever is left is yours.
 */
export function windfallPlan(i: { amountCents: number; overdueCents: number; emergencyCents: number; monthlyEssentialsCents: number; debts: Debt[]; goalsLeftCents: number; funPct?: number }) {
  let left = Math.max(0, i.amountCents);
  const fun = Math.round((left * Math.max(0, Math.min(50, i.funPct ?? 10))) / 100);
  left -= fun;
  const take = (want: number) => {
    const x = Math.max(0, Math.min(left, want));
    left -= x;
    return x;
  };
  const overdue = take(i.overdueCents);
  const emergency = take(Math.max(0, i.monthlyEssentialsCents - i.emergencyCents));
  const top = [...i.debts].filter((d) => d.balanceCents > 0).sort((a, b) => b.apr - a.apr)[0] ?? null;
  const debt = take(top ? top.balanceCents : 0);
  const goals = take(i.goalsLeftCents);
  const rest = left;
  return {
    rows: [
      { id: "overdue", cents: overdue },
      { id: "emergency", cents: emergency },
      { id: "debt", cents: debt, name: top?.name ?? null },
      { id: "goals", cents: goals },
      { id: "fun", cents: fun + rest },
    ].filter((r) => r.cents > 0),
  };
}

// ───────── Credit score journal ─────────
export interface ScoreEntry {
  id: string;
  date: string;
  score: number;
  source: string;
}
export function scoreTrend(list: ScoreEntry[]) {
  const rows = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const last = rows[rows.length - 1] ?? null;
  const prev = rows.length > 1 ? rows[rows.length - 2]! : null;
  const sameSourcePrev = last ? [...rows].reverse().find((r) => r.id !== last.id && r.source === last.source) ?? null : null;
  return {
    rows,
    latest: last,
    change: last && prev ? last.score - prev.score : null,
    sameSourceChange: last && sameSourcePrev ? last.score - sameSourcePrev.score : null,
    min: rows.length ? Math.min(...rows.map((r) => r.score)) : null,
    max: rows.length ? Math.max(...rows.map((r) => r.score)) : null,
  };
}

// ───────── Debt progress ─────────
export function debtProgress(debts: Debt[]) {
  const rows = debts.map((d) => {
    const start = Math.max(d.startBalanceCents ?? d.balanceCents, d.balanceCents);
    const paid = start - d.balanceCents;
    return { id: d.id, name: d.name, startCents: start, paidCents: paid, pct: start ? Math.round((paid / start) * 100) : 0, paidOff: d.balanceCents === 0 };
  });
  const start = rows.reduce((s, r) => s + r.startCents, 0);
  const paid = rows.reduce((s, r) => s + r.paidCents, 0);
  return { rows, startCents: start, paidCents: paid, pct: start ? Math.round((paid / start) * 100) : 0, paidOff: rows.filter((r) => r.paidOff).length };
}

// ───────── Bill promo price watch ─────────
export function billPromoItems(bills: Bill[], now: Date, leadDays = 21): PlanItem[] {
  const today = ymd(now);
  return bills
    .filter((b) => b.promoEnds && b.promoEnds >= addDays(today, -7) && daysBetween(today, b.promoEnds) <= leadDays)
    .map((b) => {
      const n = daysBetween(today, b.promoEnds!);
      return { kind: "bill_promo" as const, date: n < 0 ? today : addDays(b.promoEnds!, -Math.min(7, Math.max(0, n))), title: `${b.name}: promo price ends ${b.promoEnds}`, detail: "Call to ask for a new promo or a lower plan", detailCode: "promo_call" as const, n, href: "/wins", urgent: n <= 7 };
    });
}

// ───────── Dispute letter ─────────
export const BUREAU_NAMES: Record<Bureau, string> = { equifax: "Equifax", experian: "Experian", transunion: "TransUnion" };
export function disputeLetter(i: { name: string; address: string; bureau: Bureau; item: string; why: string; today: string }): string {
  return [
    i.today,
    "",
    `To: ${BUREAU_NAMES[i.bureau]} — Dispute department`,
    `From: ${i.name || "[Your full name]"}`,
    i.address || "[Your mailing address]",
    "",
    "Re: Request to investigate and correct my credit report",
    "",
    "I am writing to dispute the following information in my credit report:",
    `• ${i.item || "[Account name and number, and the item that is wrong]"}`,
    "",
    `This information is inaccurate because: ${i.why || "[Explain why it is wrong]"}`,
    "",
    "Please investigate this item and correct or remove it. I have enclosed copies of documents that support my position, and a copy of my report with the item marked.",
    "Please send me the results of your investigation in writing.",
    "",
    "Sincerely,",
    i.name || "[Your name]",
    "",
    "Enclosures: [list your copies — never send originals]",
  ].join("\n");
}

// ───────── Free-report reminder ─────────
/** One reminder at 10am local time on the next day a free weekly report can be checked again. */
export function reportReminder(checks: Array<{ bureau: Bureau; date: string }>, now: Date, utcOffsetMinutes: number): ReminderPlan[] {
  if (!checks.length) return [];
  const today = ymd(new Date(now.getTime() + utcOffsetMinutes * 60_000));
  const next = reportCheckStatus(checks, today)
    .filter((r) => r.last && !r.canCheck)
    .map((r) => r.next)
    .sort()[0];
  if (!next) return [];
  const at = Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, Number(next.slice(8, 10)), 10) - utcOffsetMinutes * 60_000;
  if (at <= now.getTime()) return [];
  return [{ id: `report:${next}`, at: new Date(at).toISOString(), title: "Free credit report available", body: "You can check your free weekly credit report again at AnnualCreditReport.com." }];
}

// ───────── Weekly review ─────────
export function weeklyReview(i: { today: string; spends: Spend[]; limitCents: number | null; side: SideIncome[]; billPaid: Record<string, string[]>; bills: Bill[] }) {
  const w = weekSpending(i.spends, i.limitCents, i.today);
  const end = addDays(w.weekStart, 7);
  const side = i.side.filter((x) => x.date >= w.weekStart && x.date < end).reduce((s, x) => s + x.amountCents, 0);
  const month = i.today.slice(0, 7);
  const paid = i.bills.filter((b) => (i.billPaid[b.id] ?? []).includes(month)).length;
  return { weekStart: w.weekStart, spentCents: w.spentCents, limitCents: i.limitCents, over: w.over, sideCents: side, billsPaidThisMonth: paid, billsTotal: i.bills.length, text: `Week of ${w.weekStart}: spent ${usd(w.spentCents)}${i.limitCents !== null ? ` of ${usd(i.limitCents)}` : ""}, side income ${usd(side)}, ${paid}/${i.bills.length} bills paid this month.` };
}
