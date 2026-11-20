/**
 * v0.20: local allowed rent increases and statewide caps (with official sources and dates),
 * security-deposit interest you may be owed, side-income and mileage tracking with a tax
 * set-aside, quarterly estimated-tax dates, yearly expenses saved for monthly, due-date
 * suggestions, "what if I paid more" for debts, saving streaks and goal milestones, bill
 * amount changes from a bank statement, and a year-in-review summary.
 * General information, not tax, legal or financial advice.
 */
import type { Bill } from "./bills";
import type { BankTxn, Debt, PaySetup, SavingsGoal } from "./money";
import { payoffPlan, paydays } from "./money";
import type { PlanItem, RentPayment, RentSetup } from "./renterTools";
import { dueDateFor, paymentTiming } from "./renterTools";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Local allowed increases & statewide caps (checked 2026-11-20) ─────────
export const RENT_FIGURES_CHECKED_ON = "2026-11-20";

export interface LocalIncrease {
  officeId: string;
  city: string;
  pct: number;
  from: string;
  to: string;
  url: string;
  note: string;
}

/** Only for units covered by the city's rent law. Other homes may fall under the statewide cap instead. */
export const LOCAL_INCREASES: LocalIncrease[] = [
  { officeId: "sf_rent_board", city: "San Francisco", pct: 1.6, from: "2026-03-01", to: "2027-02-28", url: "https://www.sf.gov/learn-about-rent-increases-san-francisco", note: "Once every 12 months; landlord needs a rent increase license." },
  { officeId: "oakland_rap", city: "Oakland", pct: 2.3, from: "2026-08-01", to: "2027-07-31", url: "https://www.oaklandca.gov/Community/Housing-Programs-Support/Rent-Adjustment-Program-RAP", note: "The 0.8% figure applied from Aug 1, 2025 to Jul 31, 2026." },
  { officeId: "berkeley_rent_board", city: "Berkeley", pct: 1.0, from: "2026-01-01", to: "2026-12-31", url: "https://rentboard.berkeleyca.gov/rights-responsibilities/rent-levels/annual-general-adjustment", note: "Berkeley sets a new figure each October for the next calendar year — check for 2027." },
  { officeId: "la_city_rso", city: "Los Angeles (RSO)", pct: 3.0, from: "2026-07-01", to: "2027-06-30", url: "https://housing.lacity.gov/renter-protections-2", note: "Since Feb 2, 2026 no extra percentage may be added for utilities." },
];

/** Statewide Tenant Protection Act caps published by the Attorney General for increases starting Aug 1, 2026 – Jul 31, 2027. */
export const STATE_CAPS_2026_27: Array<{ region: string; pct: number }> = [
  { region: "San Francisco area", pct: 8.8 },
  { region: "Los Angeles area", pct: 8.7 },
  { region: "San Diego area", pct: 8.2 },
  { region: "Riverside area", pct: 8.1 },
];
export const STATE_CAPS_SOURCE = "https://oag.ca.gov/rentcaps";

export function localIncreaseFor(officeId: string, onDate: string): LocalIncrease | null {
  return LOCAL_INCREASES.find((x) => x.officeId === officeId && onDate >= x.from && onDate <= x.to) ?? LOCAL_INCREASES.find((x) => x.officeId === officeId) ?? null;
}

export function localIncreaseCheck(i: { currentRentCents: number; newRentCents: number; allowedPct: number }) {
  const pct = Math.round(((i.newRentCents - i.currentRentCents) / i.currentRentCents) * 10_000) / 100;
  const maxRent = Math.floor(i.currentRentCents * (1 + i.allowedPct / 100));
  return { increasePct: pct, allowedPct: i.allowedPct, maxNewRentCents: maxRent, overByCents: Math.max(0, i.newRentCents - maxRent), over: i.newRentCents > maxRent };
}

// ───────── Security-deposit interest (local rules) ─────────
export const DEPOSIT_INTEREST: Array<{ id: string; city: string; ratePct: number; period: string; url: string; how: string }> = [
  { id: "sf", city: "San Francisco", ratePct: 4.2, period: "Mar 1, 2026 – Feb 28, 2027", url: "https://www.sf.gov/reports--current-rates-including-rent-increase-relocation-sec-deposit", how: "Landlords of covered units owe yearly interest on deposits. Ask the Rent Board how it applies to you." },
  { id: "berkeley", city: "Berkeley", ratePct: 0.9, period: "2025 (paid by end of December 2025)", url: "https://rentboard.berkeleyca.gov", how: "Paid each December or deducted from January rent. The Rent Board has a calculator." },
];

