/**
 * v0.24: habits and peace of mind — a weekly spending chart, monthly category budgets, round-up
 * savings, spending habits and what halving them saves, bill price history and yearly cost,
 * snowball vs avalanche, the monthly interest each debt costs, best-paying side gig, a payday
 * checklist, goal ETAs from your saving pace, a tip of the day and a backup reminder.
 * Device-only. General information, not financial advice.
 */
import type { Bill } from "./bills";
import type { Contribution, SideIncome } from "./earn";
import type { Debt, Obligation, SavingsGoal } from "./money";
import { payoffPlan } from "./money";
import type { PlanItem } from "./renterTools";
import { weekStart, type Spend, type SpendCategory } from "./coach";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Weekly chart ─────────
export function weeklyTotals(spends: Spend[], today: string, weeks = 8) {
  const last = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(last, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    return { weekStart: start, cents: spends.filter((s) => s.date >= start && s.date < end).reduce((t, s) => t + s.amountCents, 0) };
  });
}

// ───────── Category budgets ─────────
export type CategoryBudgets = Partial<Record<SpendCategory, number>>;
export function budgetProgress(spends: Spend[], budgets: CategoryBudgets, month: string) {
  return (Object.entries(budgets) as Array<[SpendCategory, number]>)
    .filter(([, b]) => b > 0)
    .map(([category, budgetCents]) => {
      const spent = spends.filter((s) => s.date.startsWith(month) && (s.category ?? "other") === category).reduce((t, s) => t + s.amountCents, 0);
      return { category, budgetCents, spentCents: spent, leftCents: budgetCents - spent, pct: Math.round((spent / budgetCents) * 100), over: spent > budgetCents };
    })
    .sort((a, b) => b.pct - a.pct);
}

// ───────── Round-ups ─────────
/** Rounds each logged spend up to the next whole dollar; the difference can go to savings. */
export function roundUps(spends: Spend[], movedIds: string[]) {
  const moved = new Set(movedIds);
  const pending = spends.filter((s) => !moved.has(s.id) && s.amountCents % 100 !== 0);
  const cents = pending.reduce((t, s) => t + (100 - (s.amountCents % 100)), 0);
  return { pendingCents: cents, ids: pending.map((s) => s.id), count: pending.length };
}

