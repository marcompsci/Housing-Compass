/**
 * Tools for after you've found a home: a rent-payment log (on-time streaks you can show a
 * landlord or a rent-reporting service), a move-in condition record, the security-deposit
 * return countdown, program waitlists, and one "what's next" plan that pulls them together.
 * Everything here is pure and works offline; nothing is sent anywhere unless the user exports it.
 */

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const atNoonUtc = (s: string) => new Date(`${s}T12:00:00Z`);

// ───────── Rent payments ─────────
export interface RentSetup {
  amountCents: number;
  /** Day of the month rent is due (1–28; later days are clamped to the month's last day). */
  dueDay: number;
  /** Days after the due date before a payment counts as late (from the lease; default 0). */
  graceDays: number;
  payee: string;
}

export interface RentPayment {
  id: string;
  /** The month this payment covers, YYYY-MM. */
  month: string;
  paidOn: string;
  amountCents: number;
  method: "bank_transfer" | "check" | "money_order" | "portal" | "cash_with_receipt" | "other";
  confirmation: string;
}

export function dueDateFor(month: string, dueDay: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(Math.max(1, dueDay), last)).padStart(2, "0")}`;
}

export function paymentTiming(p: RentPayment, setup: RentSetup): "on_time" | "late" {
  const due = atNoonUtc(dueDateFor(p.month, setup.dueDay)).getTime() + setup.graceDays * DAY;
  return atNoonUtc(p.paidOn).getTime() <= due ? "on_time" : "late";
}

export function validatePayment(p: Omit<RentPayment, "id">, existing: RentPayment[]): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)) return "Choose the month this payment covers.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.paidOn) || Number.isNaN(Date.parse(p.paidOn))) return "Enter the date you paid (YYYY-MM-DD).";
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0 || p.amountCents > 2_000_000) return "Enter the amount you paid.";
  if (existing.some((e) => e.month === p.month && e.paidOn === p.paidOn && e.amountCents === p.amountCents)) return "That payment is already logged.";
  return null;
}

export interface RentSummary {
  nextDue: string;
  daysUntilDue: number;
  currentMonthPaid: boolean;
  /** Consecutive months, newest first, fully paid on time. */
  onTimeStreak: number;
  monthsLogged: number;
  onTimeMonths: number;
  totalPaidCents: number;
}

export function rentSummary(setup: RentSetup, payments: RentPayment[], now: Date): RentSummary {
  const thisMonth = ymd(now).slice(0, 7);
  const byMonth = new Map<string, RentPayment[]>();
  for (const p of payments) byMonth.set(p.month, [...(byMonth.get(p.month) ?? []), p]);
  const monthPaidOnTime = (m: string) => {
    const ps = byMonth.get(m) ?? [];
    const total = ps.reduce((s, p) => s + p.amountCents, 0);
    return total >= setup.amountCents && ps.every((p) => paymentTiming(p, setup) === "on_time");
  };
  const monthPaid = (m: string) => (byMonth.get(m) ?? []).reduce((s, p) => s + p.amountCents, 0) >= setup.amountCents;
  const currentMonthPaid = monthPaid(thisMonth);
  const dueThis = dueDateFor(thisMonth, setup.dueDay);
  const nextMonth = (() => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return ymd(d).slice(0, 7);
  })();
  const nextDue = currentMonthPaid ? dueDateFor(nextMonth, setup.dueDay) : dueThis;
  const daysUntilDue = Math.round((atNoonUtc(nextDue).getTime() - atNoonUtc(ymd(now)).getTime()) / DAY);
  const months = [...byMonth.keys()].sort().reverse();
  let streak = 0;
  for (const m of months) {
    if (monthPaidOnTime(m)) streak += 1;
    else break;
  }
  return {
    nextDue,
    daysUntilDue,
    currentMonthPaid,
    onTimeStreak: streak,
    monthsLogged: months.length,
    onTimeMonths: months.filter(monthPaidOnTime).length,
    totalPaidCents: payments.reduce((s, p) => s + p.amountCents, 0),
  };
}

/** CSV cell: quoted, and spreadsheet formulas neutralized (a leading = + - @ is prefixed with '). */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function paymentsCsv(setup: RentSetup, payments: RentPayment[]): string {
  const rows = [["Month", "Due date", "Paid on", "Amount (USD)", "On time", "Method", "Confirmation", "Paid to"]];
  for (const p of [...payments].sort((a, b) => a.month.localeCompare(b.month) || a.paidOn.localeCompare(b.paidOn))) {
    rows.push([p.month, dueDateFor(p.month, setup.dueDay), p.paidOn, (p.amountCents / 100).toFixed(2), paymentTiming(p, setup) === "on_time" ? "yes" : "no", p.method.replace(/_/g, " "), p.confirmation, setup.payee]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ───────── Move-in condition record ─────────
export const ROOMS = ["entry", "living", "kitchen", "bathroom", "bedroom"] as const;
export type Room = (typeof ROOMS)[number];
export const ROOM_ITEMS: Record<Room, string[]> = {
  entry: ["Front door & lock", "Smoke alarm", "Walls & floor"],
  living: ["Walls & paint", "Floors / carpet", "Windows & screens", "Outlets & lights"],
  kitchen: ["Stove & oven", "Fridge", "Sink & faucet", "Cabinets & counters", "Signs of pests"],
  bathroom: ["Toilet", "Shower / tub", "Sink & faucet", "Fan / ventilation", "Signs of mold or leaks"],
  bedroom: ["Walls & paint", "Floors / carpet", "Windows & locks", "Closet"],
};
export type Condition = "good" | "worn" | "damaged";

export interface ConditionEntry {
  room: Room;
  item: string;
  condition: Condition;
  note: string;
  /** When this entry was recorded (ISO). */
  at: string;
}

export function conditionProgress(entries: ConditionEntry[]): { done: number; total: number; damaged: number } {
  const total = ROOMS.reduce((s, r) => s + ROOM_ITEMS[r].length, 0);
  const keys = new Set(entries.map((e) => `${e.room}:${e.item}`));
  return { done: keys.size, total, damaged: entries.filter((e) => e.condition === "damaged").length };
}

export function conditionReport(entries: ConditionEntry[], meta: { address: string; moveInDate: string }, now: Date): string {
  const lines = [`MOVE-IN CONDITION RECORD`, `Address: ${meta.address}`, `Move-in date: ${meta.moveInDate}`, `Prepared: ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`, ""];
  for (const room of ROOMS) {
    const es = entries.filter((e) => e.room === room);
    if (!es.length) continue;
    lines.push(room.toUpperCase());
    for (const e of es) lines.push(`- ${e.item}: ${e.condition}${e.note ? ` — ${e.note}` : ""} (recorded ${e.at.slice(0, 10)})`);
    lines.push("");
  }
  lines.push("Take dated photos of anything worn or damaged and keep them with this record. Send a copy to your landlord and keep one yourself.");
  return lines.join("\n");
}

// ───────── Security deposit return (California: 21 days after you move out) ─────────
export const DEPOSIT_RETURN_DAYS = 21;

export function depositReturnStatus(moveOutDate: string, now: Date): { deadline: string; daysLeft: number; state: "waiting" | "due_soon" | "overdue" } {
  const deadline = new Date(atNoonUtc(moveOutDate).getTime() + DEPOSIT_RETURN_DAYS * DAY);
  const daysLeft = Math.round((deadline.getTime() - atNoonUtc(ymd(now)).getTime()) / DAY);
  return { deadline: ymd(deadline), daysLeft, state: daysLeft < 0 ? "overdue" : daysLeft <= 3 ? "due_soon" : "waiting" };
}

/** A polite, factual request the user can copy. General information, not legal advice. */
export function depositRequestLetter(i: { tenantName: string; address: string; moveOutDate: string; depositCents: number; forwardingAddress: string }): string {
  const amt = `$${(i.depositCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return [
    `Re: Security deposit for ${i.address}`,
    "",
    `I moved out of ${i.address} on ${i.moveOutDate}. My security deposit was ${amt}.`,
    `California Civil Code §1950.5 requires the deposit, or an itemized statement of any deductions (with supporting photos and receipts), within 21 days after move-out.`,
    `Please send the deposit and any statement to: ${i.forwardingAddress}`,
    "",
    "Thank you,",
    i.tenantName,
  ].join("\n");
}

// ───────── Program waitlists ─────────
export interface WaitlistEntry {
  id: string;
  programName: string;
  joinedOn: string;
  confirmation: string;
  /** Many waitlists require you to confirm interest or update your info by a date. */
  nextCheckIn: string | null;
  status: "waiting" | "invited" | "closed";
  notes: string;
}

export function waitlistAttention(w: WaitlistEntry, now: Date): "check_in_overdue" | "check_in_soon" | null {
  if (w.status !== "waiting" || !w.nextCheckIn) return null;
  const days = Math.round((atNoonUtc(w.nextCheckIn).getTime() - atNoonUtc(ymd(now)).getTime()) / DAY);
  return days < 0 ? "check_in_overdue" : days <= 7 ? "check_in_soon" : null;
}

// ───────── "What's next" plan ─────────
export interface PlanItem {
  kind: "rent_due" | "tour" | "app_deadline" | "deposit_return" | "waitlist_check_in" | "follow_up";
  date: string;
  title: string;
  detail: string;
  /** Route in the app to act on it. */
  href: string;
  urgent: boolean;
  /** Exact start time (ISO), for items that have one, so the app can show it in local time. */
  at?: string;
}

export interface PlanInput {
  rent: { setup: RentSetup; payments: RentPayment[] } | null;
  tours: Array<{ id: string; threadId: string; title: string; startsAt: string; status: string }>;
  applications: Array<{ id: string; title: string; deadline: string | null; nextActionAt: string | null; status: string }>;
  moveOut: { moveOutDate: string; depositCents: number } | null;
  waitlists: WaitlistEntry[];
  now: Date;
  horizonDays?: number;
}

export function buildPlan(i: PlanInput): PlanItem[] {
  const out: PlanItem[] = [];
  const horizon = i.now.getTime() + (i.horizonDays ?? 30) * DAY;
  const today = atNoonUtc(ymd(i.now)).getTime();
  const within = (d: string) => {
    const t = atNoonUtc(d.slice(0, 10)).getTime();
    return t >= today - 2 * DAY && t <= horizon;
  };
  if (i.rent) {
    const s = rentSummary(i.rent.setup, i.rent.payments, i.now);
    out.push({ kind: "rent_due", date: s.nextDue, title: `Rent due · $${(i.rent.setup.amountCents / 100).toLocaleString("en-US")}`, detail: s.daysUntilDue < 0 ? `${-s.daysUntilDue} days late — pay and log it` : s.daysUntilDue === 0 ? "Due today" : `In ${s.daysUntilDue} days`, href: "/rent", urgent: s.daysUntilDue <= 2 });
  }
  for (const t of i.tours.filter((x) => x.status === "confirmed" || x.status === "proposed")) {
    if (!within(t.startsAt)) continue;
    out.push({ kind: "tour", date: t.startsAt.slice(0, 10), title: `${t.status === "confirmed" ? "Tour" : "Tour requested"}: ${t.title}`, detail: new Date(t.startsAt).toISOString().slice(11, 16) + " UTC", href: `/conversation/${t.threadId}`, at: t.startsAt, urgent: t.status === "confirmed" && atNoonUtc(t.startsAt.slice(0, 10)).getTime() - today <= DAY });
  }
  for (const a of i.applications) {
    if (a.deadline && !["applied", "leased", "declined", "withdrawn"].includes(a.status) && within(a.deadline)) {
      out.push({ kind: "app_deadline", date: a.deadline.slice(0, 10), title: `Application deadline: ${a.title}`, detail: "Submit through the official application", href: "/applications", urgent: atNoonUtc(a.deadline.slice(0, 10)).getTime() - today <= 2 * DAY });
    }
    if (a.nextActionAt && within(a.nextActionAt)) {
      out.push({ kind: "follow_up", date: a.nextActionAt.slice(0, 10), title: `Follow up: ${a.title}`, detail: "Reminder you set", href: "/applications", urgent: false });
    }
  }
  if (i.moveOut) {
    const d = depositReturnStatus(i.moveOut.moveOutDate, i.now);
    out.push({ kind: "deposit_return", date: d.deadline, title: "Security deposit due back", detail: d.state === "overdue" ? `${-d.daysLeft} days overdue — send a written request` : `In ${d.daysLeft} days`, href: "/move", urgent: d.state !== "waiting" });
  }
  for (const w of i.waitlists) {
    const a = waitlistAttention(w, i.now);
    if (a && w.nextCheckIn) out.push({ kind: "waitlist_check_in", date: w.nextCheckIn, title: `Confirm your spot: ${w.programName}`, detail: a === "check_in_overdue" ? "Check-in date passed — contact the program" : "Check-in due soon", href: "/waitlists", urgent: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || Number(b.urgent) - Number(a.urgent));
}

// ───────── Reminders (scheduled as local notifications by the app) ─────────
export interface ReminderPlan {
  id: string;
  at: string;
  title: string;
  body: string;
}

/** Local reminders: 3 days and the morning of rent due (9am local), and 1 hour before confirmed tours. */
export function reminderSchedule(i: { rent: { setup: RentSetup; payments: RentPayment[] } | null; tours: PlanInput["tours"]; now: Date; utcOffsetMinutes: number }): ReminderPlan[] {
  const out: ReminderPlan[] = [];
  const nowMs = i.now.getTime();
  if (i.rent) {
    const s = rentSummary(i.rent.setup, i.rent.payments, i.now);
    for (const before of [3, 0]) {
      const localNine = new Date(`${s.nextDue}T09:00:00Z`).getTime() - i.utcOffsetMinutes * 60_000 - before * DAY;
      if (localNine > nowMs) out.push({ id: `rent:${s.nextDue}:${before}`, at: new Date(localNine).toISOString(), title: before ? "Rent due in 3 days" : "Rent is due today", body: `$${(i.rent.setup.amountCents / 100).toLocaleString("en-US")} to ${i.rent.setup.payee}. Log it in Housing Compass to keep your on-time streak.` });
    }
  }
  for (const t of i.tours.filter((x) => x.status === "confirmed")) {
    const at = new Date(t.startsAt).getTime() - 60 * 60_000;
    if (at > nowMs) out.push({ id: `tour:${t.id}`, at: new Date(at).toISOString(), title: "Tour in 1 hour", body: `${t.title}. Don't pay anything until you've seen the inside and confirmed who can rent it.` });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
