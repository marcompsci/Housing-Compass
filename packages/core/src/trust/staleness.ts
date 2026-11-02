import type { Listing, VerificationLevel } from "../schema";
import type { AuditEvent } from "./verification";

const DAY = 86_400_000;

/** Max age of the last verification (or, for leads, the last source check) before auto-expiry. */
export const STALE_AFTER_DAYS: Record<VerificationLevel, number | null> = {
  OFFICIAL_PORTAL: 14,
  PROPERTY_MANAGER_VERIFIED: 14,
  SOURCE_LISTED_UNVERIFIED: 14,
  FLAGGED: null, // waits for a human
  EXPIRED: null,
};

/** Price observations older than this get a "price may have changed" warning. */
export const PRICE_WARN_AFTER_DAYS = 7;

function lastCheck(l: Listing): string {
  return l.verification.lastVerifiedAt ?? l.source.lastPriceCheckAt ?? l.source.capturedAt;
}

export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

export type StaleReason = "verification_too_old" | "application_deadline_passed";

export function staleReason(l: Listing, now: Date): StaleReason | null {
  const deadline = l.eligibility.applicationDeadline;
  if (deadline && new Date(deadline).getTime() < now.getTime()) return "application_deadline_passed";
  const limit = STALE_AFTER_DAYS[l.verification.level];
  if (limit === null) return null;
  return daysSince(lastCheck(l), now) > limit ? "verification_too_old" : null;
}

export function priceMayBeOutdated(l: Listing, now: Date): boolean {
  const at = l.source.lastPriceCheckAt;
  return at === null || daysSince(at, now) > PRICE_WARN_AFTER_DAYS;
}

/** Run by the scheduled recheck job. Returns the listing unchanged when fresh. */
export function expireIfStale(l: Listing, now: Date): { listing: Listing; audit: AuditEvent | null } {
  const reason = staleReason(l, now);
  if (!reason || l.verification.level === "EXPIRED") return { listing: l, audit: null };
  const from = l.verification.level;
  return {
    listing: { ...l, status: "expired", verification: { ...l.verification, level: "EXPIRED" } },
    audit: {
      entity: "listing",
      entityId: l.id,
      action: "verification_change",
      actor: { kind: "system", id: "system:staleness" },
      from,
      to: "EXPIRED",
      reason,
      at: now.toISOString(),
    },
  };
}
