/**
 * Moderator decisions that aren't about a listing's trust level:
 *  - held messages (released to the recipient, or kept hidden),
 *  - landlord / manager applications (authority to rent),
 *  - research leads that are about to expire.
 * Mirrored by SQL functions in 20261103000000_v014.sql; both refuse the same bad inputs.
 */
import type { Listing } from "../schema";
import { STALE_AFTER_DAYS, daysSince } from "./staleness";
import { neutralLanguageIssue } from "./review";

// ───────── Held messages ─────────
export type HeldDecision = "release" | "reject";

export const HOLD_REASON_HELP: Record<string, string> = {
  "off-platform payment": "Mentions wire transfers, gift cards, crypto or money-transfer services — the most common rental-scam payment methods.",
  "payment link": "Contains a payment-app link (PayPal.me, Venmo, Cash App).",
  "payment before tour": "Asks for a deposit, fee or payment before the renter has toured.",
  "sensitive personal data request": "Asks for an SSN, bank login or routing number.",
};

export function validateHeldDecision(decision: HeldDecision, reason: string): string | null {
  const r = reason.trim();
  if (r.length < 5) return "Write a short reason (at least 5 characters).";
  if (decision === "release" && r.length < 15) return "Releasing a held message needs a fuller reason (15+ characters): say why it's safe.";
  const lang = neutralLanguageIssue(r);
  if (lang) return lang;
  return null;
}

/** Releasing a message that asked for payment before a tour should never happen silently. */
export function releaseNeedsSecondLook(holdReasons: string[]): boolean {
  return holdReasons.some((r) => r === "payment before tour" || r === "off-platform payment" || r === "sensitive personal data request");
}

// ───────── Landlord applications ─────────
export const AUTHORITY_CHECKS = ["contact_found_independently", "authority_document", "identity_matches", "properties_match"] as const;
export type AuthorityCheck = (typeof AUTHORITY_CHECKS)[number];

export const AUTHORITY_CHECK_LABEL: Record<AuthorityCheck, { label: string; help: string }> = {
  contact_found_independently: { label: "Reached them through a contact we found ourselves", help: "Phone or email from the company's official website, county records or a licensing board — not only what they typed in the form." },
  authority_document: { label: "Saw proof of authority to rent", help: "A management agreement, property tax record or deed in their (or their company's) name. Stored privately; never published." },
  identity_matches: { label: "The person matches the document", help: "Name or company on the document matches the applicant and the official contact." },
  properties_match: { label: "Every listed property is covered", help: "Each address on the application appears in the proof of authority." },
};

export type LandlordDecision = "approve" | "needs_info" | "reject";

export interface AuthorityCheckRecord {
  check: AuthorityCheck;
  passed: boolean;
  note: string;
}

export function validateLandlordDecision(decision: LandlordDecision, checks: AuthorityCheckRecord[], notes: string): string | null {
  const n = notes.trim();
  if (n.length < 5) return "Add reviewer notes (at least 5 characters).";
  const lang = neutralLanguageIssue(n);
  if (lang) return lang;
  if (decision === "approve") {
    for (const c of AUTHORITY_CHECKS) {
      const rec = checks.find((x) => x.check === c);
      if (!rec || !rec.passed) return `Can't approve: “${AUTHORITY_CHECK_LABEL[c].label}” isn't confirmed.`;
      if (rec.note.trim().length < 3) return `Add a note for “${AUTHORITY_CHECK_LABEL[c].label}” (where you found it).`;
    }
  }
  return null;
}

// ───────── Research leads nearing expiry ─────────
export interface LeadExpiry {
  listing: Listing;
  /** Days until the lead auto-expires. 0 = expires today; negative = already past. */
  daysLeft: number;
  bucket: "expired" | "this_week_urgent" | "this_week" | "later";
}

export function leadExpiry(l: Listing, now: Date): LeadExpiry {
  const limit = STALE_AFTER_DAYS.SOURCE_LISTED_UNVERIFIED ?? 14;
  const last = l.source.lastPriceCheckAt ?? l.source.capturedAt;
  const daysLeft = limit - daysSince(last, now);
  const bucket = daysLeft < 0 ? "expired" : daysLeft <= 2 ? "this_week_urgent" : daysLeft <= 7 ? "this_week" : "later";
  return { listing: l, daysLeft, bucket };
}

/** Most urgent first; within a bucket, by city so a moderator can batch by area. */
export function leadExpiryQueue(leads: Listing[], now: Date): LeadExpiry[] {
  return leads
    .filter((l) => l.verification.level === "SOURCE_LISTED_UNVERIFIED" || l.verification.level === "EXPIRED")
    .filter((l) => l.intake && l.intake.reviewStatus !== "rejected")
    .map((l) => leadExpiry(l, now))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.listing.address.city.localeCompare(b.listing.address.city));
}

export function leadExpirySummary(q: LeadExpiry[]): Record<LeadExpiry["bucket"], number> {
  const out = { expired: 0, this_week_urgent: 0, this_week: 0, later: 0 };
  for (const x of q) out[x.bucket] += 1;
  return out;
}