// ───────── Spending habits ─────────
/** Repeated spends in the last 30 days (same category and note), with a monthly cost and what halving them saves in a year. */
export function spendHabits(spends: Spend[], today: string) {
  const from = addDays(today, -29);
  const recent = spends.filter((s) => s.date >= from && s.date <= today);
  const groups = new Map<string, Spend[]>();
  for (const s of recent) {
    const key = `${s.category ?? "other"}|${s.note.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.length >= 4)
    .map(([key, g]) => {
      const [category, note] = key.split("|") as [SpendCategory, string];
      const monthly = g.reduce((t, s) => t + s.amountCents, 0);
      return { category, note, count: g.length, perWeek: Math.round((g.length / 30) * 7 * 10) / 10, monthlyCents: monthly, halfYearlyCents: Math.round((monthly / 2) * 12) };
    })
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
}

// ───────── Bills: price history and yearly cost ─────────
export type BillHistory = Record<string, Array<{ date: string; amountCents: number }>>;
/** Records the old amount when a bill's amount changes. */
export function recordBillChange(h: BillHistory, billId: string, oldCents: number, newCents: number, date: string): BillHistory {
  if (oldCents === newCents) return h;
  const list = h[billId] ?? [];
  const withOld = list.length ? list : [{ date, amountCents: oldCents }];
  return { ...h, [billId]: [...withOld, { date, amountCents: newCents }].slice(-120) };
}
export function billPriceTrend(h: BillHistory, bill: Bill) {
  const list = h[bill.id] ?? [];
  if (list.length < 2) return null;
  const first = list[0]!;
  return { firstCents: first.amountCents, firstDate: first.date, nowCents: bill.amountCents, changeCents: bill.amountCents - first.amountCents, pct: first.amountCents ? Math.round(((bill.amountCents - first.amountCents) / first.amountCents) * 100) : 0, changes: list.length - 1 };
}
export function yearlyBillCost(bills: Bill[]) {
  const rows = bills.map((b) => ({ id: b.id, name: b.name, yearlyCents: b.amountCents * 12 })).sort((a, b) => b.yearlyCents - a.yearlyCents);
  return { rows, totalCents: rows.reduce((t, r) => t + r.yearlyCents, 0) };
}

// ───────── Debts ─────────
export function strategyCompare(debts: Debt[], extraCents: number) {
  const a = payoffPlan(debts, extraCents, "avalanche");
  const s = payoffPlan(debts, extraCents, "snowball");
  const firstWin = (p: typeof a) => (p.order.length ? Math.min(...Object.values(p.payoffMonthById)) : null);
  return {
    avalanche: { months: a.months, interestCents: a.totalInterestCents, feasible: a.feasible, firstPayoffMonth: firstWin(a) },
    snowball: { months: s.months, interestCents: s.totalInterestCents, feasible: s.feasible, firstPayoffMonth: firstWin(s) },
    /** Interest avalanche saves over snowball (≥ 0 in normal cases). */
    interestDiffCents: s.totalInterestCents - a.totalInterestCents,
  };
}
export function monthlyInterest(debts: Debt[]) {
  const rows = debts.filter((d) => d.balanceCents > 0).map((d) => ({ id: d.id, name: d.name, cents: Math.round((d.balanceCents * d.apr) / 100 / 12) })).sort((a, b) => b.cents - a.cents);
  return { rows, totalCents: rows.reduce((t, r) => t + r.cents, 0) };
}

// ───────── Side income: best-paying gig ─────────
export function hourlyBySource(income: SideIncome[]) {
  const by = new Map<string, { cents: number; hours: number }>();
  for (const x of income) {
    if (!(x.hours && x.hours > 0)) continue;
    const cur = by.get(x.source) ?? { cents: 0, hours: 0 };
    by.set(x.source, { cents: cur.cents + x.amountCents, hours: cur.hours + x.hours });
  }
  return [...by.entries()].map(([source, v]) => ({ source, hours: Math.round(v.hours * 10) / 10, perHourCents: Math.round(v.cents / v.hours) })).sort((a, b) => b.perHourCents - a.perHourCents);
}

// ───────── Payday checklist ─────────
/** On payday (or the day before), what to pay before the next payday and how much that is. */
export function paydayChecklist(i: { paydays: string[]; today: string; obligations: Obligation[] }) {
  const next = i.paydays.find((d) => d >= i.today) ?? null;
  if (!next || daysBetween(i.today, next) > 1) return null;
  const following = i.paydays.find((d) => d > next) ?? addDays(next, 14);
  const due = i.obligations.filter((o) => o.dueDate >= next && o.dueDate < following).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { payday: next, until: following, items: due, totalCents: due.reduce((t, o) => t + o.amountCents, 0) };
}

// ───────── Goal ETA from saving pace ─────────
/** Average weekly saving over the last 8 weeks for a goal, and when it would be reached at that pace. */
export function goalEta(goal: SavingsGoal, contribs: Contribution[], today: string) {
  const from = addDays(today, -56);
  const recent = contribs.filter((c) => c.goalId === goal.id && c.date > from && c.date <= today);
  const perWeek = Math.round(recent.reduce((t, c) => t + c.amountCents, 0) / 8);
  const left = Math.max(0, goal.targetCents - goal.savedCents);
  if (!left) return { perWeekCents: perWeek, eta: today, weeks: 0 };
  if (!perWeek) return { perWeekCents: 0, eta: null, weeks: null };
  const weeks = Math.ceil(left / perWeek);
  return { perWeekCents: perWeek, eta: addDays(today, weeks * 7), weeks };
}

// ───────── Tip of the day ─────────
export const TIP_IDS = ["autopay_min", "due_after_payday", "ask_waive", "statement_balance", "small_cushion", "check_reports", "cancel_unused", "side_set_aside", "keep_receipts", "round_ups", "call_before_promo", "pay_yourself_first"] as const;
export type TipId = (typeof TIP_IDS)[number];
export function tipOfTheDay(today: string): TipId {
  const n = Math.floor(noon(today).getTime() / DAY);
  return TIP_IDS[((n % TIP_IDS.length) + TIP_IDS.length) % TIP_IDS.length]!;
}

// ───────── Plan items ─────────
export function habitPlanItems(i: { spends: Spend[]; budgets: CategoryBudgets; lastBackupAt: string | null; hasData: boolean; payday: ReturnType<typeof paydayChecklist>; now: Date }): PlanItem[] {
  const today = ymd(i.now);
  const out: PlanItem[] = [];
  for (const b of budgetProgress(i.spends, i.budgets, today.slice(0, 7))) {
    if (b.over) out.push({ kind: "budget", date: today, title: `Over your ${b.category} budget by ${usd(-b.leftCents)}`, detail: "", detailCode: "over_budget", n: -b.leftCents, href: "/spending", urgent: false });
  }
  if (i.hasData && (!i.lastBackupAt || daysBetween(i.lastBackupAt, today) >= 30)) out.push({ kind: "backup", date: today, title: "Back up your money data", detail: "", detailCode: "backup_due", href: "/backup", urgent: false });
  if (i.payday && i.payday.items.length) out.push({ kind: "payday", date: i.payday.payday, title: `Payday: ${i.payday.items.length} payments (${usd(i.payday.totalCents)}) due before ${i.payday.until}`, detail: "", detailCode: "payday_list", n: i.payday.totalCents, href: "/money", urgent: false });
  return out;
}