/** Simple yearly interest estimate. Local rules decide exact periods and rounding. */
export function depositInterestEstimate(depositCents: number, ratePct: number, months = 12): number {
  return Math.round((depositCents * (ratePct / 100) * months) / 12);
}

// ───────── Side income, tax set-aside, mileage ─────────
export interface SideIncome {
  id: string;
  date: string;
  source: string;
  amountCents: number;
  /** Hours worked for this payout, if logged. */
  hours?: number;
}
export interface MileageEntry {
  id: string;
  date: string;
  miles: number;
  purpose: string;
}

/** IRS business standard mileage rates (cents per mile). 2026 changed on July 1. */
export const IRS_MILEAGE_RATES: Array<{ from: string; to: string; cents: number; source: string }> = [
  { from: "2025-01-01", to: "2025-12-31", cents: 70, source: "IR-2024-312" },
  { from: "2026-01-01", to: "2026-06-30", cents: 72.5, source: "IR-2025-128" },
  { from: "2026-07-01", to: "2026-12-31", cents: 76, source: "IR-2026-29" },
];
export function mileageRateFor(date: string): number | null {
  return IRS_MILEAGE_RATES.find((r) => date >= r.from && date <= r.to)?.cents ?? null;
}

export function sideIncomeSummary(income: SideIncome[], miles: MileageEntry[], setAsidePct: number, now: Date) {
  const y = String(now.getUTCFullYear());
  const month = ymd(now).slice(0, 7);
  const thisYear = income.filter((x) => x.date.startsWith(y));
  const earnedYear = thisYear.reduce((s, x) => s + x.amountCents, 0);
  const earnedMonth = income.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.amountCents, 0);
  const milesYear = miles.filter((m) => m.date.startsWith(y));
  const mileageDeductionCents = Math.round(milesYear.reduce((s, m) => s + m.miles * (mileageRateFor(m.date) ?? 0), 0));
  const bySource = new Map<string, number>();
  for (const x of thisYear) bySource.set(x.source, (bySource.get(x.source) ?? 0) + x.amountCents);
  const pct = Math.max(0, Math.min(50, setAsidePct));
  return {
    earnedYearCents: earnedYear,
    earnedMonthCents: earnedMonth,
    milesYear: Math.round(milesYear.reduce((s, m) => s + m.miles, 0) * 10) / 10,
    mileageDeductionCents,
    setAsideYearCents: Math.round((Math.max(0, earnedYear - mileageDeductionCents) * pct) / 100),
    bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([source, cents]) => ({ source, cents })),
  };
}

/** Federal estimated-tax due dates (Form 1040-ES). A date on a weekend or holiday moves to the next business day. */
export function estimatedTaxDates(year: number): Array<{ quarter: number; due: string; covers: string }> {
  return [
    { quarter: 1, due: `${year}-04-15`, covers: `Jan 1 – Mar 31, ${year}` },
    { quarter: 2, due: `${year}-06-15`, covers: `Apr 1 – May 31, ${year}` },
    { quarter: 3, due: `${year}-09-15`, covers: `Jun 1 – Aug 31, ${year}` },
    { quarter: 4, due: `${year + 1}-01-15`, covers: `Sep 1 – Dec 31, ${year}` },
  ];
}

export function taxPlanItems(now: Date, hasSideIncome: boolean, horizonDays = 45): PlanItem[] {
  if (!hasSideIncome) return [];
  const today = ymd(now);
  const end = ymd(new Date(noon(today).getTime() + horizonDays * DAY));
  return [...estimatedTaxDates(now.getUTCFullYear() - 1), ...estimatedTaxDates(now.getUTCFullYear())]
    .filter((d) => d.due >= today && d.due <= end)
    .map((d) => ({ kind: "tax_due" as const, date: d.due, title: `Estimated tax (Q${d.quarter})`, detail: d.covers, detailCode: "tax_quarter" as const, n: d.quarter, href: "/side-income", urgent: false }));
}

