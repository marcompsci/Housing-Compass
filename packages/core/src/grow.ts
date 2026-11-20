/**
 * v0.23: build credit and net worth — per-card utilization and what to pay to get under 30%/10%,
 * proof-of-payment notes, a late-fee waiver letter, an autopay checklist, a net worth snapshot
 * and monthly history, spending by category with a month-over-month recap, a 52-week savings
 * challenge, and a money setup progress list. Device-only. Not financial advice.
 */
import type { Bill } from "./bills";
import type { Debt, SavingsGoal } from "./money";
import type { PlanItem } from "./renterTools";
import type { Spend, SpendCategory } from "./coach";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const prevMonth = (m: string) => {
  const [y, mm] = m.split("-").map(Number) as [number, number];
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, "0")}`;
};

// ───────── Cards: utilization and pay-to-target ─────────
export function cardUtilization(debts: Debt[]) {
  const cards = debts.filter((d) => (d.limitCents ?? 0) > 0);
  const rows = cards.map((d) => {
    const lim = d.limitCents!;
    return { id: d.id, name: d.name, balanceCents: d.balanceCents, limitCents: lim, pct: Math.round((d.balanceCents / lim) * 100), payTo30Cents: Math.max(0, d.balanceCents - Math.floor(lim * 0.3)), payTo10Cents: Math.max(0, d.balanceCents - Math.floor(lim * 0.1)) };
  });
  const bal = rows.reduce((s, r) => s + r.balanceCents, 0);
  const lim = rows.reduce((s, r) => s + r.limitCents, 0);
  return { rows, overallPct: lim ? Math.round((bal / lim) * 100) : null, balanceCents: bal, limitCents: lim, payTo30Cents: Math.max(0, bal - Math.floor(lim * 0.3)), payTo10Cents: Math.max(0, bal - Math.floor(lim * 0.1)) };
}

// ───────── Proof of payment ─────────
export const noteKey = (billId: string, month: string) => `${billId}:${month}`;
export function paidThisMonth(bills: Bill[], billPaid: Record<string, string[]>, notes: Record<string, string>, month: string) {
  return bills.filter((b) => (billPaid[b.id] ?? []).includes(month)).map((b) => ({ id: b.id, name: b.name, amountCents: b.amountCents, note: notes[noteKey(b.id, month)] ?? "" }));
}

// ───────── Late fee waiver letter ─────────
export function lateFeeWaiverLetter(i: { name: string; company: string; account: string; feeCents: number; paidOn: string; reason: string; today: string }): string {
  return [
    i.today,
    "",
    `To: ${i.company || "[Company]"} — Customer service`,
    `Re: Request to waive a late fee${i.account ? ` — account ${i.account}` : ""}`,
    "",
    `I'm asking you to waive the ${i.feeCents > 0 ? usd(i.feeCents) : "[amount]"} late fee on my account as a one-time courtesy.`,
    `${i.paidOn ? `I paid in full on ${i.paidOn}` : "I have paid in full"}${i.reason ? ` — the payment was late because ${i.reason}` : ""}. I have otherwise paid on time and plan to keep doing so.`,
    "Please confirm in writing once the fee is removed.",
    "",
    "Thank you,",
    i.name || "[Your name]",
  ].join("\n");
}

// ───────── Autopay checklist ─────────
/** Bills not on autopay. Turning on autopay for at least the minimum helps avoid missed payments. */
export function autopayChecklist(bills: Bill[]) {
  const off = bills.filter((b) => !b.autopay);
  const priority = (b: Bill) => (b.category === "credit_card" || b.category === "loan" ? 0 : b.category === "utilities" || b.category === "phone" || b.category === "internet" || b.category === "insurance" ? 1 : 2);
  return { off: [...off].sort((a, b) => priority(a) - priority(b) || a.dueDay - b.dueDay), onCount: bills.length - off.length, total: bills.length };
}

// ───────── Net worth ─────────
export interface NetWorthSnap {
  month: string;
  assetsCents: number;
  debtsCents: number;
}
export function netWorthNow(i: { otherAssetsCents: number | null; emergencyCents: number | null; goals: SavingsGoal[]; balanceCents: number | null; debts: Debt[] }) {
  const parts = {
    cash: Math.max(0, i.balanceCents ?? 0),
    emergency: Math.max(0, i.emergencyCents ?? 0),
    goals: i.goals.reduce((s, g) => s + g.savedCents, 0),
    other: Math.max(0, i.otherAssetsCents ?? 0),
  };
  const assets = parts.cash + parts.emergency + parts.goals + parts.other;
  const debts = i.debts.reduce((s, d) => s + d.balanceCents, 0);
  return { parts, assetsCents: assets, debtsCents: debts, netCents: assets - debts };
}
export function netWorthHistory(snaps: NetWorthSnap[]) {
  const rows = [...snaps].sort((a, b) => a.month.localeCompare(b.month)).map((s) => ({ ...s, netCents: s.assetsCents - s.debtsCents }));
  const last = rows[rows.length - 1] ?? null;
  const prev = rows.length > 1 ? rows[rows.length - 2]! : null;
  return { rows, last, changeCents: last && prev ? last.netCents - prev.netCents : null, firstToLastCents: rows.length > 1 ? last!.netCents - rows[0]!.netCents : null };
}
/** Saves (or replaces) this month's snapshot. */
export function upsertSnapshot(snaps: NetWorthSnap[], snap: NetWorthSnap): NetWorthSnap[] {
  return [...snaps.filter((s) => s.month !== snap.month), snap].sort((a, b) => a.month.localeCompare(b.month)).slice(-600);
}

