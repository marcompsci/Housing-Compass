/**
 * Insights and helpers (v0.19): does a listing fit your budget, letters that ask for rent
 * reporting or a payment plan, scripts for lowering bills, a month calendar of paydays and
 * due dates, what a bank statement says about spending, recurring charges and income, an
 * emergency-fund meter, a simple money check, debt payoff dates and leftover splits.
 * Pure and offline. General information, not financial or legal advice.
 */
import type { Bill, BillCategory } from "./bills";
import type { BankTxn, Debt, ForecastDay, Obligation, PayFrequency, PayoffResult, SavingsGoal } from "./money";
import type { PlanItem } from "./renterTools";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

// ───────── Does this home fit? ─────────
export interface ListingFit {
  rentShare: number | null;
  leftoverCents: number | null;
  status: "fits" | "tight" | "over" | "unknown";
  /** Months to save the move-in cost from what's left each month (null when it can't be estimated). */
  monthsToMoveIn: number | null;
  moveInGapCents: number | null;
}

export function listingFit(i: { monthlyCents: number; moveInCents: number | null; takeHomeMonthlyCents: number | null; otherBillsCents: number; savedCents: number }): ListingFit {
  if (!i.takeHomeMonthlyCents || i.takeHomeMonthlyCents <= 0) return { rentShare: null, leftoverCents: null, status: "unknown", monthsToMoveIn: null, moveInGapCents: i.moveInCents === null ? null : Math.max(0, i.moveInCents - i.savedCents) };
  const leftover = i.takeHomeMonthlyCents - i.monthlyCents - i.otherBillsCents;
  const share = i.monthlyCents / i.takeHomeMonthlyCents;
  const status = leftover < 0 ? "over" : share > 0.4 || leftover < i.takeHomeMonthlyCents * 0.1 ? "tight" : "fits";
  const gap = i.moveInCents === null ? null : Math.max(0, i.moveInCents - i.savedCents);
  const monthsToMoveIn = gap === null ? null : gap === 0 ? 0 : leftover > 0 ? Math.ceil(gap / leftover) : null;
  return { rentShare: share, leftoverCents: leftover, status, monthsToMoveIn, moveInGapCents: gap };
}

// ───────── Letters ─────────
export function rentReportingRequest(i: { tenantName: string; address: string; landlord: string; today: string }): string {
  return [
    i.today,
    "",
    `To: ${i.landlord || "[Landlord or property manager]"}`,
    `Re: Positive rent reporting for ${i.address || "[Rental address]"}`,
    "",
    "I would like to have my on-time rent payments reported to a consumer credit bureau.",
    "Under California Civil Code §1954.07, landlords who are covered must offer tenants the option of having positive rental payment information reported. Please let me know how to enroll and whether there is a fee.",
    "",
    "Thank you,",
    i.tenantName || "[Your name]",
  ].join("\n");
}

export function paymentPlanRequest(i: { kind: "rent" | "utility"; tenantName: string; to: string; account: string; amountDueCents: number; payments: number; startDate: string; reason: string; today: string }): string {
  const n = Math.max(1, Math.min(12, Math.round(i.payments)));
  const each = Math.ceil(i.amountDueCents / n);
  return [
    i.today,
    "",
    `To: ${i.to || (i.kind === "rent" ? "[Landlord or property manager]" : "[Utility company]")}`,
    `Re: Payment plan request${i.account ? ` — ${i.kind === "rent" ? "unit" : "account"} ${i.account}` : ""}`,
    "",
    `I owe ${usd(i.amountDueCents)} and want to pay it in full. ${i.reason ? `${i.reason.trim().replace(/\.?$/, ".")} ` : ""}I am asking to pay it in ${n} payment${n === 1 ? "" : "s"} of about ${usd(each)}, starting ${i.startDate}, in addition to my regular ${i.kind === "rent" ? "rent" : "bill"}.`,
    i.kind === "utility" ? "Please also let me know about any assistance or discount programs I may qualify for, and confirm that service will continue while I follow this plan." : "Please confirm this plan in writing.",
    "",
    "Thank you,",
    i.tenantName || "[Your name]",
  ].join("\n");
}

