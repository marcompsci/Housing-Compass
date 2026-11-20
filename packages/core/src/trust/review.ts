import type { Listing, VerificationCheck } from "../schema";
import { detectAll, type DetectionContext } from "./fraud";

export type ReviewDecision = "verify" | "clear_flag" | "expire" | "remove";

export interface ReviewQueueItem {
  listing: Listing;
  openReports: number;
  reportReasons: string[];
  openAppeals: number;
  holdSignals: number;
  priority: number;
}

const PAYMENT_REASONS = new Set(["upfront_payment", "off_platform_payment", "impersonation"]);

/** Highest risk first: payment-related reports and hold signals, then volume, then age. */
export function buildReviewQueue(
  listings: Listing[],
  reports: Array<{ listingId: string; reason: string }>,
  appeals: Array<{ listingId: string }>,
  ctx: Omit<DetectionContext, "others">,
): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];
  for (const l of listings) {
    const rs = reports.filter((r) => r.listingId === l.id);
    const ap = appeals.filter((a) => a.listingId === l.id).length;
    if (l.verification.level !== "FLAGGED" && !rs.length && !ap) continue;
    const signals = l.verification.signals.length ? l.verification.signals : detectAll(l, { ...ctx, others: listings });
    const holdSignals = signals.filter((s) => s.severity === "hold").length;
    const paymentReports = rs.filter((r) => PAYMENT_REASONS.has(r.reason)).length;
    items.push({
      listing: l,
      openReports: rs.length,
      reportReasons: [...new Set(rs.map((r) => r.reason))],
      openAppeals: ap,
      holdSignals,
      priority: paymentReports * 100 + holdSignals * 50 + ap * 20 + rs.length * 10,
    });
  }
  return items.sort((a, b) => b.priority - a.priority || a.listing.id.localeCompare(b.listing.id));
}

const VERDICT_WORDS = /\b(fraud(ulent|ster)?|scam(mer|my)?|con ?artist|criminal|liar|fake landlord)\b/i;

/** Reviewer notes describe what was found, not a verdict about a person. */
export function neutralLanguageIssue(text: string): string | null {
  if (text.trim().length < 5) return "Add a short reason (what you checked or found).";
  if (VERDICT_WORDS.test(text)) return "Describe what you found (e.g. “asked for a wire before the tour”) instead of a verdict word.";
  return null;
}

export interface EvidenceEntry {
  check: VerificationCheck;
  passed: boolean;
  kind: "document" | "phone_call" | "email" | "site_visit" | "official_record" | "tour";
  independentSource: string;
  notes: string;
}

/** Client-side mirror of the DB rule, so the Verify button explains what's missing. */
export function evidenceGaps(entries: EvidenceEntry[]): string[] {
  const gaps: string[] = [];
  const checks: VerificationCheck[] = ["authorization_to_rent", "address", "unit_availability", "rent", "contact_channel", "fees"];
  for (const c of checks) {
    const e = entries.find((x) => x.check === c);
    if (!e || !e.passed) gaps.push(`${c.replace(/_/g, " ")} not confirmed`);
    else if (c === "contact_channel" && e.independentSource.trim().length < 4) gaps.push("say where you found the contact independently");
    else if (e.notes.trim().length < 3 && e.kind !== "official_record") gaps.push(`${c.replace(/_/g, " ")}: add a note`);
  }
  return gaps;
}
