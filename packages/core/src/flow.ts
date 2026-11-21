/**
 * v0.28: the month at a glance — partial bill payments, one-off income, a monthly cash-flow
 * summary, a 50/30/20 check, tracker notifications (trials, returns, lease), calendar items for
 * minimums/trials/returns and rotating Ask examples. General information, not financial advice.
 */
import type { Bill } from "./bills";
import type { Debt, Obligation, PaySetup } from "./money";
import { monthlyIncomeCents } from "./money";
import type { ReminderPlan, RentSetup } from "./renterTools";
import type { Contribution, SideIncome } from "./earn";
import type { Spend } from "./coach";
import type { ReturnItem, Trial, AskIntent } from "./assistant";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Partial payments ─────────
export const partialKey = (billId: string, month: string) => `${billId}:${month}`;
/** Reduces bill obligations by any amount already paid toward them this month. */
export function applyPartials(obligations: Obligation[], partials: Record<string, number>): Obligation[] {
  return obligations
    .map((o) => {
      if (!o.id.startsWith("bill:")) return o;
      const [, id, month] = o.id.split(":");
      const paid = partials[partialKey(id!, month!)] ?? 0;
      return paid ? { ...o, amountCents: Math.max(0, o.amountCents - paid) } : o;
    })
    .filter((o) => o.amountCents > 0);
}

// ───────── One-off income ─────────
export interface OtherIncome {
  id: string;
  date: string;
  source: string;
  amountCents: number;
}

// ───────── Monthly cash flow ─────────
export function monthCashFlow(i: { month: string; pay: PaySetup | null; other: OtherIncome[]; side: SideIncome[]; rent: RentSetup | null; bills: Bill[]; debts: Debt[]; spends: Spend[] }) {
  const pay = i.pay ? monthlyIncomeCents(i.pay) : 0;
  const other = i.other.filter((x) => x.date.startsWith(i.month)).reduce((t, x) => t + x.amountCents, 0);
  const side = i.side.filter((x) => x.date.startsWith(i.month)).reduce((t, x) => t + x.amountCents, 0);
  const rent = i.rent?.amountCents ?? 0;
  const bills = i.bills.reduce((t, b) => t + b.amountCents, 0);
  const mins = i.debts.filter((d) => d.balanceCents > 0).reduce((t, d) => t + Math.min(d.minPaymentCents, d.balanceCents), 0);
  const spent = i.spends.filter((s) => s.date.startsWith(i.month)).reduce((t, s) => t + s.amountCents, 0);
  const inCents = pay + other + side;
  const outCents = rent + bills + mins + spent;
  return { payCents: pay, otherCents: other, sideCents: side, inCents, rentCents: rent, billsCents: bills, minimumsCents: mins, spentCents: spent, outCents, leftCents: inCents - outCents };
}

// ───────── 50/30/20 ─────────
const WANT_CATS = new Set(["fun", "shopping", "coffee"]);
/** Needs: rent, non-subscription bills, debt minimums, food and gas. Wants: subscriptions and fun/shopping/coffee. Savings: goal contributions. */
export function rule503020(i: { incomeCents: number; month: string; rent: RentSetup | null; bills: Bill[]; debts: Debt[]; spends: Spend[]; contribs: Contribution[] }) {
  if (i.incomeCents <= 0) return null;
  const monthSpends = i.spends.filter((s) => s.date.startsWith(i.month));
  const needs =
    (i.rent?.amountCents ?? 0) +
    i.bills.filter((b) => b.category !== "subscription").reduce((t, b) => t + b.amountCents, 0) +
    i.debts.filter((d) => d.balanceCents > 0).reduce((t, d) => t + Math.min(d.minPaymentCents, d.balanceCents), 0) +
    monthSpends.filter((s) => !WANT_CATS.has(s.category ?? "other")).reduce((t, s) => t + s.amountCents, 0);
  const wants = i.bills.filter((b) => b.category === "subscription").reduce((t, b) => t + b.amountCents, 0) + monthSpends.filter((s) => WANT_CATS.has(s.category ?? "other")).reduce((t, s) => t + s.amountCents, 0);
  const savings = i.contribs.filter((c) => c.date.startsWith(i.month)).reduce((t, c) => t + c.amountCents, 0);
  const pct = (c: number) => Math.round((c / i.incomeCents) * 100);
  return { needsCents: needs, wantsCents: wants, savingsCents: savings, needsPct: pct(needs), wantsPct: pct(wants), savingsPct: pct(savings), targets: { needs: 50, wants: 30, savings: 20 } };
}

// ───────── Tracker notifications ─────────
export function trackerReminders(i: { trials: Trial[]; returns: ReturnItem[]; leaseEnd: string | null; now: Date; utcOffsetMinutes: number }): ReminderPlan[] {
  const at = (date: string, hour = 10) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour) - i.utcOffsetMinutes * 60_000;
  const out: ReminderPlan[] = [];
  const push = (id: string, date: string, title: string, body: string) => {
    const t = at(date);
    if (t > i.now.getTime()) out.push({ id, at: new Date(t).toISOString(), title, body });
  };
  for (const x of i.trials) if (!x.canceled) push(`trial:${x.id}`, addDays(x.endsOn, -1), `${x.name} free trial ends tomorrow`, `Cancel today if you don't want to pay ${usd(x.costCents)}.`);
  for (const r of i.returns) if (!r.returned) push(`return:${r.id}`, addDays(r.returnBy, -2), `Return ${r.item} by ${r.returnBy}`, `${usd(r.amountCents)}${r.store ? ` at ${r.store}` : ""} — two days left.`);
  if (i.leaseEnd) {
    push(`lease:60`, addDays(i.leaseEnd, -60), "Lease ends in 60 days", "Time to decide: renew, negotiate or plan a move.");
    push(`lease:30`, addDays(i.leaseEnd, -30), "Lease ends in 30 days", "Check your lease for the notice you need to give.");
  }
  return out;
}

// ───────── Calendar extras ─────────
export function trackerObligations(trials: Trial[], returns: ReturnItem[]): Obligation[] {
  return [
    ...trials.filter((x) => !x.canceled).map((x) => ({ id: `trial:${x.id}`, name: `${x.name} (trial ends)`, amountCents: x.costCents, dueDate: x.endsOn, kind: "bill" as const })),
    ...returns.filter((r) => !r.returned).map((r) => ({ id: `return:${r.id}`, name: `Return ${r.item}`, amountCents: r.amountCents, dueDate: r.returnBy, kind: "bill" as const })),
  ];
}

// ───────── Rotating Ask examples ─────────
const EXAMPLE_POOL: AskIntent[] = ["due", "afford", "safe", "debt", "payday", "credit", "overview", "pay_first", "subs", "save", "budget", "emergency", "biggest", "net_worth"];
export function askExamples(today: string, n = 6): AskIntent[] {
  const start = Math.floor(noon(today).getTime() / DAY) % EXAMPLE_POOL.length;
  return Array.from({ length: n }, (_, k) => EXAMPLE_POOL[(start + k) % EXAMPLE_POOL.length]!);
}