// ───────── Yearly / irregular expenses ─────────
export interface YearlyExpense {
  id: string;
  name: string;
  amountCents: number;
  /** Next due date (YYYY-MM-DD). */
  nextDue: string;
  savedCents: number;
}

export function yearlyPlan(items: YearlyExpense[], now: Date) {
  const today = ymd(now);
  const rows = items.map((e) => {
    const months = Math.max(1, Math.ceil((noon(e.nextDue).getTime() - noon(today).getTime()) / DAY / 30.44));
    const left = Math.max(0, e.amountCents - e.savedCents);
    return { ...e, monthsLeft: months, perMonthCents: Math.ceil(left / months), ready: left === 0, overdue: e.nextDue < today && left > 0 };
  });
  return { rows: rows.sort((a, b) => a.nextDue.localeCompare(b.nextDue)), monthlyTotalCents: rows.reduce((s, r) => s + r.perMonthCents, 0) };
}

export function yearlyPlanItems(items: YearlyExpense[], now: Date, horizonDays = 45): PlanItem[] {
  const today = ymd(now);
  const end = ymd(new Date(noon(today).getTime() + horizonDays * DAY));
  return items
    .filter((e) => e.nextDue >= today && e.nextDue <= end)
    .map((e) => ({ kind: "yearly_due" as const, date: e.nextDue, title: `${e.name} · ${usd(e.amountCents)}`, detail: e.savedCents >= e.amountCents ? "Saved — ready to pay" : `${usd(e.amountCents - e.savedCents)} still to save`, detailCode: "yearly" as const, n: Math.max(0, e.amountCents - e.savedCents), href: "/yearly", urgent: e.savedCents < e.amountCents }));
}

// ───────── Due-date suggestions ─────────
/** Bills due 1–4 days before a payday are hard to cover; suggest asking for a due date 2 days after payday. */
export function dueDateSuggestions(bills: Bill[], pay: PaySetup | null, now: Date) {
  if (!pay) return [];
  const pays = paydays(pay, ymd(now), 62);
  const out: Array<{ billId: string; name: string; currentDay: number; suggestedDay: number; reason: string }> = [];
  for (const b of bills) {
    if (b.autopay) continue;
    const due = dueDateFor(ymd(now).slice(0, 7), b.dueDay);
    const nextPay = pays.find((p) => p >= due);
    if (!nextPay) continue;
    const gap = Math.round((noon(nextPay).getTime() - noon(due).getTime()) / DAY);
    if (gap >= 1 && gap <= 4) {
      const suggested = Math.min(28, Number(nextPay.slice(8, 10)) + 2);
      if (suggested !== b.dueDay) out.push({ billId: b.id, name: b.name, currentDay: b.dueDay, suggestedDay: suggested, reason: `Due ${gap} day${gap === 1 ? "" : "s"} before payday` });
    }
  }
  return out;
}

// ───────── What if I paid more? ─────────
export function extraPaymentImpact(debts: Debt[], extraCents: number) {
  const base = payoffPlan(debts, 0, "avalanche");
  const more = payoffPlan(debts, extraCents, "avalanche");
  return {
    baseMonths: base.months,
    newMonths: more.months,
    monthsSaved: base.feasible && more.feasible ? base.months - more.months : null,
    interestSavedCents: base.feasible && more.feasible ? base.totalInterestCents - more.totalInterestCents : null,
    becomesFeasible: !base.feasible && more.feasible,
  };
}

// ───────── Saving streaks & milestones ─────────
export interface Contribution {
  goalId: string;
  date: string;
  amountCents: number;
}

/** Consecutive weeks (Mon–Sun), ending this week or last week, with at least one contribution. */
export function savingStreakWeeks(contribs: Contribution[], now: Date): number {
  const weekStart = (s: string) => {
    const d = noon(s);
    const dow = (d.getUTCDay() + 6) % 7;
    return ymd(new Date(d.getTime() - dow * DAY));
  };
  const weeks = new Set(contribs.filter((c) => c.amountCents > 0).map((c) => weekStart(c.date)));
  let cur = weekStart(ymd(now));
  if (!weeks.has(cur)) cur = ymd(new Date(noon(cur).getTime() - 7 * DAY));
  let n = 0;
  while (weeks.has(cur)) {
    n++;
    cur = ymd(new Date(noon(cur).getTime() - 7 * DAY));
  }
  return n;
}

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
/** Milestones newly crossed by adding `addCents`. */
export function crossedMilestones(g: SavingsGoal, addCents: number): number[] {
  if (!g.targetCents) return [];
  const before = (g.savedCents / g.targetCents) * 100;
  const after = (Math.min(g.targetCents, g.savedCents + addCents) / g.targetCents) * 100;
  return GOAL_MILESTONES.filter((m) => before < m && after >= m);
}

