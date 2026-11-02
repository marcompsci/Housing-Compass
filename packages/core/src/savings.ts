/**
 * Move-in savings planner: how long until you can cover the up-front costs of a home.
 * Uses the listing's confirmed move-in total when we have one; otherwise the user's own number.
 * No interest, no investment assumptions — just arithmetic the user can check.
 */

export interface SavingsPlanInput {
  targetCents: number;
  savedCents: number;
  /** How much the user can set aside per period. */
  perPeriodCents: number;
  period: "week" | "month";
  now: Date;
}

export interface SavingsPlan {
  remainingCents: number;
  periodsNeeded: number | null;
  readyBy: string | null;
  /** 0–1 */
  progress: number;
  status: "ready" | "on_track" | "no_savings_rate" | "long_way";
}

const DAY = 86_400_000;
/** Beyond this horizon we say so plainly instead of printing a far-off date. */
export const SAVINGS_LONG_WAY_DAYS = 365;

export function savingsPlan(i: SavingsPlanInput): SavingsPlan {
  const target = Math.max(0, Math.round(i.targetCents));
  const saved = Math.max(0, Math.round(i.savedCents));
  const remaining = Math.max(0, target - saved);
  const progress = target === 0 ? 1 : Math.min(1, saved / target);
  if (remaining === 0) return { remainingCents: 0, periodsNeeded: 0, readyBy: i.now.toISOString().slice(0, 10), progress: 1, status: "ready" };
  if (i.perPeriodCents <= 0) return { remainingCents: remaining, periodsNeeded: null, readyBy: null, progress, status: "no_savings_rate" };
  const periods = Math.ceil(remaining / i.perPeriodCents);
  const ready = new Date(i.now.getTime());
  if (i.period === "week") ready.setTime(ready.getTime() + periods * 7 * DAY);
  else ready.setUTCMonth(ready.getUTCMonth() + periods);
  const days = (ready.getTime() - i.now.getTime()) / DAY;
  return { remainingCents: remaining, periodsNeeded: periods, readyBy: ready.toISOString().slice(0, 10), progress, status: days > SAVINGS_LONG_WAY_DAYS ? "long_way" : "on_track" };
}

/** Per-period amount needed to be ready by a date. */
export function neededPerPeriod(remainingCents: number, by: Date, period: "week" | "month", now: Date): number | null {
  const days = (by.getTime() - now.getTime()) / DAY;
  if (days <= 0) return null;
  const periods = Math.max(1, Math.floor(period === "week" ? days / 7 : days / 30.44));
  return Math.ceil(remainingCents / periods);
}
