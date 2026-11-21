/**
 * v0.21: the day-to-day money assistant — safe to spend today, the week ahead, side-work
 * expenses and real hourly pay, a monthly side-income goal, bill-lowering wins, credit report
 * checks, hard inquiries, disputes, statement-closing and promo-rate timing, a fixed-payoff
 * calculator, roommate IOUs and "your share" messages, and bills measured in work hours.
 * Device-only. General information, not legal, tax or financial advice.
 */
import type { Bill } from "./bills";
import type { Debt, Obligation } from "./money";
import { mileageRateFor, type MileageEntry, type SideIncome } from "./earn";
import type { PlanItem } from "./renterTools";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// ───────── Safe to spend & the week ahead ─────────
/**
 * Money you can spend today without missing anything due before the next payday:
 * balance − obligations due before next payday − savings set-aside − a buffer.
 * With no payday known, it looks 14 days ahead.
 */
export function safeToSpend(i: { balanceCents: number; obligations: Obligation[]; nextPayday: string | null; today: string; setAsideCents?: number; bufferCents?: number }) {
  const until = i.nextPayday ?? addDays(i.today, 14);
  const due = i.obligations.filter((o) => o.dueDate >= i.today && o.dueDate < until);
  const dueCents = due.reduce((s, o) => s + o.amountCents, 0);
  const raw = i.balanceCents - dueCents - (i.setAsideCents ?? 0) - (i.bufferCents ?? 0);
  const days = Math.max(1, daysBetween(i.today, until));
  return { safeCents: Math.max(0, raw), shortCents: Math.max(0, -raw), dueCents, dueCount: due.length, until, perDayCents: Math.max(0, Math.floor(raw / days)), days };
}

export function weekAhead(obligations: Obligation[], today: string) {
  const end = addDays(today, 7);
  const items = obligations.filter((o) => o.dueDate >= today && o.dueDate < end).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { items, totalCents: items.reduce((s, o) => s + o.amountCents, 0), todayCount: items.filter((o) => o.dueDate === today).length };
}

// ───────── Side work: expenses, profit, real hourly pay, monthly goal ─────────
export type ExpenseCategory = "phone" | "supplies" | "fees" | "other";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["phone", "supplies", "fees", "other"];
export interface SideExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amountCents: number;
  note: string;
}

/** Year-to-date side-work profit after mileage and expenses, the tax set-aside on it, and pay per hour. */
export function sideProfit(i: { income: SideIncome[]; miles: MileageEntry[]; expenses: SideExpense[]; setAsidePct: number; now: Date }) {
  const y = String(i.now.getUTCFullYear());
  const inc = i.income.filter((x) => x.date.startsWith(y));
  const gross = inc.reduce((s, x) => s + x.amountCents, 0);
  const mileage = Math.round(i.miles.filter((m) => m.date.startsWith(y)).reduce((s, m) => s + m.miles * (mileageRateFor(m.date) ?? 0), 0));
  const expenses = i.expenses.filter((x) => x.date.startsWith(y)).reduce((s, x) => s + x.amountCents, 0);
  const profit = Math.max(0, gross - mileage - expenses);
  const timed = inc.filter((x) => (x.hours ?? 0) > 0);
  const hours = Math.round(timed.reduce((s, x) => s + (x.hours ?? 0), 0) * 10) / 10;
  const timedGross = timed.reduce((s, x) => s + x.amountCents, 0);
  const share = gross ? timedGross / gross : 0;
  const pct = Math.max(0, Math.min(50, i.setAsidePct));
  return {
    grossCents: gross,
    mileageCents: mileage,
    expensesCents: expenses,
    profitCents: profit,
    setAsideCents: Math.round((profit * pct) / 100),
    hours,
    grossHourlyCents: hours ? Math.round(timedGross / hours) : null,
    /** Hourly pay after a proportional share of mileage and expenses. */
    netHourlyCents: hours ? Math.round((timedGross - (mileage + expenses) * share) / hours) : null,
  };
}

export function sideGoalProgress(income: SideIncome[], goalCents: number | null, now: Date) {
  const month = ymd(now).slice(0, 7);
  const earned = income.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.amountCents, 0);
  if (!goalCents) return { earnedCents: earned, goalCents: null, leftCents: null, progress: null, perDayCents: null };
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const daysLeft = daysInMonth(y, m) - now.getUTCDate() + 1;
  const left = Math.max(0, goalCents - earned);
  return { earnedCents: earned, goalCents, leftCents: left, progress: Math.min(1, earned / goalCents), perDayCents: Math.ceil(left / daysLeft) };
}