// ───────── Spending by category ─────────
export const SPEND_CATEGORIES: SpendCategory[] = ["food", "coffee", "gas", "fun", "shopping", "other"];
export function monthRecap(spends: Spend[], month: string) {
  const sum = (m: string) => {
    const by: Record<SpendCategory, number> = { food: 0, coffee: 0, gas: 0, fun: 0, shopping: 0, other: 0 };
    let total = 0;
    for (const s of spends) if (s.date.startsWith(m)) {
      by[s.category ?? "other"] += s.amountCents;
      total += s.amountCents;
    }
    return { by, total };
  };
  const cur = sum(month);
  const last = sum(prevMonth(month));
  const rows = SPEND_CATEGORIES.map((c) => ({ category: c, cents: cur.by[c], lastCents: last.by[c], changeCents: cur.by[c] - last.by[c] })).filter((r) => r.cents || r.lastCents).sort((a, b) => b.cents - a.cents);
  const days = new Set(spends.filter((s) => s.date.startsWith(month)).map((s) => s.date)).size;
  return { month, totalCents: cur.total, lastTotalCents: last.total, changeCents: cur.total - last.total, rows, top: rows[0]?.cents ? rows[0].category : null, spendDays: days };
}
export function spendsCsv(spends: Spend[]) {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["date,category,amount_usd,note", ...[...spends].sort((a, b) => a.date.localeCompare(b.date)).map((s) => [s.date, s.category ?? "other", (s.amountCents / 100).toFixed(2), cell(s.note)].join(","))].join("\n");
}

// ───────── 52-week savings challenge ─────────
export interface Challenge {
  start: string;
  reverse: boolean;
  /** Amount for week 1 (or week 52 when reversed); week n saves n × unit. */
  unitCents: number;
  done: number[];
}
export function challengeAmount(c: Challenge, week: number) {
  return (c.reverse ? 53 - week : week) * c.unitCents;
}
export function challengeStatus(c: Challenge, today: string) {
  const week = Math.max(1, Math.min(52, Math.floor(daysBetween(c.start, today) / 7) + 1));
  const total = Array.from({ length: 52 }, (_, i) => challengeAmount(c, i + 1)).reduce((s, x) => s + x, 0);
  const saved = c.done.reduce((s, w) => s + challengeAmount(c, w), 0);
  const behind = Array.from({ length: week }, (_, i) => i + 1).filter((w) => !c.done.includes(w));
  return { week, weekDue: addDays(c.start, (week - 1) * 7 + 6), thisWeekCents: challengeAmount(c, week), totalCents: total, savedCents: saved, doneCount: c.done.length, behind, finished: c.done.length >= 52 };
}

// ───────── Plan items ─────────
export function growPlanItems(i: { challenge: Challenge | null; netWorth: NetWorthSnap[]; hasMoneySetup: boolean; now: Date }): PlanItem[] {
  const today = ymd(i.now);
  const out: PlanItem[] = [];
  if (i.challenge) {
    const s = challengeStatus(i.challenge, today);
    if (!s.finished && !i.challenge.done.includes(s.week)) out.push({ kind: "challenge", date: s.weekDue, title: `Savings challenge week ${s.week}: save ${usd(s.thisWeekCents)}`, detail: "", detailCode: "challenge_week", n: s.thisWeekCents, href: "/challenge", urgent: false });
  }
  const month = today.slice(0, 7);
  if (i.hasMoneySetup && !i.netWorth.some((s) => s.month === month)) out.push({ kind: "net_worth", date: today, title: "Update your net worth for this month", detail: "", detailCode: "net_worth_update", href: "/net-worth", urgent: false });
  return out;
}

// ───────── Money setup progress ─────────
export type SetupStepId = "pay" | "balance" | "rent" | "bills" | "debts" | "goals" | "emergency" | "limit" | "reminders";
export function setupProgress(i: { pay: boolean; balance: boolean; rent: boolean; bills: number; debts: number; goals: number; emergency: boolean; weeklyLimit: boolean; remindersOn: boolean }) {
  const steps: Array<{ id: SetupStepId; done: boolean; href: string }> = [
    { id: "pay", done: i.pay, href: "/paycheck" },
    { id: "balance", done: i.balance, href: "/money" },
    { id: "rent", done: i.rent, href: "/rent" },
    { id: "bills", done: i.bills > 0, href: "/bills" },
    { id: "debts", done: i.debts > 0, href: "/debts" },
    { id: "goals", done: i.goals > 0, href: "/goals" },
    { id: "emergency", done: i.emergency, href: "/money" },
    { id: "limit", done: i.weeklyLimit, href: "/spending" },
    { id: "reminders", done: i.remindersOn, href: "/rent" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) ?? null };
}