// ───────── Ways to lower a bill ─────────
export const BILL_SCRIPTS: Record<BillCategory, string[]> = {
  utilities: ["Ask about the CARE or FERA discount and whether you qualify.", "Ask for a payment arrangement if you're behind — before a shutoff notice.", "Ask about budget billing to spread winter and summer costs evenly."],
  phone: ["Ask whether you qualify for California LifeLine.", "Ask for the current lower-priced plan for your usage.", "Say you're comparing carriers and ask what they can do to keep you."],
  internet: ["Ask about the provider's low-income internet plan.", "Ask for a promotional rate or a slower, cheaper speed tier.", "Return rented equipment if you own your own modem."],
  insurance: ["Ask for a quote with a higher deductible.", "Ask about discounts (bundling, safe driver, paperless, paying in full).", "Compare at least two other quotes once a year."],
  car: ["Ask the lender about changing the due date to after payday.", "If you're struggling, ask about deferment before missing a payment."],
  credit_card: ["Ask for a lower interest rate — mention your on-time history.", "Ask to waive a late fee if it was your first.", "Ask to move the due date to just after payday."],
  loan: ["Ask about hardship or income-based plans.", "Ask to move the due date to just after payday."],
  subscription: ["Cancel what you haven't used in a month.", "Switch to an ad-supported or yearly plan if it's cheaper.", "Share a family plan only where the service allows it."],
  other: ["Ask if there's a cheaper plan, a discount, or a payment arrangement.", "Ask to move the due date to just after payday."],
};

// ───────── Month calendar ─────────
export interface CalendarCell {
  date: string;
  inMonth: boolean;
  payday: boolean;
  due: Array<{ name: string; amountCents: number; kind: Obligation["kind"] }>;
}

/** Weeks (Sunday first) of a month with paydays and due dates marked. */
export function monthCalendar(month: string, paydays: string[], obligations: Obligation[]): CalendarCell[][] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const start = new Date(first.getTime() - first.getUTCDay() * DAY);
  const pays = new Set(paydays);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = ymd(new Date(start.getTime() + (w * 7 + d) * DAY));
      row.push({ date, inMonth: date.startsWith(month), payday: pays.has(date), due: obligations.filter((o) => o.dueDate === date).map((o) => ({ name: o.name, amountCents: o.amountCents, kind: o.kind })) });
    }
    if (w >= 4 && !row.some((c) => c.inMonth)) break;
    weeks.push(row);
  }
  return weeks;
}

// ───────── Spending from a bank statement ─────────
export const SPEND_BUCKETS = ["housing", "bills", "groceries", "eating_out", "transport", "shopping", "cash_transfers", "other"] as const;
export type SpendBucket = (typeof SPEND_BUCKETS)[number];
const BUCKET_WORDS: Array<[SpendBucket, RegExp]> = [
  ["housing", /\b(rent|apartment|apts?|property|management|landlord|hoa)\b/],
  ["bills", /\b(pg ?& ?e|pge|edison|sce|sdge|water|utility|utilities|comcast|xfinity|at ?& ?t|verizon|t mobile|tmobile|spectrum|insurance|geico|progressive|state farm)\b/],
  ["groceries", /\b(safeway|trader joe|whole foods|kroger|ralphs|vons|costco|grocery|market|aldi|lucky|food ?4 ?less|sprouts|smart ?& ?final)\b/],
  ["eating_out", /\b(doordash|uber eats|grubhub|mcdonald|starbucks|coffee|cafe|pizza|taco|burger|restaurant|chipotle|subway)\b/],
  ["transport", /\b(uber|lyft|bart|muni|clipper|metro|shell|chevron|arco|76|gas|parking|fastrak)\b/],
  ["shopping", /\b(amazon|target|walmart|ebay|best buy|macy|ross|marshalls|tj ?maxx)\b/],
  ["cash_transfers", /\b(atm|withdrawal|zelle|venmo|cash app|paypal|transfer)\b/],
];

export function bucketFor(description: string): SpendBucket {
  const d = description.toLowerCase().replace(/[^a-z0-9& ]+/g, " ");
  for (const [b, re] of BUCKET_WORDS) if (re.test(d)) return b;
  return "other";
}

export function spendingSummary(txns: BankTxn[]) {
  const out = txns.filter((t) => t.amountCents < 0);
  const byBucket = Object.fromEntries(SPEND_BUCKETS.map((b) => [b, 0])) as Record<SpendBucket, number>;
  for (const t of out) byBucket[bucketFor(t.description)] += -t.amountCents;
  const total = Object.values(byBucket).reduce((a, b) => a + b, 0);
  const days = out.length ? Math.max(1, Math.round((noon(out.map((t) => t.date).sort().at(-1)!).getTime() - noon(out.map((t) => t.date).sort()[0]!).getTime()) / DAY) + 1) : 0;
  const moneyIn = txns.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  return { byBucket, totalOutCents: total, moneyInCents: moneyIn, days, ranked: SPEND_BUCKETS.filter((b) => byBucket[b] > 0).sort((a, b) => byBucket[b] - byBucket[a]) };
}

