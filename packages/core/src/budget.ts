import type { Category, Listing } from "./schema";
import { categorize } from "./categories";
import { totalMonthly } from "./pricing";

/**
 * The amount budgets are checked against: base rent + mandatory recurring fees when the
 * fees are confirmed; otherwise base rent alone (and the UI says fees are unconfirmed).
 * Advertised rent alone is never treated as the all-in price when fees are known.
 */
export function effectiveMonthlyCents(l: Listing): { cents: number; includesFees: boolean } {
  const t = totalMonthly(l);
  return t.amountCents !== null ? { cents: t.amountCents, includesFees: true } : { cents: l.pricing.baseRentCents, includesFees: false };
}

export interface BudgetPrefs {
  /** Rooms & shared: default $500–$1,400 */
  roomMinCents: number;
  roomMaxCents: number;
  /** Entire units: preferred ≤ $1,400, adjustable hard max (default $2,000) */
  unitPreferredMaxCents: number;
  unitHardMaxCents: number;
}

export const DEFAULT_BUDGET: BudgetPrefs = {
  roomMinCents: 500_00,
  roomMaxCents: 1_400_00,
  unitPreferredMaxCents: 1_400_00,
  unitHardMaxCents: 2_000_00,
};

/** Absolute ceiling for the adjustable hard max slider. */
export const HARD_MAX_CEILING_CENTS = 2_000_00;

export type BudgetStatus = "within" | "over_preferred" | "over_max" | "under_min";

const UNIT_CATEGORIES: Category[] = ["STUDIO", "ENTIRE_1BR"];

export function budgetStatus(l: Listing, prefs: BudgetPrefs = DEFAULT_BUDGET): BudgetStatus {
  const rent = effectiveMonthlyCents(l).cents;
  const cat = categorize(l);
  const entire = (cat !== null && UNIT_CATEGORIES.includes(cat)) || l.unit.isEntireUnit;
  if (entire) {
    if (rent > prefs.unitHardMaxCents) return "over_max";
    if (rent > prefs.unitPreferredMaxCents) return "over_preferred";
    return "within";
  }
  if (rent < prefs.roomMinCents) return "under_min";
  if (rent > prefs.roomMaxCents) return "over_max";
  return "within";
}

export function clampBudget(p: BudgetPrefs): BudgetPrefs {
  const hard = Math.min(Math.max(p.unitHardMaxCents, 0), HARD_MAX_CEILING_CENTS);
  return {
    roomMinCents: Math.max(0, Math.min(p.roomMinCents, p.roomMaxCents)),
    roomMaxCents: Math.max(p.roomMinCents, p.roomMaxCents),
    unitHardMaxCents: hard,
    unitPreferredMaxCents: Math.min(p.unitPreferredMaxCents, hard),
  };
}