// ───────── Bill amount changes from a bank statement ─────────
export function billChanges(txns: BankTxn[], bills: Bill[]) {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const out: Array<{ billId: string; name: string; trackedCents: number; latestCents: number; date: string; changePct: number }> = [];
  for (const b of bills) {
    const bw = words(b.name);
    const bc = compact(b.name);
    if (!bw.length && bc.length < 3) continue;
    const hits = txns.filter((t) => t.amountCents < 0 && (bw.some((w) => words(t.description).includes(w)) || (bc.length >= 3 && compact(t.description).startsWith(bc)))).sort((a, b2) => b2.date.localeCompare(a.date));
    const latest = hits[0];
    if (!latest) continue;
    const amt = -latest.amountCents;
    const pct = Math.round(((amt - b.amountCents) / b.amountCents) * 100);
    if (Math.abs(pct) >= 10) out.push({ billId: b.id, name: b.name, trackedCents: b.amountCents, latestCents: amt, date: latest.date, changePct: pct });
  }
  return out;
}

// ───────── Year in review ─────────
export function yearInReview(i: { year: number; rent: RentSetup | null; payments: RentPayment[]; billPaid: Record<string, string[]>; bills: Bill[]; side: SideIncome[]; contribs: Contribution[]; expenses?: Array<{ date: string; amountCents: number }>; wins?: Array<{ date: string; result: string; monthlySavingsCents: number; oneTimeCents: number }> }) {
  const y = String(i.year);
  const pays = i.payments.filter((p) => p.paidOn.startsWith(y));
  const rentPaid = pays.reduce((s, p) => s + p.amountCents, 0);
  const onTime = i.rent ? new Set(pays.filter((p) => paymentTiming(p, i.rent!) === "on_time").map((p) => p.month)).size : 0;
  const months = new Set(pays.map((p) => p.month)).size;
  const lateFees = pays.reduce((s, p) => s + (p.lateFeeCents ?? 0), 0);
  const billsChecked = Object.values(i.billPaid).reduce((s, ms) => s + ms.filter((m) => m.startsWith(y)).length, 0);
  const side = i.side.filter((x) => x.date.startsWith(y)).reduce((s, x) => s + x.amountCents, 0);
  const saved = i.contribs.filter((c) => c.date.startsWith(y)).reduce((s, c) => s + c.amountCents, 0);
  const expenses = (i.expenses ?? []).filter((x) => x.date.startsWith(y)).reduce((s, x) => s + x.amountCents, 0);
  const won = (i.wins ?? []).filter((w) => w.date.startsWith(y) && (w.result === "lower" || w.result === "credit"));
  const winsCents = won.reduce((s, w) => s + w.oneTimeCents + w.monthlySavingsCents * Math.max(1, 13 - Number(w.date.slice(5, 7))), 0);
  const text = [
    `MY ${y} IN MONEY — Housing Compass`,
    "",
    `Rent paid: ${usd(rentPaid)} over ${months} month${months === 1 ? "" : "s"} (${onTime} on time)`,
    `Late fees: ${usd(lateFees)}`,
    `Bills checked off: ${billsChecked}`,
    `Side income: ${usd(side)}`,
    `Added to savings goals: ${usd(saved)}`,
    ...(expenses ? [`Side-work expenses: ${usd(expenses)}`] : []),
    ...(won.length ? [`Saved by asking for lower bills: ${usd(winsCents)} (${won.length} win${won.length === 1 ? "" : "s"})`] : []),
    "",
    "From my own records on my phone.",
  ].join("\n");
  return { rentPaidCents: rentPaid, months, onTimeMonths: onTime, lateFeesCents: lateFees, billsChecked, sideIncomeCents: side, savedCents: saved, sideExpensesCents: expenses, winsCents, wins: won.length, text };
}