// ───────── Recurring charges and income ─────────
const merchantKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\b(pos|debit|purchase|card|payment|autopay|ach|recurring|online|web|www|com|inc|llc)\b/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

export interface RecurringCharge {
  name: string;
  amountCents: number;
  dueDay: number;
  count: number;
  category: BillCategory;
}

/** Charges from the same merchant, similar amount (±10%), about a month apart (25–35 days), at least twice. */
export function findRecurring(txns: BankTxn[], existing: Bill[]): RecurringCharge[] {
  const groups = new Map<string, BankTxn[]>();
  for (const t of txns.filter((x) => x.amountCents < 0)) {
    const k = merchantKey(t.description);
    if (k.length < 3) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const known = existing.map((b) => merchantKey(b.name));
  const out: RecurringCharge[] = [];
  for (const [k, ts] of groups) {
    if (ts.length < 2) continue;
    const s = [...ts].sort((a, b) => a.date.localeCompare(b.date));
    const amts = s.map((t) => -t.amountCents);
    const med = median(amts);
    if (!amts.every((a) => Math.abs(a - med) <= med * 0.1)) continue;
    const gaps = s.slice(1).map((t, i) => Math.round((noon(t.date).getTime() - noon(s[i]!.date).getTime()) / DAY));
    if (!gaps.every((g) => g >= 25 && g <= 35)) continue;
    if (known.some((n) => n && (n === k || k.includes(n) || n.includes(k)))) continue;
    const bucket = bucketFor(s[0]!.description);
    if (bucket === "housing") continue;
    const category: BillCategory = /netflix|spotify|hulu|disney|youtube|apple|prime|max|paramount|peacock|audible|gym|planet fitness/.test(k) ? "subscription" : bucket === "bills" ? (/insurance|geico|progressive|state farm/.test(k) ? "insurance" : /verizon|t mobile|tmobile|at/.test(k) ? "phone" : /comcast|xfinity|spectrum/.test(k) ? "internet" : "utilities") : "other";
    out.push({ name: k.replace(/\b\w/g, (c) => c.toUpperCase()), amountCents: med, dueDay: Number(s.at(-1)!.date.slice(8, 10)), count: s.length, category });
  }
  return out.sort((a, b) => b.amountCents - a.amountCents);
}

/** Looks for regular deposits (pay) and guesses frequency and amount. */
export function detectIncome(txns: BankTxn[]): { frequency: PayFrequency; amountCents: number; lastDate: string; count: number } | null {
  const ins = txns.filter((t) => t.amountCents >= 20000);
  const groups = new Map<string, BankTxn[]>();
  for (const t of ins) {
    const k = /payroll|direct dep|dir dep|salary|paycheck|wages/i.test(t.description) ? "payroll" : merchantKey(t.description);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  let best: { frequency: PayFrequency; amountCents: number; lastDate: string; count: number } | null = null;
  for (const [, ts] of groups) {
    if (ts.length < 2) continue;
    const s = [...ts].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = s.slice(1).map((t, i) => Math.round((noon(t.date).getTime() - noon(s[i]!.date).getTime()) / DAY));
    const g = median(gaps);
    const onFirstAndFifteenth = s.every((t) => ["01", "02", "03", "14", "15", "16"].includes(t.date.slice(8, 10)));
    const frequency: PayFrequency | null = g >= 6 && g <= 8 ? "weekly" : g >= 13 && g <= 17 ? (onFirstAndFifteenth && gaps.some((x) => x !== 14) ? "semimonthly" : "biweekly") : g >= 27 && g <= 32 ? "monthly" : null;
    if (!frequency) continue;
    const cand = { frequency, amountCents: median(s.map((t) => t.amountCents)), lastDate: s.at(-1)!.date, count: s.length };
    if (!best || cand.count > best.count) best = cand;
  }
  return best;
}

// ───────── Emergency fund ─────────
export function emergencyFund(savedCents: number, monthlyEssentialsCents: number) {
  if (monthlyEssentialsCents <= 0) return { months: null, toOneMonthCents: null, toThreeMonthsCents: null, level: "unknown" as const };
  const months = savedCents / monthlyEssentialsCents;
  return {
    months: Math.floor(months * 10) / 10,
    toOneMonthCents: Math.max(0, monthlyEssentialsCents - savedCents),
    toThreeMonthsCents: Math.max(0, monthlyEssentialsCents * 3 - savedCents),
    level: months >= 3 ? ("strong" as const) : months >= 1 ? ("started" as const) : ("starting" as const),
  };
}

// ───────── Money check (simple progress score) ─────────
export interface MoneyCheckInput {
  onTimeStreak: number;
  overdueBills: number;
  hasPaySetup: boolean;
  forecastGoesNegative: boolean | null;
  emergencyMonths: number | null;
  utilization: number | null;
  /** The user ticked "keep card use under 30%" (used when no utilization number is known). */
  utilizationConfirmed?: boolean;
  creditStepsDone: number;
  creditStepsTotal: number;
  hasGoal: boolean;
}

export function moneyCheck(i: MoneyCheckInput) {
  const items = [
    { id: "rent_on_time", ok: i.onTimeStreak >= 1, points: 20 },
    { id: "no_overdue", ok: i.overdueBills === 0, points: 20 },
    { id: "paycheck_plan", ok: i.hasPaySetup && i.forecastGoesNegative === false, points: 15 },
    { id: "emergency", ok: (i.emergencyMonths ?? 0) >= 1, points: 15 },
    { id: "utilization", ok: i.utilization !== null ? i.utilization < 0.3 : !!i.utilizationConfirmed, points: 10 },
    { id: "credit_steps", ok: i.creditStepsTotal > 0 && i.creditStepsDone >= Math.ceil(i.creditStepsTotal / 2), points: 10 },
    { id: "goal", ok: i.hasGoal, points: 10 },
  ] as const;
  const score = items.reduce((s, x) => s + (x.ok ? x.points : 0), 0);
  const next = items.find((x) => !x.ok)?.id ?? null;
  return { score, items, next };
}

// ───────── Debt payoff dates & leftover split ─────────
export function payoffDates(debts: Debt[], plan: PayoffResult, now: Date): Array<{ id: string; name: string; month: string | null }> {
  return plan.order.map((id) => {
    const m = plan.payoffMonthById[id];
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (m ?? 0), 1));
    return { id, name: debts.find((x) => x.id === id)?.name ?? "", month: m === undefined ? null : ymd(d).slice(0, 7) };
  });
}

