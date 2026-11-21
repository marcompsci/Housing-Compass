/**
 * v0.26: everyday routine — debt minimums with due days in the plan and in safe-to-spend,
 * a paycheck split, a lease-end reminder, Ask helpers (bill lookup, follow-ups), adding a
 * recurring charge as a bill, a combined money CSV and a debt-minimum streak.
 */
import type { Bill, BillCategory } from "./bills";
import type { Debt, Obligation } from "./money";
import type { PlanItem } from "./renterTools";
import type { AskIntent } from "./assistant";
import type { SideIncome } from "./earn";
import type { Spend } from "./coach";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const dueOn = (month: string, day: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, dim)).padStart(2, "0")}`;
};
const nextMonth = (m: string) => {
  const [y, mm] = m.split("-").map(Number) as [number, number];
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
};

// ───────── Debt minimums ─────────
/** Unpaid minimum payments with a due day, in the window — shaped like other obligations. */
export function debtObligations(debts: Debt[], debtPaid: Record<string, string[]>, from: string, days: number): Obligation[] {
  const end = ymd(new Date(noon(from).getTime() + days * DAY));
  const out: Obligation[] = [];
  for (const d of debts) {
    if (!d.dueDay || d.balanceCents <= 0 || d.minPaymentCents <= 0) continue;
    for (let m = from.slice(0, 7), k = 0; k < 3; m = nextMonth(m), k++) {
      const due = dueOn(m, d.dueDay);
      if (due >= from && due <= end && !(debtPaid[d.id] ?? []).includes(m)) out.push({ id: `debt:${d.id}:${m}`, name: d.name, amountCents: Math.min(d.minPaymentCents, d.balanceCents), dueDate: due, kind: "bill" });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
export function debtPlanItems(debts: Debt[], debtPaid: Record<string, string[]>, now: Date): PlanItem[] {
  const today = ymd(now);
  const month = today.slice(0, 7);
  const items: PlanItem[] = debtObligations(debts, debtPaid, today, 10).map((o) => ({ kind: "debt_due", date: o.dueDate, title: `${o.name} minimum ${usd(o.amountCents)}`, detail: "", detailCode: "debt_min", n: daysBetween(today, o.dueDate), href: "/debts", urgent: daysBetween(today, o.dueDate) <= 2 }));
  for (const d of debts) {
    if (!d.dueDay || d.balanceCents <= 0 || (debtPaid[d.id] ?? []).includes(month)) continue;
    const due = dueOn(month, d.dueDay);
    if (due < today) items.push({ kind: "debt_due", date: today, title: `${d.name} minimum ${usd(Math.min(d.minPaymentCents, d.balanceCents))}`, detail: "", detailCode: "debt_min", n: daysBetween(today, due), href: "/debts", urgent: true });
  }
  return items;
}
/** Months in a row (up to last month) where every debt with a due day was marked paid. */
export function debtMinStreak(debts: Debt[], debtPaid: Record<string, string[]>, now: Date) {
  const ds = debts.filter((d) => d.dueDay);
  if (!ds.length) return 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const done = (m: string) => ds.every((x) => (debtPaid[x.id] ?? []).includes(m));
  let n = done(ymd(d).slice(0, 7)) ? 1 : 0;
  for (let i = 0; i < 120; i++) {
    d.setUTCMonth(d.getUTCMonth() - 1);
    if (!done(ymd(d).slice(0, 7))) break;
    n++;
  }
  return n;
}

// ───────── Paycheck split ─────────
export interface PaySplit {
  bills: number;
  savings: number;
  debt: number;
  spending: number;
}
export function splitPaycheck(amountCents: number, s: PaySplit) {
  const total = s.bills + s.savings + s.debt + s.spending;
  if (total <= 0) return null;
  const part = (p: number) => Math.floor((amountCents * p) / total);
  const rows = { bills: part(s.bills), savings: part(s.savings), debt: part(s.debt), spending: 0 };
  rows.spending = amountCents - rows.bills - rows.savings - rows.debt;
  return { rows, balanced: total === 100 };
}

// ───────── Lease end ─────────
export function leasePlanItems(leaseEnd: string | null, now: Date): PlanItem[] {
  if (!leaseEnd) return [];
  const today = ymd(now);
  const d = daysBetween(today, leaseEnd);
  if (d < 0 || d > 90) return [];
  return [{ kind: "lease", date: today, title: `Lease ends ${leaseEnd}`, detail: "", detailCode: "lease_end", n: d, href: "/rent", urgent: d <= 30 }];
}

// ───────── Ask helpers ─────────
export function findBillByName(text: string, bills: Bill[]): Bill | null {
  const t = text.toLowerCase();
  return [...bills].sort((a, b) => b.name.length - a.name.length).find((b) => b.name.trim().length >= 2 && t.includes(b.name.toLowerCase())) ?? null;
}
export const FOLLOW_UPS: Partial<Record<AskIntent, AskIntent[]>> = {
  afford: ["safe", "budget"],
  due: ["safe", "payday"],
  safe: ["due", "budget"],
  payday: ["due", "safe"],
  debt: ["credit", "save"],
  budget: ["safe", "subs"],
  net_worth: ["debt", "save"],
  credit: ["debt"],
  save: ["emergency", "net_worth"],
  rent: ["due", "payday"],
  side: ["tax", "save"],
  tax: ["side"],
  subs: ["trials", "budget"],
  trials: ["subs"],
  emergency: ["save", "safe"],
  overview: ["due", "debt", "save"],
  unknown: ["overview", "due", "safe"],
};
export function rememberAsk(history: string[], q: string) {
  const t = q.trim().slice(0, 200);
  if (!t) return history;
  return [t, ...history.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 10);
}

// ───────── Recurring charge → bill ─────────
export function recurringToBill(r: { name: string; amountCents: number; dueDay: number; category: BillCategory }): Omit<Bill, "id"> {
  return { name: r.name.slice(0, 60), amountCents: r.amountCents, dueDay: Math.min(31, Math.max(1, r.dueDay)), category: r.category, autopay: true };
}

// ───────── Combined CSV ─────────
export function moneyCsv(i: { bills: Bill[]; spends: Spend[]; side: SideIncome[]; debts: Debt[] }) {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [
    "type,date_or_due_day,name,category,amount_usd",
    ...i.bills.map((b) => ["bill", `day ${b.dueDay}`, cell(b.name), b.category, (b.amountCents / 100).toFixed(2)].join(",")),
    ...i.debts.map((d) => ["debt", d.dueDay ? `day ${d.dueDay}` : "", cell(d.name), `apr ${d.apr}%`, (d.balanceCents / 100).toFixed(2)].join(",")),
    ...[...i.spends].sort((a, b) => a.date.localeCompare(b.date)).map((s) => ["spend", s.date, cell(s.note), s.category ?? "other", (s.amountCents / 100).toFixed(2)].join(",")),
    ...[...i.side].sort((a, b) => a.date.localeCompare(b.date)).map((s) => ["side_income", s.date, cell(s.source), "", (s.amountCents / 100).toFixed(2)].join(",")),
  ];
  return rows.join("\n");
}
