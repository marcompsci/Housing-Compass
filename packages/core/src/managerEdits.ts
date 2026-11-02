/**
 * Verified managers keep their listings current by REQUESTING changes; a reviewer approves
 * them (request_listing_edit / decide_listing_edit in SQL). Only a short whitelist of fields
 * can change this way — identity, address and trust level never can.
 */
import { formatUsd } from "./pricing";
import type { Listing } from "./schema";

export interface ListingEditChanges {
  baseRentCents?: number;
  depositCents?: number;
  applicationFeeCents?: number;
  moveInDate?: string;
  /** The unit was rented: hide it. */
  markLeased?: true;
  /** The manager confirms the unit is still available today. */
  confirmAvailable?: true;
}

export const EDIT_MAX_RENT_CENTS = 2_000_000;

export function validateEditRequest(l: Pick<Listing, "pricing" | "status">, c: ListingEditChanges, note: string, now: Date): string | null {
  const keys = Object.keys(c) as (keyof ListingEditChanges)[];
  if (!keys.length) return "Choose at least one change.";
  if (note.trim().length < 5) return "Add a short note (what changed and since when).";
  if (l.status !== "active") return "Only active listings can be edited.";
  if (c.markLeased && keys.length > 1) return "Marking a home as rented can't be combined with other changes.";
  const money = (v: number | undefined, name: string, max: number) =>
    v !== undefined && (!Number.isInteger(v) || v < 0 || v > max) ? `${name} must be between $0 and ${formatUsd(max)}.` : null;
  const m = money(c.baseRentCents, "Rent", EDIT_MAX_RENT_CENTS) ?? money(c.depositCents, "Deposit", EDIT_MAX_RENT_CENTS * 3) ?? money(c.applicationFeeCents, "Application fee", 20_000);
  if (m) return m;
  if (c.baseRentCents === 0) return "Rent can't be $0.";
  if (c.baseRentCents !== undefined && c.baseRentCents === l.pricing.baseRentCents) return "That's already the listed rent.";
  if (c.moveInDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.moveInDate) || Number.isNaN(Date.parse(c.moveInDate))) return "Use a date like 2026-12-01.";
    const days = (Date.parse(c.moveInDate) - now.getTime()) / 86_400_000;
    if (days < -1 || days > 366) return "Move-in date must be within the next year.";
  }
  return null;
}

/** Plain-language summary shown to reviewers and in the manager's history. */
export function describeEdit(l: Pick<Listing, "pricing" | "lease">, c: ListingEditChanges): string[] {
  const out: string[] = [];
  if (c.baseRentCents !== undefined) out.push(`Rent ${formatUsd(l.pricing.baseRentCents)} → ${formatUsd(c.baseRentCents)}`);
  if (c.depositCents !== undefined) out.push(`Deposit ${l.pricing.depositCents === null ? "not stated" : formatUsd(l.pricing.depositCents)} → ${formatUsd(c.depositCents)}`);
  if (c.applicationFeeCents !== undefined) out.push(`Application fee ${l.pricing.applicationFeeCents === null ? "not stated" : formatUsd(l.pricing.applicationFeeCents)} → ${formatUsd(c.applicationFeeCents)}`);
  if (c.moveInDate !== undefined) out.push(`Move-in date ${l.lease.moveInDate ?? "not stated"} → ${c.moveInDate}`);
  if (c.markLeased) out.push("Mark as rented (hide from search)");
  if (c.confirmAvailable) out.push("Confirm still available today");
  return out;
}

/** The database's column names for the same changes (request_listing_edit expects these keys). */
export function editToDb(c: ListingEditChanges): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.baseRentCents !== undefined) out.base_rent_cents = c.baseRentCents;
  if (c.depositCents !== undefined) out.deposit_cents = c.depositCents;
  if (c.applicationFeeCents !== undefined) out.application_fee_cents = c.applicationFeeCents;
  if (c.moveInDate !== undefined) out.move_in_date = c.moveInDate;
  if (c.markLeased) out.mark_leased = true;
  if (c.confirmAvailable) out.confirm_available = true;
  return out;
}

// ───────── Report status (what happened to a report you sent) ─────────
export type ReportStatus = "open" | "triaged" | "actioned" | "dismissed";
export const REPORT_STATUS_TEXT: Record<ReportStatus | "local", { label: string; detail: string }> = {
  local: { label: "Saved on this device", detail: "Sign in to send it to our reviewers." },
  open: { label: "Waiting for a reviewer", detail: "Reports about payments before a tour are looked at first." },
  triaged: { label: "Being reviewed", detail: "A reviewer is checking the listing." },
  actioned: { label: "Action taken", detail: "The listing was changed, expired or removed. Thank you." },
  dismissed: { label: "Reviewed — no change", detail: "A reviewer checked and found nothing to change. You can report again if something new happens." },
};

// ───────── Saved areas ─────────
export function validateAreaName(name: string, existing: string[]): string | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 40) return "Give the area a name of 2–40 characters.";
  if (existing.some((e) => e.trim().toLowerCase() === n.toLowerCase())) return "You already have an area with that name.";
  return null;
}