/** Splits money left after bills by percentages (summing to ≤100); the rest stays as a buffer. Exact to the cent. */
export function leftoverSplit(leftoverCents: number, pct: { goals: number; debt: number }) {
  const l = Math.max(0, leftoverCents);
  const g = Math.max(0, Math.min(100, pct.goals));
  const d = Math.max(0, Math.min(100 - g, pct.debt));
  const goals = Math.floor((l * g) / 100);
  const debt = Math.floor((l * d) / 100);
  return { goalsCents: goals, debtCents: debt, bufferCents: l - goals - debt };
}

// ───────── At-risk payments, plan items, weekly check-in ─────────
/** Obligations due on a day when the forecast balance ends below $0. */
export function atRiskObligations(series: ForecastDay[], obligations: Obligation[]): Obligation[] {
  const neg = new Set(series.filter((d) => d.balanceCents < 0 && d.outCents > 0).map((d) => d.date));
  return obligations.filter((o) => neg.has(o.dueDate));
}

export function moneyPlanItems(i: { paydays: string[]; setAsideByPayday: Record<string, number>; goals: SavingsGoal[]; atRisk: Obligation[]; now: Date; horizonDays?: number }): PlanItem[] {
  const today = ymd(i.now);
  const end = ymd(new Date(noon(today).getTime() + (i.horizonDays ?? 30) * DAY));
  const out: PlanItem[] = [];
  for (const d of i.paydays.filter((x) => x >= today && x <= end)) {
    out.push({ kind: "payday", date: d, title: "Payday", detail: i.setAsideByPayday[d] ? `Set aside ${usd(i.setAsideByPayday[d]!)}` : "Nothing due from this check", detailCode: "set_aside", n: i.setAsideByPayday[d] ?? 0, href: "/paycheck", urgent: false });
  }
  for (const g of i.goals.filter((x) => x.targetDate && x.targetDate >= today && x.targetDate <= end && x.savedCents < x.targetCents)) {
    out.push({ kind: "goal_date", date: g.targetDate!, title: `Goal: ${g.name}`, detail: `${usd(g.targetCents - g.savedCents)} to go`, detailCode: "to_go", n: g.targetCents - g.savedCents, href: "/goals", urgent: false });
  }
  for (const o of i.atRisk) {
    out.push({ kind: "at_risk", date: o.dueDate, title: `${o.name} may not clear`, detail: "Your balance may be too low that day", detailCode: "at_risk", href: "/paycheck", urgent: true });
  }
  return out;
}

/** Next Sunday at 6pm local time (or next week if that has passed). */
export function nextWeeklyCheckIn(now: Date, utcOffsetMinutes: number): string {
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  const daysAhead = (7 - local.getUTCDay()) % 7;
  let at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysAhead, 18) - utcOffsetMinutes * 60_000;
  if (at <= now.getTime()) at += 7 * DAY;
  return new Date(at).toISOString();
}

