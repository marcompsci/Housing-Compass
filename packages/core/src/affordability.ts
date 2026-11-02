/**
 * Affordability & eligibility helpers. They use ONLY numbers the listing itself states
 * (income limits, minimum-income multiple, fees). We never fill gaps from memorized AMI
 * tables — when the listing doesn't say, the answer is "unknown — ask".
 *
 * Cost-burden thresholds follow HUD's standard definition: housing costs above 30% of
 * gross income = cost-burdened; above 50% = severely cost-burdened.
 */
import { moveInTotal, totalMonthly } from "./pricing";
import type { Listing } from "./schema";

export interface HouseholdProfile {
  householdSize: number;
  annualIncomeCents: number;
  savingsCents: number;
}

export type Burden = "affordable" | "cost_burdened" | "severely_cost_burdened";

export function rentBurden(monthlyCostCents: number, annualIncomeCents: number): { share: number; burden: Burden } {
  if (annualIncomeCents <= 0) return { share: Number.POSITIVE_INFINITY, burden: "severely_cost_burdened" };
  const share = (monthlyCostCents * 12) / annualIncomeCents;
  return { share, burden: share <= 0.3 ? "affordable" : share <= 0.5 ? "cost_burdened" : "severely_cost_burdened" };
}

/** Max monthly housing cost at 30% of gross income. */
export function affordableMonthlyCents(annualIncomeCents: number, share = 0.3): number {
  return Math.floor((annualIncomeCents * share) / 12);
}

export type Verdict = "yes" | "no" | "unknown";

export interface EligibilityResult {
  incomeLimit: { verdict: Verdict; limitCents: number | null; reason: string };
  minimumIncome: { verdict: Verdict; requiredAnnualCents: number | null; reason: string };
}

export function checkEligibility(l: Listing, p: HouseholdProfile): EligibilityResult {
  // Income ceiling (income-restricted homes)
  let incomeLimit: EligibilityResult["incomeLimit"];
  if (!l.eligibility.incomeRestricted) {
    incomeLimit = { verdict: "yes", limitCents: null, reason: "No income limit stated for this home." };
  } else {
    const row = l.eligibility.incomeLimits?.find((r) => r.householdSize === p.householdSize);
    if (!row) {
      incomeLimit = { verdict: "unknown", limitCents: null, reason: `The listing doesn't state a limit for a household of ${p.householdSize}. Ask the property or check the official listing.` };
    } else if (p.annualIncomeCents <= row.maxAnnualIncomeCents) {
      incomeLimit = { verdict: "yes", limitCents: row.maxAnnualIncomeCents, reason: "Your income is at or under the stated limit." };
    } else {
      incomeLimit = { verdict: "no", limitCents: row.maxAnnualIncomeCents, reason: "Your income is above the stated limit for your household size." };
    }
  }
  // Income floor (minimum income as a multiple of rent)
  let minimumIncome: EligibilityResult["minimumIncome"];
  const k = l.eligibility.minIncomeMultipleOfRent;
  if (k === null) {
    minimumIncome = { verdict: "unknown", requiredAnnualCents: null, reason: "No minimum income stated. Many landlords require 2–3× the rent; ask." };
  } else {
    const required = Math.ceil(l.pricing.baseRentCents * k * 12);
    minimumIncome =
      p.annualIncomeCents >= required
        ? { verdict: "yes", requiredAnnualCents: required, reason: `Meets the stated minimum (${k}× rent).` }
        : { verdict: "no", requiredAnnualCents: required, reason: `Below the stated minimum (${k}× rent). Ask whether a co-signer, vouchers or savings are accepted.` };
  }
  return { incomeLimit, minimumIncome };
}

export interface MoveInPlan {
  knownUpfrontCents: number;
  complete: boolean;
  unknownItems: string[];
  shortfallCents: number;
}

export function moveInPlan(l: Listing, p: HouseholdProfile): MoveInPlan {
  const unknownItems: string[] = [];
  if (l.pricing.depositCents === null) unknownItems.push("security deposit");
  if (l.pricing.moveInCosts === null) unknownItems.push("move-in fees (first month, application fee…)");
  const m = moveInTotal(l);
  const known = (l.pricing.depositCents ?? 0) + (l.pricing.moveInCosts ?? []).reduce((s, c) => s + c.amountCents, 0);
  const amount = m.amountCents ?? known;
  return { knownUpfrontCents: amount, complete: unknownItems.length === 0, unknownItems, shortfallCents: Math.max(0, amount - p.savingsCents) };
}

export interface AffordabilitySummary {
  monthlyCents: number;
  monthlyIsComplete: boolean;
  burden: ReturnType<typeof rentBurden>;
  eligibility: EligibilityResult;
  moveIn: MoveInPlan;
}

export function summarizeAffordability(l: Listing, p: HouseholdProfile): AffordabilitySummary {
  const t = totalMonthly(l);
  const monthly = t.amountCents ?? l.pricing.baseRentCents;
  return { monthlyCents: monthly, monthlyIsComplete: t.amountCents !== null && t.complete, burden: rentBurden(monthly, p.annualIncomeCents), eligibility: checkEligibility(l, p), moveIn: moveInPlan(l, p) };
}
