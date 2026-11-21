/**
 * v0.25: the money assistant — a rules-based "Ask" that understands short questions in English,
 * Spanish and Chinese and answers from the user's own data (no AI service, nothing sent
 * anywhere), plus free-trial and return trackers, roommate nudges, a monthly report, a daily
 * digest notification, purchase cost in work hours and goal delay, and badges.
 */
import type { Bill } from "./bills";
import type { Contribution, SideIncome } from "./earn";
import type { Iou } from "./assist";
import type { Obligation } from "./money";
import type { PlanItem, ReminderPlan, RentPayment } from "./renterTools";
import type { Spend } from "./coach";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(noon(s).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);
const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ───────── Ask: intent parsing ─────────
export type AskIntent = "afford" | "due" | "safe" | "payday" | "debt" | "budget" | "net_worth" | "credit" | "save" | "rent" | "side" | "tax" | "subs" | "trials" | "emergency" | "overview" | "category" | "roommates" | "lease" | "pay_first" | "biggest" | "unknown";
const RULES: Array<[AskIntent, RegExp]> = [
  ["roommates", /owes? me|who owes|roommate|me debe|me deben|compañer|室友|欠我/],
  ["pay_first", /pay first|prioriti[sz]e|what should i pay|which bill first|qué (pago|debo pagar) primero|先付|先还|优先/],
  ["biggest", /biggest|largest|most expensive|más (grande|cara|caro)|最大|最贵/],
  ["lease", /lease|contrato|租约/],
  ["category", /spen[dt] on|spending on|gast[eéo] en|花在|花了多少在/],
  ["overview", /how am i doing|how'?s my money|overview|cómo voy|cómo estoy|resumen|我(的)?财务(怎么样|状况)|我做得怎么样|总览/],
  ["trials", /trial|prueba gratis|试用/],
  ["subs", /subscription|suscripci|订阅/],
  ["tax", /tax|impuesto|税/],
  ["side", /side (income|hustle|gig)|gig|uber|doordash|lyft|instacart|ingresos? extra|副业|零工/],
  ["emergency", /emergency|cushion|rainy day|emergencia|colchón|应急/],
  ["rent", /\brent\b|renta|alquiler|房租/],
  ["afford", /afford|can i (buy|get)|should i buy|permitir|puedo comprar|me alcanza|买得起|能买|可以买/],
  ["safe", /safe to spend|can i spend|how much (can|do) i (have|spend)|left to spend|puedo gastar|cuánto (puedo|tengo)|可以花|能花|还能花/],
  ["due", /due|bills?|owe this week|pay this week|vence|cuentas|facturas|到期|账单|要付/],
  ["payday", /payday|paycheck|get paid|next pay|día de pago|me pagan|cheque|发薪|发工资|工资/],
  ["debt", /debt|debt-free|loan|pay off|deuda|préstamo|libre de deudas|债|贷款|还清/],
  ["budget", /budget|spent|spending|presupuesto|gast[eéo]|预算|花了|消费/],
  ["net_worth", /net worth|worth|patrimonio|净资产|身家/],
  ["credit", /credit|card|utiliz|score|crédito|tarjeta|puntaje|信用|信用卡/],
  ["save", /sav(e|ing)|goal|ahorr|meta|存钱|储蓄|目标/],
];
export function parseAsk(text: string): { intent: AskIntent; amountCents: number | null } {
  const t = text.toLowerCase().trim();
  const m = t.match(/\$?\s?(\d{1,6}(?:[.,]\d{1,2})?)/);
  const amount = m ? Math.round(Number(m[1]!.replace(",", ".")) * 100) : null;
  for (const [intent, re] of RULES) if (re.test(t)) return { intent: intent === "safe" && amount !== null ? "afford" : intent, amountCents: amount };
  return { intent: amount !== null ? "afford" : "unknown", amountCents: amount };
}

// ───────── Free trials ─────────
export interface Trial {
  id: string;
  name: string;
  endsOn: string;
  costCents: number;
  cycle: "month" | "year";
  canceled: boolean;
}
export function trialStatus(trials: Trial[], today: string) {
  const rows = trials.map((x) => ({ ...x, daysLeft: daysBetween(today, x.endsOn), yearlyCents: x.cycle === "month" ? x.costCents * 12 : x.costCents })).sort((a, b) => Number(a.canceled) - Number(b.canceled) || a.endsOn.localeCompare(b.endsOn));
  const active = rows.filter((r) => !r.canceled && r.daysLeft >= 0);
  return { rows, active: active.length, wouldCostYearCents: active.reduce((t, r) => t + r.yearlyCents, 0), savedYearCents: rows.filter((r) => r.canceled).reduce((t, r) => t + r.yearlyCents, 0) };
}

// ───────── Returns ─────────
export interface ReturnItem {
  id: string;
  item: string;
  store: string;
  amountCents: number;
  returnBy: string;
  returned: boolean;
}
export function returnStatus(list: ReturnItem[], today: string) {
  const rows = list.map((x) => ({ ...x, daysLeft: daysBetween(today, x.returnBy) })).sort((a, b) => Number(a.returned) - Number(b.returned) || a.returnBy.localeCompare(b.returnBy));
  return { rows, openCents: rows.filter((r) => !r.returned && r.daysLeft >= 0).reduce((t, r) => t + r.amountCents, 0), recoveredCents: rows.filter((r) => r.returned).reduce((t, r) => t + r.amountCents, 0) };
}

// ───────── Plan items: trials, returns, roommate nudges, monthly report ─────────
export function trackerPlanItems(i: { trials: Trial[]; returns: ReturnItem[]; ious: Iou[]; now: Date; hasMoneyData: boolean }): PlanItem[] {
  const today = ymd(i.now);
  const out: PlanItem[] = [];
  for (const x of i.trials) {
    const d = daysBetween(today, x.endsOn);
    if (x.canceled || d < 0 || d > 5) continue;
    out.push({ kind: "trial", date: addDays(x.endsOn, -Math.min(2, d)), title: `${x.name} free trial ends ${x.endsOn}`, detail: "", detailCode: "trial_ends", n: x.costCents, href: "/trials", urgent: d <= 2 });
  }
  for (const r of i.returns) {
    const d = daysBetween(today, r.returnBy);
    if (r.returned || d < 0 || d > 7) continue;
    out.push({ kind: "return", date: addDays(r.returnBy, -Math.min(3, d)), title: `Return ${r.item}${r.store ? ` to ${r.store}` : ""} by ${r.returnBy}`, detail: "", detailCode: "return_by", n: r.amountCents, href: "/trials", urgent: d <= 2 });
  }
  const oldest = new Map<string, string>();
  for (const x of i.ious) if (!x.settled && x.amountCents > 0) oldest.set(x.person, [oldest.get(x.person) ?? x.date, x.date].sort()[0]!);
  const owed = new Map<string, number>();
  for (const x of i.ious) if (!x.settled) owed.set(x.person, (owed.get(x.person) ?? 0) + x.amountCents);
  for (const [person, since] of oldest) {
    const cents = owed.get(person) ?? 0;
    if (cents > 0 && daysBetween(since, today) >= 14) out.push({ kind: "iou", date: today, title: `${person} owes you ${usd(cents)}`, detail: "", detailCode: "iou_nudge", n: cents, href: "/roommates", urgent: false });
  }
  const dom = Number(today.slice(8, 10));
  if (i.hasMoneyData && dom <= 5) out.push({ kind: "report", date: today, title: "Your monthly money report is ready", detail: "", detailCode: "month_report", href: "/month-report", urgent: false });
  return out;
}

// ───────── Monthly report ─────────
export function monthReport(i: { month: string; payments: RentPayment[]; billPaid: Record<string, string[]>; bills: Bill[]; spends: Spend[]; side: SideIncome[]; contribs: Contribution[]; debts?: Array<{ id: string; minPaymentCents: number }>; debtPaid?: Record<string, string[]> }) {
  const pays = i.payments.filter((p) => p.month === i.month);
  const rent = pays.reduce((t, p) => t + p.amountCents, 0);
  const lateFees = pays.reduce((t, p) => t + (p.lateFeeCents ?? 0), 0);
  const billsPaid = i.bills.filter((b) => (i.billPaid[b.id] ?? []).includes(i.month));
  const billsCents = billsPaid.reduce((t, b) => t + b.amountCents, 0);
  const spent = i.spends.filter((s) => s.date.startsWith(i.month)).reduce((t, s) => t + s.amountCents, 0);
  const side = i.side.filter((s) => s.date.startsWith(i.month)).reduce((t, s) => t + s.amountCents, 0);
  const saved = i.contribs.filter((c) => c.date.startsWith(i.month)).reduce((t, c) => t + c.amountCents, 0);
  const debtPaid = (i.debts ?? []).filter((d) => (i.debtPaid?.[d.id] ?? []).includes(i.month)).reduce((t, d) => t + d.minPaymentCents, 0);
  const text = [
    `MY MONEY — ${i.month} (Housing Compass)`,
    `Rent paid: ${usd(rent)}${lateFees ? ` (late fees ${usd(lateFees)})` : ""}`,
    `Bills paid: ${billsPaid.length} of ${i.bills.length} (${usd(billsCents)})`,
    `Everyday spending logged: ${usd(spent)}`,
    `Side income: ${usd(side)}`,
    `Added to savings goals: ${usd(saved)}`,
    ...(debtPaid ? [`Debt minimums paid: ${usd(debtPaid)}`] : []),
    "",
    "From my own records in the app. Not financial advice.",
  ].join("\n");
  return { month: i.month, rentCents: rent, lateFeesCents: lateFees, billsPaid: billsPaid.length, billsTotal: i.bills.length, billsCents, spentCents: spent, sideCents: side, savedCents: saved, debtPaidCents: debtPaid, text };
}
export const previousMonth = (today: string) => {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// ───────── Daily digest ─────────
/** One morning notification for each of the next days that has something due. */
export function dailyDigest(obligations: Obligation[], now: Date, utcOffsetMinutes: number, hour: number, days = 7): ReminderPlan[] {
  const localToday = ymd(new Date(now.getTime() + utcOffsetMinutes * 60_000));
  const out: ReminderPlan[] = [];
  for (let k = 0; k < days; k++) {
    const date = addDays(localToday, k);
    const items = obligations.filter((o) => o.dueDate === date);
    if (!items.length) continue;
    const at = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour) - utcOffsetMinutes * 60_000;
    if (at <= now.getTime()) continue;
    const total = items.reduce((t, o) => t + o.amountCents, 0);
    out.push({ id: `digest:${date}`, at: new Date(at).toISOString(), title: items.length === 1 ? `${items[0]!.name} is due today` : `${items.length} payments due today`, body: `${items.map((o) => `${o.name} ${usd(o.amountCents)}`).join(", ")} — total ${usd(total)}` });
  }
  return out;
}

// ───────── Purchase impact ─────────
export function purchaseImpact(i: { priceCents: number; hourlyCents: number | null; goalPerWeekCents: number | null }) {
  return {
    hours: i.hourlyCents && i.hourlyCents > 0 ? Math.round((i.priceCents / i.hourlyCents) * 10) / 10 : null,
    goalDelayWeeks: i.goalPerWeekCents && i.goalPerWeekCents > 0 ? Math.ceil(i.priceCents / i.goalPerWeekCents) : null,
  };
}

// ───────── Badges ─────────
export type BadgeId = "debt_min_3" | "first_rent" | "on_time_3" | "all_bills_3" | "first_goal" | "debt_free_one" | "emergency_month" | "bill_win" | "under_limit_4" | "challenge_10" | "report_checked" | "net_worth_up" | "side_hustle";
export function badges(i: { onTimeRentMonths: number; rentMonths: number; allBillsStreak: number; goalsDone: number; debtsPaidOff: number; emergencyMonths: number | null; wins: number; underLimitWeeks: number; challengeWeeks: number; reportChecks: number; netWorthChange: number | null; sideIncomeEntries: number; debtMinStreak?: number }) {
  const list: Array<{ id: BadgeId; earned: boolean; progress: number; goal: number }> = [
    { id: "first_rent", earned: i.rentMonths >= 1, progress: Math.min(1, i.rentMonths), goal: 1 },
    { id: "on_time_3", earned: i.onTimeRentMonths >= 3, progress: Math.min(3, i.onTimeRentMonths), goal: 3 },
    { id: "all_bills_3", earned: i.allBillsStreak >= 3, progress: Math.min(3, i.allBillsStreak), goal: 3 },
    { id: "first_goal", earned: i.goalsDone >= 1, progress: Math.min(1, i.goalsDone), goal: 1 },
    { id: "debt_free_one", earned: i.debtsPaidOff >= 1, progress: Math.min(1, i.debtsPaidOff), goal: 1 },
    { id: "emergency_month", earned: (i.emergencyMonths ?? 0) >= 1, progress: Math.min(1, Math.floor((i.emergencyMonths ?? 0) * 10) / 10), goal: 1 },
    { id: "bill_win", earned: i.wins >= 1, progress: Math.min(1, i.wins), goal: 1 },
    { id: "under_limit_4", earned: i.underLimitWeeks >= 4, progress: Math.min(4, i.underLimitWeeks), goal: 4 },
    { id: "challenge_10", earned: i.challengeWeeks >= 10, progress: Math.min(10, i.challengeWeeks), goal: 10 },
    { id: "report_checked", earned: i.reportChecks >= 1, progress: Math.min(1, i.reportChecks), goal: 1 },
    { id: "net_worth_up", earned: (i.netWorthChange ?? 0) > 0, progress: (i.netWorthChange ?? 0) > 0 ? 1 : 0, goal: 1 },
    { id: "side_hustle", earned: i.sideIncomeEntries >= 5, progress: Math.min(5, i.sideIncomeEntries), goal: 5 },
    { id: "debt_min_3", earned: (i.debtMinStreak ?? 0) >= 3, progress: Math.min(3, i.debtMinStreak ?? 0), goal: 3 },
  ];
  return { list, earned: list.filter((b) => b.earned).length, total: list.length };
}
