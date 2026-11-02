import {
  VERIFICATION_CHECKS,
  type ChecklistItem,
  type Listing,
  type VerificationCheck,
  type VerificationLevel,
} from "../schema";

export const PUBLIC_DEFAULT_LEVELS: readonly VerificationLevel[] = ["OFFICIAL_PORTAL", "PROPERTY_MANAGER_VERIFIED"];

export const LEVEL_LABEL: Record<VerificationLevel, string> = {
  OFFICIAL_PORTAL: "Official portal",
  PROPERTY_MANAGER_VERIFIED: "Manager verified",
  SOURCE_LISTED_UNVERIFIED: "Unverified lead",
  FLAGGED: "Under review",
  EXPIRED: "Expired — needs recheck",
};

export const LEVEL_EXPLAINER: Record<VerificationLevel, string> = {
  OFFICIAL_PORTAL:
    "Published on an official government housing portal. This does not guarantee acceptance or an immediate vacancy.",
  PROPERTY_MANAGER_VERIFIED:
    "Our reviewer checked documents and independently contacted the property manager to confirm authority to rent, address, availability, rent, contact channel and fees. No listing can be guaranteed scam-free.",
  SOURCE_LISTED_UNVERIFIED:
    "Advertised on another website. Nobody has confirmed it is real, available, or priced as shown. Never send money before you tour and confirm who can rent it.",
  FLAGGED: "Temporarily hidden while a person reviews it. This is not a finding that the listing is fraudulent.",
  EXPIRED: "Not rechecked recently, so it is hidden until it is verified again.",
};

export const CHECK_LABEL: Record<VerificationCheck, string> = {
  authorization_to_rent: "Authority to rent (owner or manager)",
  address: "Address and exact unit",
  unit_availability: "Unit is available",
  rent: "Rent matches the advertisement",
  contact_channel: "Contact channel found independently",
  fees: "Deposits and fees disclosed",
};

export type Actor = { kind: "human"; id: string; role: "reviewer" | "admin" | "user" } | { kind: "system"; id: string };

export interface AuditEvent {
  entity: "listing";
  entityId: string;
  action: "verification_change" | "status_change" | "appeal_filed";
  actor: Actor;
  from: VerificationLevel | Listing["status"];
  to: VerificationLevel | Listing["status"];
  reason: string;
  at: string;
}

export interface VisibilityOptions {
  includeUnverified: boolean;
  includeDemo: boolean;
}

/** FLAGGED and EXPIRED are never shown to the public; unverified leads only on opt-in. */
export function isPubliclyVisible(l: Listing, opts: VisibilityOptions): boolean {
  if (l.isDemo && !opts.includeDemo) return false;
  if (l.status !== "active") return false;
  if (PUBLIC_DEFAULT_LEVELS.includes(l.verification.level)) return true;
  if (l.verification.level === "SOURCE_LISTED_UNVERIFIED") return opts.includeUnverified;
  return false;
}

export function missingChecks(checklist: ChecklistItem[]): VerificationCheck[] {
  return VERIFICATION_CHECKS.filter((check) => {
    const item = checklist.find((c) => c.check === check);
    return !item || !item.passed || item.evidenceIds.length === 0;
  });
}

export class VerificationError extends Error {
  constructor(
    message: string,
    readonly reasons: string[],
  ) {
    super(message);
  }
}

export interface ManagerVerificationInput {
  checklist: ChecklistItem[];
  /** How the reviewer reached the manager: the number/email must come from an independent source. */
  independentContact: {
    method: "phone" | "email" | "in_person";
    foundVia: "official_website" | "county_records" | "official_portal" | "prior_verified_relationship";
    contactedAt: string;
  };
}

const allowedTransitions: Record<VerificationLevel, VerificationLevel[]> = {
  SOURCE_LISTED_UNVERIFIED: ["PROPERTY_MANAGER_VERIFIED", "FLAGGED", "EXPIRED"],
  OFFICIAL_PORTAL: ["FLAGGED", "EXPIRED"],
  PROPERTY_MANAGER_VERIFIED: ["FLAGGED", "EXPIRED"],
  FLAGGED: ["SOURCE_LISTED_UNVERIFIED", "PROPERTY_MANAGER_VERIFIED", "OFFICIAL_PORTAL", "EXPIRED"],
  EXPIRED: ["SOURCE_LISTED_UNVERIFIED", "PROPERTY_MANAGER_VERIFIED", "OFFICIAL_PORTAL", "FLAGGED"],
};

export function canTransition(from: VerificationLevel, to: VerificationLevel, actor: Actor): boolean {
  if (!allowedTransitions[from].includes(to)) return false;
  // Automation may hide things (flag/expire) but may never vouch for a listing.
  if (actor.kind === "system") return to === "FLAGGED" || to === "EXPIRED";
  return true;
}

