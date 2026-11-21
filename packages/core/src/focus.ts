/**
 * v0.27: focus on what matters — what to pay first when money is short, the single "next up"
 * action, plan filters, debt payoff milestones, spending-category detection for Ask, and the
 * biggest monthly costs. General guidance, not financial advice.
 */
import type { Bill } from "./bills";
import type { Debt, Obligation } from "./money";
import type { PlanItem } from "./renterTools";
import type { SpendCategory } from "./coach";

// ───────── Pay first ─────────
export type PayReason = "housing" | "utilities" | "minimum" | "other" | "subscription";
/**
 * Suggested order when there isn't enough for everything: keep a roof and the lights on, then
 * minimum payments (to avoid late marks on credit), then other bills, subscriptions last.
 * Within each group, soonest due first.
 */
export function payPriority(obligations: Obligation[], bills: Bill[]) {
  const billById = new Map(bills.map((b) => [b.id, b]));
  const reason = (o: Obligation): PayReason => {
    if (o.kind === "rent") return "housing";
    if (o.id.startsWith("debt:")) return "minimum";
    const b = billById.get(o.id.split(":")[1] ?? "");
    if (!b) return "other";
    if (b.category === "utilities" || b.category === "phone" || b.category === "internet" || b.category === "insurance") return "utilities";
    if (b.category === "credit_card" || b.category === "loan" || b.category === "car") return "minimum";
    if (b.category === "subscription") return "subscription";
    return "other";
  };
  const rank: Record<PayReason, number> = { housing: 0, utilities: 1, minimum: 2, other: 3, subscription: 4 };
  return obligations.map((o) => ({ ...o, reason: reason(o) })).sort((a, b) => rank[a.reason] - rank[b.reason] || a.dueDate.localeCompare(b.dueDate));
}
/** How far the available money goes down the priority list. */
export function coverage(order: Array<Obligation & { reason: PayReason }>, availableCents: number) {
  let left = availableCents;
  return order.map((o) => {
    const covered = left >= o.amountCents;
    if (covered) left -= o.amountCents;
    return { ...o, covered };
  });
}

// ───────── Next up ─────────
export function nextUp(items: PlanItem[]): PlanItem | null {
  if (!items.length) return null;
  const urgent = items.filter((i) => i.urgent).sort((a, b) => a.date.localeCompare(b.date));
  return urgent[0] ?? [...items].sort((a, b) => a.date.localeCompare(b.date))[0]!;
}

// ───────── Plan filters ─────────
export type PlanFilter = "all" | "money" | "credit" | "home";
const GROUPS: Record<Exclude<PlanFilter, "all">, PlanItem["kind"][]> = {
  money: ["bill_due", "payday", "goal_date", "at_risk", "tax_due", "yearly_due", "bill_promo", "challenge", "net_worth", "budget", "trial", "return", "iou", "report", "debt_due", "backup"],
  credit: ["credit", "debt_due"],
  home: ["rent_due", "tour", "app_deadline", "deposit_return", "waitlist_check_in", "follow_up", "lease"],
};
export function filterPlan(items: PlanItem[], f: PlanFilter) {
  return f === "all" ? items : items.filter((i) => GROUPS[f].includes(i.kind));
}
export const planItemKey = (i: PlanItem) => `${i.kind}|${i.date}|${i.title}`;

// ───────── Debt payoff milestones ─────────
export const DEBT_MILESTONES = [25, 50, 75, 100] as const;
export function debtMilestonesCrossed(d: Debt, newBalanceCents: number): number[] {
  const start = Math.max(d.startBalanceCents ?? d.balanceCents, d.balanceCents);
  if (!start) return [];
  const before = ((start - d.balanceCents) / start) * 100;
  const after = ((start - Math.max(0, newBalanceCents)) / start) * 100;
  return DEBT_MILESTONES.filter((m) => before < m && after >= m);
}

// ───────── Ask helpers ─────────
const CAT_WORDS: Array<[SpendCategory, RegExp]> = [
  ["coffee", /coffee|café|cafe|latte|starbucks|咖啡/],
  ["gas", /\bgas\b|gasoline|fuel|gasolina|油费|加油/],
  ["food", /food|groceries|grocery|eating out|restaurant|lunch|dinner|comida|restaurante|餐|吃/],
  ["fun", /\bfun\b|entertainment|movies|diversión|娱乐/],
  ["shopping", /shopping|clothes|amazon|compras|ropa|购物/],
];
export function detectCategory(text: string): SpendCategory | null {
  const t = text.toLowerCase();
  return CAT_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}
export function findByName<T extends { name: string }>(text: string, list: T[]): T | null {
  const t = text.toLowerCase();
  return [...list].sort((a, b) => b.name.length - a.name.length).find((x) => x.name.trim().length >= 2 && t.includes(x.name.toLowerCase())) ?? null;
}
/** The largest monthly costs: rent, bills and debt minimums. */
export function biggestCosts(i: { rentCents: number | null; bills: Bill[]; debts: Debt[] }) {
  const rows = [
    ...(i.rentCents ? [{ name: "Rent", cents: i.rentCents, kind: "rent" as const }] : []),
    ...i.bills.map((b) => ({ name: b.name, cents: b.amountCents, kind: "bill" as const })),
    ...i.debts.filter((d) => d.balanceCents > 0).map((d) => ({ name: d.name, cents: Math.min(d.minPaymentCents, d.balanceCents), kind: "debt" as const })),
  ].sort((a, b) => b.cents - a.cents);
  return { rows: rows.slice(0, 5), totalCents: rows.reduce((t, r) => t + r.cents, 0) };
}
