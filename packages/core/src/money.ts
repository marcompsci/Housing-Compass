/**
 * Money tools: paychecks and what each one has to cover, a 30-day cash-flow forecast, a
 * bank-statement CSV import that matches payments to rent and bills, debt payoff plans,
 * credit utilization, savings goals, roommate splits, official "found money" programs, and
 * a validated backup format. Pure and offline. General information, not financial advice.
 */
import { z } from "zod";
import type { Bill } from "./bills";
import { dueDateFor, type RentPayment, type RentSetup } from "./renterTools";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Paychecks ─────────
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export interface PaySetup {
  frequency: PayFrequency;
  /** Take-home amount of one paycheck. */
  amountCents: number;
  /** A real payday (YYYY-MM-DD) to count from. For semimonthly, paydays are the 1st and 15th. */
  anchorDate: string;
}

export function validatePaySetup(p: PaySetup): string | null {
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0 || p.amountCents > 5_000_000) return "Enter your take-home pay per paycheck.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.anchorDate) || Number.isNaN(Date.parse(p.anchorDate))) return "Enter a recent or next payday (YYYY-MM-DD).";
  return null;
}

/** Paydays from `from` (inclusive) through `days` days later. */
export function paydays(p: PaySetup, from: string, days: number): string[] {
  const end = addDays(from, days);
  const out: string[] = [];
  if (p.frequency === "weekly" || p.frequency === "biweekly") {
    const step = p.frequency === "weekly" ? 7 : 14;
    let d = p.anchorDate;
    const diff = daysBetween(d, from);
    d = addDays(d, Math.ceil(diff / step) * step);
    for (; d <= end; d = addDays(d, step)) if (d >= from) out.push(d);
  } else {
    const anchorDay = Number(p.anchorDate.slice(8, 10));
    const [y, m] = from.split("-").map(Number) as [number, number];
    for (let k = 0; k < Math.ceil(days / 28) + 2; k++) {
      const month = ymd(new Date(Date.UTC(y, m - 1 + k, 1))).slice(0, 7);
      const days2 = p.frequency === "semimonthly" ? [1, 15] : [anchorDay];
      for (const dd of days2) {
        const d = dueDateFor(month, dd);
        if (d >= from && d <= end) out.push(d);
      }
    }
    out.sort();
  }
  return out;
}

export function monthlyIncomeCents(p: PaySetup): number {
  const perYear = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[p.frequency];
  return Math.round((p.amountCents * perYear) / 12);
}

export interface Obligation {
  id: string;
  name: string;
  amountCents: number;
  dueDate: string;
  kind: "rent" | "bill" | "goal";
}

