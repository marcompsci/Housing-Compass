import type { Listing, PriceBasis } from "./schema";

export const BASIS_LABEL: Record<PriceBasis, string> = {
  PER_BED: "per bed",
  PER_ROOM: "per room",
  PER_UNIT: "entire unit",
};

export const BASIS_SUFFIX: Record<PriceBasis, string> = {
  PER_BED: "/ bed / mo",
  PER_ROOM: "/ room / mo",
  PER_UNIT: "/ unit / mo",
};

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  });
}

/** "$1,695+ / unit / mo", "$795 / bed / mo", "$900–$1,100 / room / mo" */
export function formatRent(l: Listing, suffix: Record<PriceBasis, string> = BASIS_SUFFIX): string {
  const p = l.pricing;
  let amount = formatUsd(p.baseRentCents);
  if (p.qualifier === "STARTING_AT") amount += "+";
  if (p.qualifier === "RANGE" && p.baseRentMaxCents !== null) amount += `–${formatUsd(p.baseRentMaxCents)}`;
  return `${amount} ${suffix[p.basis]}`;
}

export interface CostFigure {
  /** null when we cannot compute it honestly */
  amountCents: number | null;
  /** true only if every component is confirmed */
  complete: boolean;
  label: string;
}

/** Base rent + confirmed recurring fees. Incomplete when fees or utilities are unknown. */
export function totalMonthly(l: Listing): CostFigure {
  const fees = l.pricing.recurringFees;
  if (fees === null) {
    return { amountCents: null, complete: false, label: "Total monthly not confirmed" };
  }
  const amount = l.pricing.baseRentCents + fees.reduce((s, f) => s + f.amountCents, 0);
  const complete = l.pricing.qualifier === "EXACT" && l.pricing.utilitiesIncluded !== null;
  const qualifier = l.pricing.qualifier === "EXACT" ? "" : "from ";
  return {
    amountCents: amount,
    complete,
    label: `${qualifier}${formatUsd(amount)} total / mo${complete ? "" : " (some costs unconfirmed)"}`,
  };
}

export function moveInTotal(l: Listing): CostFigure {
  const costs = l.pricing.moveInCosts;
  if (costs === null || l.pricing.depositCents === null) {
    return { amountCents: null, complete: false, label: "Move-in cost not confirmed" };
  }
  const amount = l.pricing.depositCents + costs.reduce((s, c) => s + c.amountCents, 0);
  return { amountCents: amount, complete: true, label: `${formatUsd(amount)} due at move-in` };
}

/**
 * Groups listings by price basis. UI comparison and sorting operate WITHIN a group only,
 * so a $795 bed is never ranked next to a $1,433 apartment as if they were alike.
 */
export function groupByBasis<T extends Listing>(listings: T[]): Record<PriceBasis, T[]> {
  const out: Record<PriceBasis, T[]> = { PER_BED: [], PER_ROOM: [], PER_UNIT: [] };
  for (const l of listings) out[l.pricing.basis].push(l);
  return out;
}

export function assertSameBasis(listings: Listing[]): void {
  const bases = new Set(listings.map((l) => l.pricing.basis));
  if (bases.size > 1) {
    throw new Error(`Cannot compare prices across bases: ${[...bases].join(", ")}`);
  }
}