interface TransitionResult {
  listing: Listing;
  audit: AuditEvent;
}

function audit(l: Listing, actor: Actor, from: VerificationLevel, to: VerificationLevel, reason: string, at: string): AuditEvent {
  return { entity: "listing", entityId: l.id, action: "verification_change", actor, from, to, reason, at };
}

export function markManagerVerified(
  l: Listing,
  input: ManagerVerificationInput,
  reviewer: Extract<Actor, { kind: "human" }>,
  now: Date,
): TransitionResult {
  const reasons: string[] = [];
  const from = l.verification.level;
  if (reviewer.role === "user") reasons.push("Only reviewers can verify listings");
  if (!canTransition(from, "PROPERTY_MANAGER_VERIFIED", reviewer)) reasons.push(`Cannot go from ${from} to PROPERTY_MANAGER_VERIFIED`);
  const missing = missingChecks(input.checklist);
  if (missing.length) reasons.push(`Missing evidence: ${missing.join(", ")}`);
  if (l.verification.signals.some((s) => s.severity === "hold")) reasons.push("Resolve open hold-level risk signals first");
  if (reasons.length) throw new VerificationError("Listing cannot be marked verified", reasons);
  const at = now.toISOString();
  return {
    listing: {
      ...l,
      status: "active",
      verification: { ...l.verification, level: "PROPERTY_MANAGER_VERIFIED", lastVerifiedAt: at, verifiedBy: reviewer.id, checklist: input.checklist },
    },
    audit: audit(l, reviewer, from, "PROPERTY_MANAGER_VERIFIED", `Manager verified via ${input.independentContact.method} (${input.independentContact.foundVia})`, at),
  };
}

export function markOfficialPortal(l: Listing, actor: Extract<Actor, { kind: "human" }>, now: Date): TransitionResult {
  if (l.source.sourceKind !== "official_portal") {
    throw new VerificationError("Not an official portal source", ["OFFICIAL_PORTAL is reserved for records from an authorized official portal feed"]);
  }
  const from = l.verification.level;
  if (from !== "OFFICIAL_PORTAL" && !canTransition(from, "OFFICIAL_PORTAL", actor)) {
    throw new VerificationError("Transition not allowed", [`${from} → OFFICIAL_PORTAL`]);
  }
  const at = now.toISOString();
  return {
    listing: { ...l, status: "active", verification: { ...l.verification, level: "OFFICIAL_PORTAL", lastVerifiedAt: at, verifiedBy: actor.id } },
    audit: audit(l, actor, from, "OFFICIAL_PORTAL", "Confirmed against official portal", at),
  };
}

/** Hide pending human review. Used by fraud detectors, user reports and reviewers. */
export function flagForReview(l: Listing, actor: Actor, reason: string, now: Date): TransitionResult {
  const from = l.verification.level;
  const at = now.toISOString();
  if (from === "FLAGGED") {
    return { listing: l, audit: audit(l, actor, from, from, `Additional flag: ${reason}`, at) };
  }
  if (!canTransition(from, "FLAGGED", actor)) throw new VerificationError("Transition not allowed", [`${from} → FLAGGED`]);
  return {
    listing: { ...l, status: "pending_review", verification: { ...l.verification, level: "FLAGGED" } },
    audit: audit(l, actor, from, "FLAGGED", reason, at),
  };
}

/** A human reviewer clears a flag. Automated actors cannot. */
export function clearFlag(
  l: Listing,
  reviewer: Extract<Actor, { kind: "human" }>,
  restoreTo: "SOURCE_LISTED_UNVERIFIED" | "EXPIRED",
  reason: string,
  now: Date,
): TransitionResult {
  if (l.verification.level !== "FLAGGED") throw new VerificationError("Listing is not flagged", []);
  const at = now.toISOString();
  return {
    listing: {
      ...l,
      status: restoreTo === "EXPIRED" ? "expired" : "active",
      verification: { ...l.verification, level: restoreTo, signals: l.verification.signals.map((s) => ({ ...s, severity: "info" as const })) },
    },
    audit: audit(l, reviewer, "FLAGGED", restoreTo, reason, at),
  };
}

export function fileAppeal(l: Listing, appellantId: string, statement: string, now: Date): AuditEvent {
  if (l.verification.level !== "FLAGGED" && l.status !== "removed") {
    throw new VerificationError("Only flagged or removed listings can be appealed", []);
  }
  return {
    entity: "listing",
    entityId: l.id,
    action: "appeal_filed",
    actor: { kind: "human", id: appellantId, role: "user" },
    from: l.status,
    to: "pending_review",
    reason: statement.slice(0, 2000),
    at: now.toISOString(),
  };
}