// ───────── Bill-lowering wins ─────────
export interface Negotiation {
  id: string;
  date: string;
  company: string;
  ask: string;
  result: "lower" | "credit" | "no" | "pending";
  monthlySavingsCents: number;
  oneTimeCents: number;
}

/** What asking paid off: monthly savings, one-time credits, and savings for the next 12 months. */
export function savingsWon(negs: Negotiation[], bills: Bill[], unusedSubs: string[]) {
  const wins = negs.filter((n) => n.result === "lower" || n.result === "credit");
  const monthly = wins.reduce((s, n) => s + n.monthlySavingsCents, 0);
  const oneTime = wins.reduce((s, n) => s + n.oneTimeCents, 0);
  const subsMonthly = bills.filter((b) => b.category === "subscription" && unusedSubs.includes(b.id)).reduce((s, b) => s + b.amountCents, 0);
  return { wins: wins.length, asked: negs.length, pending: negs.filter((n) => n.result === "pending").length, monthlyCents: monthly, oneTimeCents: oneTime, subsMonthlyCents: subsMonthly, nextYearCents: (monthly + subsMonthly) * 12 + oneTime };
}

// ───────── Credit: reports, inquiries, disputes ─────────
export type Bureau = "equifax" | "experian" | "transunion";
export const BUREAUS: Bureau[] = ["equifax", "experian", "transunion"];
/** Free weekly reports from all three bureaus are available at AnnualCreditReport.com. */
export const FREE_REPORT_URL = "https://www.annualcreditreport.com";
export const FREE_REPORT_DAYS = 7;

export function reportCheckStatus(checks: Array<{ bureau: Bureau; date: string }>, today: string) {
  return BUREAUS.map((b) => {
    const last = checks.filter((c) => c.bureau === b).map((c) => c.date).sort().pop() ?? null;
    const next = last ? addDays(last, FREE_REPORT_DAYS) : today;
    return { bureau: b, last, next, canCheck: next <= today };
  });
}

