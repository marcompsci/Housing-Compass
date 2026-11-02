/**
 * Price history. Server mode reads the price_history table (written by a trigger on units).
 * On a device without an account, we keep our own observations of SAVED homes only, so
 * "price dropped" alerts work offline. Observations are never invented: one entry per real
 * change we saw, with the date we saw it.
 */
import type { Listing } from "./schema";

export interface PriceObservation {
  listingId: string;
  cents: number;
  basis: Listing["pricing"]["basis"];
  /** When this price was observed (the source's last price check, or when we first saw it). */
  at: string;
}

export interface PriceChange {
  listingId: string;
  oldCents: number | null;
  newCents: number;
  at: string;
}

export const MAX_OBSERVATIONS_PER_LISTING = 24;

/**
 * Record the current price of each listing if it differs from the last observation.
 * A change of price BASIS (per bed → per room) is never treated as a price change: the
 * history is reset because the two numbers aren't comparable.
 */
export function observePrices(history: Record<string, PriceObservation[]>, listings: Listing[], now: Date): { history: Record<string, PriceObservation[]>; changes: PriceChange[] } {
  const next: Record<string, PriceObservation[]> = { ...history };
  const changes: PriceChange[] = [];
  for (const l of listings) {
    if (l.isDemo) continue;
    const prev = next[l.id] ?? [];
    const last = prev[prev.length - 1];
    const at = l.source.lastPriceCheckAt ?? now.toISOString();
    const obs: PriceObservation = { listingId: l.id, cents: l.pricing.baseRentCents, basis: l.pricing.basis, at };
    if (!last || last.basis !== l.pricing.basis) {
      next[l.id] = [obs];
      continue;
    }
    if (last.cents === obs.cents) continue;
    next[l.id] = [...prev, obs].slice(-MAX_OBSERVATIONS_PER_LISTING);
    changes.push({ listingId: l.id, oldCents: last.cents, newCents: obs.cents, at });
  }
  return { history: next, changes };
}

/** Keep history only for listings the user still cares about (privacy: minimum retention). */
export function pruneHistory(history: Record<string, PriceObservation[]>, keepIds: string[]): Record<string, PriceObservation[]> {
  const keep = new Set(keepIds);
  return Object.fromEntries(Object.entries(history).filter(([id]) => keep.has(id)));
}

export interface PriceTrend {
  points: number;
  firstCents: number;
  lastCents: number;
  lowCents: number;
  highCents: number;
  changeCents: number;
  direction: "down" | "up" | "flat";
}

export function priceTrend(obs: PriceObservation[]): PriceTrend | null {
  if (!obs.length) return null;
  const cents = obs.map((o) => o.cents);
  const first = cents[0]!;
  const last = cents[cents.length - 1]!;
  return {
    points: obs.length,
    firstCents: first,
    lastCents: last,
    lowCents: Math.min(...cents),
    highCents: Math.max(...cents),
    changeCents: last - first,
    direction: last < first ? "down" : last > first ? "up" : "flat",
  };
}

/** Rows from the price_history table → observations (old_cents is ignored; each row is one new price). */
export function historyFromRows(listingId: string, basis: Listing["pricing"]["basis"], rows: Array<{ new_cents: number; observed_at: string }>): PriceObservation[] {
  return [...rows]
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .map((r) => ({ listingId, cents: r.new_cents, basis, at: r.observed_at }));
}