/** Upcoming rent and unpaid bills in the window, each with its due date. */
export function upcomingObligations(i: { rent: RentSetup | null; rentPayments: RentPayment[]; bills: Bill[]; billPaid: Record<string, string[]>; from: string; days: number }): Obligation[] {
  const out: Obligation[] = [];
  const end = addDays(i.from, i.days);
  const [y, m] = i.from.split("-").map(Number) as [number, number];
  for (let k = 0; k < Math.ceil(i.days / 28) + 1; k++) {
    const month = ymd(new Date(Date.UTC(y, m - 1 + k, 1))).slice(0, 7);
    if (i.rent) {
      const due = dueDateFor(month, i.rent.dueDay);
      const paid = i.rentPayments.filter((p) => p.month === month).reduce((s, p) => s + p.amountCents, 0);
      if (due >= i.from && due <= end && paid < i.rent.amountCents) out.push({ id: `rent:${month}`, name: "Rent", amountCents: i.rent.amountCents - paid, dueDate: due, kind: "rent" });
    }
    for (const b of i.bills) {
      const due = dueDateFor(month, b.dueDay);
      if (due >= i.from && due <= end && !(i.billPaid[b.id] ?? []).includes(month)) out.push({ id: `bill:${b.id}:${month}`, name: b.name, amountCents: b.amountCents, dueDate: due, kind: "bill" });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface PaycheckBucket {
  payday: string;
  incomeCents: number;
  covers: Obligation[];
  setAsideCents: number;
  leftCents: number;
}

/**
 * Assign each obligation to the latest payday on or before its due date (or the first payday,
 * if it's due before any paycheck arrives). Shows how much of each check to set aside.
 */
export function paycheckPlan(p: PaySetup, obligations: Obligation[], from: string, days = 45): { buckets: PaycheckBucket[]; dueBeforeFirstPay: Obligation[] } {
  const pays = paydays(p, from, days);
  const buckets: PaycheckBucket[] = pays.map((d) => ({ payday: d, incomeCents: p.amountCents, covers: [], setAsideCents: 0, leftCents: p.amountCents }));
  const dueBeforeFirstPay: Obligation[] = [];
  for (const o of obligations) {
    const idx = pays.filter((d) => d <= o.dueDate).length - 1;
    if (idx < 0) {
      dueBeforeFirstPay.push(o);
      continue;
    }
    const b = buckets[idx]!;
    b.covers.push(o);
    b.setAsideCents += o.amountCents;
    b.leftCents -= o.amountCents;
  }
  return { buckets, dueBeforeFirstPay };
}

// ───────── 30-day cash-flow forecast ─────────
export interface ForecastDay {
  date: string;
  inCents: number;
  outCents: number;
  balanceCents: number;
}

export function cashFlowForecast(startBalanceCents: number, p: PaySetup | null, obligations: Obligation[], from: string, days = 30) {
  const pays = new Set(p ? paydays(p, from, days) : []);
  const series: ForecastDay[] = [];
  let bal = startBalanceCents;
  for (let k = 0; k <= days; k++) {
    const date = addDays(from, k);
    const inCents = pays.has(date) && p ? p.amountCents : 0;
    const outCents = obligations.filter((o) => o.dueDate === date).reduce((s, o) => s + o.amountCents, 0);
    bal += inCents - outCents;
    series.push({ date, inCents, outCents, balanceCents: bal });
  }
  const low = series.reduce((m, d) => (d.balanceCents < m.balanceCents ? d : m), series[0]!);
  return { series, lowest: low, goesNegative: low.balanceCents < 0, endBalanceCents: bal };
}

// ───────── Bank statement CSV import ─────────
export interface BankTxn {
  date: string;
  description: string;
  /** Money out is negative. */
  amountCents: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDate(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${y}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  return null;
}

function parseMoney(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  const n = Number(t.replace(/[()$,\s-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

/**
 * Reads a bank's CSV export: finds the date, description and amount columns from the header
 * (or Debit/Credit columns). Nothing leaves the device. Rows that can't be read are skipped.
 */
export function parseBankCsv(text: string, maxRows = 2000): { txns: BankTxn[]; skipped: number; error: string | null } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { txns: [], skipped: 0, error: "Paste the whole CSV, including the header row." };
  const head = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const di = find("date", "posted");
  const desc = find("description", "payee", "merchant", "name", "memo", "details");
  const amt = find("amount");
  const debit = find("debit", "withdrawal");
  const credit = find("credit", "deposit");
  if (di < 0 || desc < 0 || (amt < 0 && debit < 0)) return { txns: [], skipped: 0, error: "Couldn't find Date, Description and Amount columns." };
  const txns: BankTxn[] = [];
  let skipped = 0;
  for (const line of lines.slice(1, maxRows + 1)) {
    const cells = splitCsvLine(line);
    const date = parseDate(cells[di] ?? "");
    let amountCents: number | null = null;
    if (amt >= 0) amountCents = parseMoney(cells[amt] ?? "");
    else {
      const d = parseMoney(cells[debit] ?? "");
      const c = credit >= 0 ? parseMoney(cells[credit] ?? "") : null;
      amountCents = d ? -Math.abs(d) : c ? Math.abs(c) : null;
    }
    const description = (cells[desc] ?? "").slice(0, 120);
    if (!date || amountCents === null || !description) {
      skipped++;
      continue;
    }
    txns.push({ date, description, amountCents });
  }
  return { txns, skipped, error: txns.length ? null : "No rows could be read." };
}

export interface TxnMatch {
  txn: BankTxn;
  target: { kind: "rent"; month: string } | { kind: "bill"; billId: string; month: string };
  label: string;
  confidence: "high" | "medium";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Suggests which money-out rows are rent or bill payments: amount within $1 (or 2%) of the
 * expected amount, within 10 days of the due date, and — for "high" — a name match.
 * Already-recorded months are skipped. The user confirms every match.
 */
export function matchTransactions(txns: BankTxn[], i: { rent: RentSetup | null; rentPayments: RentPayment[]; bills: Bill[]; billPaid: Record<string, string[]> }): TxnMatch[] {
  const out: TxnMatch[] = [];
  const used = new Set<string>();
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(100, Math.round(b * 0.02));
  for (const t of txns.filter((x) => x.amountCents < 0).sort((a, b) => a.date.localeCompare(b.date))) {
    const amount = -t.amountCents;
    const month = t.date.slice(0, 7);
    const nextMonth = ymd(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))).slice(0, 7);
    const d = norm(t.description);
    if (i.rent && close(amount, i.rent.amountCents)) {
      for (const m of [month, nextMonth]) {
        const key = `rent:${m}`;
        if (used.has(key) || i.rentPayments.some((p) => p.month === m)) continue;
        if (Math.abs(daysBetween(dueDateFor(m, i.rent.dueDay), t.date)) > 10) continue;
        const named = !!i.rent.payee && norm(i.rent.payee).split(" ").some((w) => w.length > 2 && d.includes(w));
        out.push({ txn: t, target: { kind: "rent", month: m }, label: `Rent · ${m}`, confidence: named || /\brent\b/.test(d) ? "high" : "medium" });
        used.add(key);
        break;
      }
      if (out[out.length - 1]?.txn === t) continue;
    }
    for (const b of i.bills) {
      if (!close(amount, b.amountCents)) continue;
      const m = [month, nextMonth].find((mm) => !used.has(`bill:${b.id}:${mm}`) && !(i.billPaid[b.id] ?? []).includes(mm) && Math.abs(daysBetween(dueDateFor(mm, b.dueDay), t.date)) <= 10);
      if (!m) continue;
      const named = norm(b.name).split(" ").some((w) => w.length > 2 && d.includes(w));
      out.push({ txn: t, target: { kind: "bill", billId: b.id, month: m }, label: `${b.name} · ${m}`, confidence: named ? "high" : "medium" });
      used.add(`bill:${b.id}:${m}`);
      break;
    }
  }
  return out;
}

// ───────── Debt payoff ─────────
export interface Debt {
  id: string;
  name: string;
  balanceCents: number;
  /** Annual percentage rate, e.g. 24.99 */
  apr: number;
  minPaymentCents: number;
  /** Day of the month the card's statement closes (1–31), if the user knows it. */
  statementDay?: number;
  /** Promotional (e.g. 0%) rate end date, YYYY-MM-DD. */
  promoEnds?: string;
  /** Balance when the user first added the debt, to show progress. */
  startBalanceCents?: number;
  /** Credit limit for a card, if the user enters it. */
  limitCents?: number;
}

export interface PayoffResult {
  months: number;
  totalInterestCents: number;
  order: string[];
  payoffMonthById: Record<string, number>;
  /** False when payments never cover the interest (or it takes more than 50 years). */
  feasible: boolean;
}

export function payoffPlan(debts: Debt[], extraMonthlyCents: number, strategy: "avalanche" | "snowball"): PayoffResult {
  const ds = debts.filter((d) => d.balanceCents > 0).map((d) => ({ ...d, bal: d.balanceCents }));
  const order = [...ds].sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr || a.bal - b.bal : a.bal - b.bal || b.apr - a.apr)).map((d) => d.id);
  const payoffMonthById: Record<string, number> = {};
  let interest = 0;
  let month = 0;
  const budget = ds.reduce((s, d) => s + d.minPaymentCents, 0) + Math.max(0, extraMonthlyCents);
  while (ds.some((d) => d.bal > 0) && month < 600) {
    month++;
    for (const d of ds) {
      if (d.bal <= 0) continue;
      const i = Math.round((d.bal * d.apr) / 100 / 12);
      d.bal += i;
      interest += i;
    }
    let left = budget;
    for (const d of ds) {
      if (d.bal <= 0) continue;
      const pay = Math.min(d.bal, d.minPaymentCents, left);
      d.bal -= pay;
      left -= pay;
    }
    for (const id of order) {
      const d = ds.find((x) => x.id === id)!;
      if (d.bal <= 0 || left <= 0) continue;
      const pay = Math.min(d.bal, left);
      d.bal -= pay;
      left -= pay;
    }
    for (const d of ds) if (d.bal <= 0 && payoffMonthById[d.id] === undefined) payoffMonthById[d.id] = month;
  }
  const feasible = !ds.some((d) => d.bal > 0);
  return { months: feasible ? month : Infinity, totalInterestCents: interest, order, payoffMonthById, feasible };
}

// ───────── Credit utilization ─────────
export interface CardUse {
  name: string;
  balanceCents: number;
  limitCents: number;
}

export function utilization(cards: CardUse[]) {
  const per = cards.filter((c) => c.limitCents > 0).map((c) => ({ ...c, ratio: c.balanceCents / c.limitCents }));
  const bal = per.reduce((s, c) => s + c.balanceCents, 0);
  const lim = per.reduce((s, c) => s + c.limitCents, 0);
  const overall = lim ? bal / lim : null;
  const band: "excellent" | "good" | "high" | "very_high" | null = overall === null ? null : overall < 0.1 ? "excellent" : overall < 0.3 ? "good" : overall < 0.5 ? "high" : "very_high";
  return {
    overall,
    band,
    perCard: per,
    /** Paying down to these balances gets overall use under 30% / 10%. */
    payDownTo30Cents: Math.max(0, bal - Math.floor(lim * 0.3)),
    payDownTo10Cents: Math.max(0, bal - Math.floor(lim * 0.1)),
  };
}

export const CREDIT_CHECKLIST = ["reports", "rent_reporting", "autopay_min", "utilization", "no_new_hard_pulls", "dispute_errors"] as const;
export type CreditStep = (typeof CREDIT_CHECKLIST)[number];

// ───────── Savings goals ─────────
export interface SavingsGoal {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  targetDate: string | null;
}

export function goalPlan(g: SavingsGoal, now: Date, pay: PaySetup | null) {
  const remaining = Math.max(0, g.targetCents - g.savedCents);
  const progress = g.targetCents ? Math.min(1, g.savedCents / g.targetCents) : 0;
  if (!g.targetDate || remaining === 0) return { remainingCents: remaining, progress, perMonthCents: null, perPaycheckCents: null, months: null, overdue: false };
  const today = ymd(now);
  const days = daysBetween(today, g.targetDate);
  const months = Math.max(1, Math.ceil(days / 30.44));
  const checks = pay ? Math.max(1, paydays(pay, today, Math.max(0, days)).length) : null;
  return { remainingCents: remaining, progress, perMonthCents: Math.ceil(remaining / months), perPaycheckCents: checks ? Math.ceil(remaining / checks) : null, months, overdue: days < 0 };
}

// ───────── Subscriptions & late fees ─────────
export function subscriptionSavings(bills: Bill[], unused: string[]) {
  const subs = bills.filter((b) => b.category === "subscription");
  const cut = subs.filter((b) => unused.includes(b.id));
  const monthly = cut.reduce((s, b) => s + b.amountCents, 0);
  return { subscriptions: subs.length, monthlyAllCents: subs.reduce((s, b) => s + b.amountCents, 0), cutMonthlyCents: monthly, cutYearlyCents: monthly * 12 };
}

export function lateFeesThisYear(fees: Array<{ date: string; amountCents: number }>, now: Date) {
  const y = String(now.getUTCFullYear());
  const these = fees.filter((f) => f.date.startsWith(y));
  return { count: these.length, totalCents: these.reduce((s, f) => s + f.amountCents, 0) };
}

// ───────── Roommate split ─────────
/** Splits a total by shares (equal when all 1). Remainder cents go to the first people so the sum is exact. */
export function splitByShares(totalCents: number, shares: number[]): number[] {
  const valid = shares.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const sum = valid.reduce((a, b) => a + b, 0);
  if (!sum) return shares.map(() => 0);
  const raw = valid.map((s) => Math.floor((totalCents * s) / sum));
  let rest = totalCents - raw.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % raw.length) {
    if (valid[i]! > 0) {
      raw[i]! += 1;
      rest--;
    }
  }
  return raw;
}

// ───────── "Found money": official programs (checked 2026-11-19) ─────────
export const FOUND_MONEY_CHECKED_ON = "2026-11-19";
export interface MoneyProgram {
  id: string;
  name: string;
  what: string;
  who: string;
  url: string;
  phone: string | null;
  kind: "cash" | "discount" | "free";
}

export const FOUND_MONEY: MoneyProgram[] = [
  { id: "unclaimed", name: "Unclaimed property (State Controller)", what: "Search for money held in your name — old bank accounts, uncashed checks, deposits, insurance.", who: "Anyone. Searching and claiming is free; you never need to pay a finder.", url: "https://www.claimit.ca.gov", phone: "(800) 992-4647", kind: "cash" },
  { id: "caleitc", name: "CalEITC and Young Child Tax Credit", what: "Cash-back tax credits for working Californians with lower incomes. You must file a state return to get them.", who: "Working people with lower earnings; more with a child under 6.", url: "https://www.ftb.ca.gov/caleitc", phone: null, kind: "cash" },
  { id: "vita", name: "Free tax help (VITA)", what: "Free tax preparation by IRS-certified volunteers, so you don't pay a preparer and don't miss credits.", who: "People with lower and moderate incomes.", url: "https://www.ftb.ca.gov/vita", phone: null, kind: "free" },
  { id: "calfresh", name: "CalFresh food benefits", what: "Monthly money for groceries on an EBT card. Rent and utility costs are counted when you apply.", who: "Households with lower incomes, including many working people and students.", url: "https://benefitscal.com", phone: "1-877-847-3663", kind: "cash" },
  { id: "care", name: "CARE / FERA energy discounts", what: "CARE: 30–35% off electric and 20% off gas bills. FERA: 18% off electric if your income is a bit above CARE.", who: "Income-qualified customers of PG&E, SCE, SDG&E and other CPUC-regulated utilities.", url: "https://www.cpuc.ca.gov/care", phone: null, kind: "discount" },
  { id: "lifeline", name: "California LifeLine", what: "Monthly discount on one home or cell phone line.", who: "Households under the income limit or enrolled in programs like CalFresh or Medi-Cal.", url: "https://www.californialifeline.com", phone: "1-866-272-0357", kind: "discount" },
  { id: "liheap", name: "LIHEAP energy bill help", what: "One-time help paying heating or cooling bills, including if you're facing a shutoff.", who: "Income-qualified households; apply through your local agency.", url: "https://www.csd.ca.gov/energybills", phone: null, kind: "cash" },
  { id: "credit_reports", name: "Free weekly credit reports", what: "Your reports from Equifax, Experian and TransUnion, free every week. Check for mistakes.", who: "Everyone. This is the only official free site.", url: "https://www.annualcreditreport.com", phone: "1-877-322-8228", kind: "free" },
];

// ───────── Backup & restore ─────────
const cents = z.number().int().min(0).max(100_000_000);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const shortText = (n: number) => z.string().max(n);

export const RenterBackupSchema = z.object({
  app: z.literal("housing-compass"),
  kind: z.literal("renter-backup"),
  version: z.literal(1),
  createdAt: z.string().max(40),
  data: z.object({
    rentSetup: z.object({ amountCents: cents, dueDay: z.number().int().min(1).max(31), graceDays: z.number().int().min(0).max(15), payee: shortText(80) }).nullable(),
    payments: z.array(z.object({ id: shortText(64), month: monthStr, paidOn: day, amountCents: cents, method: z.enum(["bank_transfer", "check", "money_order", "portal", "cash_with_receipt", "other"]), confirmation: shortText(60), lateFeeCents: cents.optional() })).max(600),
    bills: z.array(z.object({ id: shortText(64), name: shortText(60), amountCents: cents, dueDay: z.number().int().min(1).max(31), category: z.enum(["utilities", "phone", "internet", "insurance", "car", "credit_card", "loan", "subscription", "other"]), autopay: z.boolean(), promoEnds: day.optional() })).max(100),
    billPaid: z.record(z.string().max(64), z.array(monthStr).max(60)),
    takeHomeCents: cents.nullable(),
    waitlists: z.array(z.object({ id: shortText(64), programName: shortText(100), joinedOn: day, confirmation: shortText(60), nextCheckIn: day.nullable(), status: z.enum(["waiting", "invited", "closed"]), notes: shortText(500) })).max(50),
    pay: z.object({ frequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly"]), amountCents: cents, anchorDate: day }).nullable(),
    debts: z.array(z.object({ id: shortText(64), name: shortText(60), balanceCents: cents, apr: z.number().min(0).max(100), minPaymentCents: cents, statementDay: z.number().int().min(1).max(31).optional(), promoEnds: day.optional(), startBalanceCents: cents.optional(), limitCents: cents.optional() })).max(50),
    goals: z.array(z.object({ id: shortText(64), name: shortText(60), targetCents: cents, savedCents: cents, targetDate: day.nullable() })).max(30),
    unusedSubs: z.array(shortText(64)).max(100),
    creditDone: z.array(z.enum(CREDIT_CHECKLIST)).max(20),
    emergencyCents: cents.nullable().optional(),
    splitPct: z.object({ goals: z.number().min(0).max(100), debt: z.number().min(0).max(100) }).optional(),
    sideIncome: z.array(z.object({ id: shortText(64), date: day, source: shortText(60), amountCents: cents, hours: z.number().min(0).max(24 * 31).optional() })).max(5000).optional(),
    sideExpenses: z.array(z.object({ id: shortText(64), date: day, category: z.enum(["phone", "supplies", "fees", "other"]), amountCents: cents, note: shortText(80) })).max(5000).optional(),
    sideGoalCents: cents.nullable().optional(),
    negotiations: z.array(z.object({ id: shortText(64), date: day, company: shortText(60), ask: shortText(120), result: z.enum(["lower", "credit", "no", "pending"]), monthlySavingsCents: cents, oneTimeCents: cents })).max(500).optional(),
    reportChecks: z.array(z.object({ bureau: z.enum(["equifax", "experian", "transunion"]), date: day })).max(2000).optional(),
    inquiries: z.array(z.object({ id: shortText(64), date: day, lender: shortText(60) })).max(200).optional(),
    disputes: z.array(z.object({ id: shortText(64), bureau: z.enum(["equifax", "experian", "transunion"]), item: shortText(120), sentOn: day, resolved: z.boolean() })).max(200).optional(),
    ious: z.array(z.object({ id: shortText(64), date: day, person: shortText(40), amountCents: z.number().int().min(-100_000_000).max(100_000_000), note: shortText(80), settled: z.boolean() })).max(2000).optional(),
    hourlyCents: cents.nullable().optional(),
    weeklyLimitCents: cents.nullable().optional(),
    spends: z.array(z.object({ id: shortText(64), date: day, amountCents: cents, note: shortText(60), category: z.enum(["food", "coffee", "gas", "fun", "shopping", "other"]).optional() })).max(5000).optional(),
    billNotes: z.record(z.string().max(80), shortText(80)).optional(),
    netWorth: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), assetsCents: cents, debtsCents: cents })).max(600).optional(),
    otherAssetsCents: cents.nullable().optional(),
    challenge: z.object({ start: day, reverse: z.boolean(), unitCents: cents, done: z.array(z.number().int().min(1).max(52)).max(52) }).nullable().optional(),
    scores: z.array(z.object({ id: shortText(64), date: day, score: z.number().int().min(300).max(900), source: shortText(60) })).max(500).optional(),
    mileage: z.array(z.object({ id: shortText(64), date: day, miles: z.number().min(0).max(5000), purpose: shortText(80) })).max(5000).optional(),
    sideSetAsidePct: z.number().min(0).max(50).optional(),
    yearly: z.array(z.object({ id: shortText(64), name: shortText(60), amountCents: cents, nextDue: day, savedCents: cents })).max(100).optional(),
    contribs: z.array(z.object({ goalId: shortText(64), date: day, amountCents: cents })).max(5000).optional(),
  }),
});
export type RenterBackup = z.infer<typeof RenterBackupSchema>;

export function parseBackup(text: string): { ok: true; backup: RenterBackup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't a Housing Compass backup file." };
  }
  const r = RenterBackupSchema.safeParse(raw);
  return r.success ? { ok: true, backup: r.data } : { ok: false, error: "This backup is damaged or from an unsupported version. Nothing was changed." };
}

export function backupSummary(b: RenterBackup) {
  return `${b.data.payments.length} rent payments, ${b.data.bills.length} bills, ${b.data.debts.length} debts, ${b.data.goals.length} goals, ${b.data.waitlists.length} waitlists`;
}

export const _test = { usd, parseDate, parseMoney, splitCsvLine };