export interface Inquiry {
  id: string;
  date: string;
  lender: string;
}
/** Hard inquiries stay on a report for two years; FICO scores only count those from the last 12 months. */
export function inquiryStatus(list: Inquiry[], today: string) {
  const rows = list
    .map((q) => {
      const d = noon(q.date);
      const plusYears = (n: number) => {
        const x = new Date(d);
        x.setUTCFullYear(x.getUTCFullYear() + n);
        return ymd(x);
      };
      const scoreUntil = plusYears(1);
      const reportUntil = plusYears(2);
      return { ...q, scoreUntil, reportUntil, counts: today < scoreUntil, onReport: today < reportUntil };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return { rows, countingNow: rows.filter((r) => r.counts).length, onReportNow: rows.filter((r) => r.onReport).length };
}

export interface Dispute {
  id: string;
  bureau: Bureau;
  item: string;
  sentOn: string;
  resolved: boolean;
}
/** Credit bureaus generally have 30 days to investigate a dispute (45 in some cases). */
export const DISPUTE_DAYS = 30;
export function disputeStatus(list: Dispute[], today: string) {
  return list
    .map((d) => {
      const due = addDays(d.sentOn, DISPUTE_DAYS);
      return { ...d, responseDue: due, daysLeft: daysBetween(today, due), late: !d.resolved && today > due };
    })
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.responseDue.localeCompare(b.responseDue));
}

// ───────── Cards: statement closing and promo rates ─────────
/** The next statement closing date, and a "pay by" two days earlier so a lower balance gets reported. */
export function statementTiming(d: Debt, today: string) {
  if (!d.statementDay) return null;
  const [y, m] = today.split("-").map(Number) as [number, number];
  const close = (yy: number, mm: number) => {
    const dim = daysInMonth(yy, mm);
    return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(d.statementDay!, dim)).padStart(2, "0")}`;
  };
  let c = close(y, m - 1);
  if (c < today) c = m === 12 ? close(y + 1, 0) : close(y, m);
  return { closes: c, payBy: addDays(c, -2), daysLeft: daysBetween(today, c) };
}

/** Monthly payment that clears the card before a promotional rate ends. */
export function promoPlan(d: Debt, today: string) {
  if (!d.promoEnds) return null;
  const days = daysBetween(today, d.promoEnds);
  if (days < 0) return { ended: true, monthsLeft: 0, perMonthCents: null, promoEnds: d.promoEnds };
  const months = Math.max(1, Math.floor(days / 30.44));
  return { ended: false, monthsLeft: months, perMonthCents: Math.ceil(d.balanceCents / months), promoEnds: d.promoEnds };
}

/** Fixed monthly payment that pays a balance off in `months` at the given APR (standard amortization). */
export function paymentForMonths(balanceCents: number, apr: number, months: number) {
  if (balanceCents <= 0 || months < 1) return { perMonthCents: 0, totalInterestCents: 0 };
  const r = apr / 100 / 12;
  const per = r === 0 ? balanceCents / months : (balanceCents * r) / (1 - Math.pow(1 + r, -months));
  const perMonth = Math.ceil(per);
  return { perMonthCents: perMonth, totalInterestCents: Math.max(0, perMonth * months - balanceCents) };
}

// ───────── Roommates ─────────
export interface Iou {
  id: string;
  date: string;
  person: string;
  /** Positive: they owe you. Negative: you owe them. */
  amountCents: number;
  note: string;
  settled: boolean;
}
export function iouBalances(list: Iou[]) {
  const by = new Map<string, number>();
  for (const x of list) if (!x.settled) by.set(x.person, (by.get(x.person) ?? 0) + x.amountCents);
  const people = [...by.entries()].filter(([, c]) => c !== 0).map(([person, cents]) => ({ person, cents })).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  return { people, owedToYouCents: people.filter((p) => p.cents > 0).reduce((s, p) => s + p.cents, 0), youOweCents: -people.filter((p) => p.cents < 0).reduce((s, p) => s + p.cents, 0) };
}

export function shareMessage(i: { bill: string; totalCents: number; shareCents: number; dueDate: string | null; payTo: string }) {
  return [
    `Hi! Your share of ${i.bill} is ${usd(i.shareCents)} (total ${usd(i.totalCents)})${i.dueDate ? `, due ${i.dueDate}` : ""}.`,
    i.payTo.trim() ? `You can send it to ${i.payTo.trim()}.` : "",
    "Thanks!",
  ]
    .filter(Boolean)
    .join(" ");
}

// ───────── Bills in work hours ─────────
export function hoursToCover(amountCents: number, hourlyCents: number | null) {
  if (!hourlyCents || hourlyCents <= 0) return null;
  return Math.round((amountCents / hourlyCents) * 10) / 10;
}

// ───────── Bills: months with everything checked off ─────────
export function allPaidStreak(bills: Bill[], billPaid: Record<string, string[]>, now: Date) {
  if (!bills.length) return 0;
  const done = (month: string) => bills.every((b) => (billPaid[b.id] ?? []).includes(month));
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let streak = done(ymd(d).slice(0, 7)) ? 1 : 0;
  for (let i = 0; i < 120; i++) {
    d.setUTCMonth(d.getUTCMonth() - 1);
    if (!done(ymd(d).slice(0, 7))) break;
    streak++;
  }
  return streak;
}

// ───────── Credit items in My plan ─────────
export function creditPlanItems(i: { reportChecks: Array<{ bureau: Bureau; date: string }>; disputes: Dispute[]; debts: Debt[]; now: Date }): PlanItem[] {
  const today = ymd(i.now);
  const out: PlanItem[] = [];
  const reports = reportCheckStatus(i.reportChecks, today);
  if (i.reportChecks.length && reports.some((r) => r.canCheck)) out.push({ kind: "credit", date: today, title: "Free credit report check", detail: "Check your free weekly reports", detailCode: "report_check", href: "/credit-tools", urgent: false });
  for (const d of disputeStatus(i.disputes, today)) {
    if (d.resolved || d.daysLeft > 7) continue;
    out.push({ kind: "credit", date: d.responseDue, title: `Dispute: ${d.item}`, detail: d.late ? "Response is late — follow up" : "Bureau response due", detailCode: "dispute_due", n: d.daysLeft, href: "/credit-tools", urgent: d.late });
  }
  for (const debt of i.debts) {
    if (debt.balanceCents <= 0) continue;
    const st = statementTiming(debt, today);
    if (st && st.daysLeft <= 7) out.push({ kind: "credit", date: st.payBy < today ? today : st.payBy, title: `${debt.name}: pay before statement closes ${st.closes}`, detail: "A lower reported balance can help your score", detailCode: "pay_before_close", n: st.daysLeft, href: "/debts", urgent: false });
    const pr = promoPlan(debt, today);
    if (pr && !pr.ended && daysBetween(today, pr.promoEnds) <= 60) out.push({ kind: "credit", date: pr.promoEnds, title: `${debt.name}: promo rate ends`, detail: `${usd(debt.balanceCents)} left`, detailCode: "promo_end", n: debt.balanceCents, href: "/debts", urgent: daysBetween(today, pr.promoEnds) <= 30 });
  }
  return out;
}
