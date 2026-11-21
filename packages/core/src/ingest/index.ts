/**
 * Compliant ingestion. Records only enter through an adapter whose `capabilities.ingest`
 * is true (API / feed / partnership / consented import). Imports can NEVER set a verified
 * level by themselves — that only happens through the reviewer workflow.
 */
import type { SourceAdapter } from "../adapters";
import { ListingSchema, type Listing } from "../schema";
import { detectAll, recommend, type PropertyManagerRecord } from "../trust/fraud";

const ABBREV: Record<string, string> = {
  street: "st", avenue: "ave", boulevard: "blvd", drive: "dr", road: "rd", lane: "ln", court: "ct",
  place: "pl", terrace: "ter", way: "way", circle: "cir", parkway: "pkwy", highway: "hwy",
  north: "n", south: "s", east: "e", west: "w", apartment: "apt", suite: "ste",
};

/** "1801 Milvia Street, Unit 3" + "Berkeley" → "1801 milvia st|unit 3|berkeley" */
export function addressKey(line1: string, unit: string | null, city: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,#]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ABBREV[w] ?? w)
      .join(" ");
  return [norm(line1), norm(unit ?? ""), norm(city)].join("|");
}

export interface ListingCheckRecord {
  listingId: string;
  checkKind: "price_check" | "source_recheck" | "risk_scan";
  outcome: "pass" | "changed" | "hold" | "fail";
  details: Record<string, unknown>;
  actorId: string;
  checkedAt: string;
}

export interface IngestResult {
  inserts: Listing[];
  updates: Listing[];
  unchanged: string[];
  rejected: Array<{ index: number; id: unknown; reason: string }>;
  checks: ListingCheckRecord[];
}

export class IngestNotPermittedError extends Error {}

export interface IngestOptions {
  adapter: SourceAdapter & { authorizationRef?: string | null; consentRef?: string | null };
  records: unknown[];
  existing: Listing[];
  managers?: PropertyManagerRecord[];
  now: Date;
}

const SAFE_LEVEL = "SOURCE_LISTED_UNVERIFIED" as const;

export function ingestBatch(o: IngestOptions): IngestResult {
  const { adapter, now } = o;
  if (!adapter.capabilities.ingest) {
    throw new IngestNotPermittedError(`${adapter.name} is link-out only: ${adapter.ingestBlockedBy ?? "no ingestion permission"}`);
  }
  if (adapter.kind === "official_portal" && !adapter.authorizationRef) {
    throw new IngestNotPermittedError(`${adapter.name} needs a written authorization reference before ingest`);
  }
  if (adapter.kind === "property_manager" && adapter.id !== "manual-review" && !adapter.consentRef) {
    throw new IngestNotPermittedError(`${adapter.name} needs the manager's consent on file`);
  }
  if (adapter.kind === "aggregator" && !adapter.authorizationRef) {
    throw new IngestNotPermittedError(`${adapter.name} needs a licensing/partnership reference before ingest`);
  }

  const at = now.toISOString();
  const res: IngestResult = { inserts: [], updates: [], unchanged: [], rejected: [], checks: [] };
  const bySourceId = new Map(o.existing.filter((l) => l.source.sourceListingId).map((l) => [`${l.source.sourceId}::${l.source.sourceListingId}`, l]));
  const byAddress = new Map(o.existing.map((l) => [`${addressKey(l.address.line1, l.address.unit, l.address.city)}::${l.pricing.basis}`, l]));
  const seen = new Set<string>();

  o.records.forEach((raw, index) => {
    const parsed = ListingSchema.safeParse(raw);
    if (!parsed.success) {
      res.rejected.push({ index, id: (raw as { id?: unknown })?.id, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) });
      return;
    }
    let l = parsed.data;
    if (l.isDemo) {
      res.rejected.push({ index, id: l.id, reason: "demo records cannot be ingested" });
      return;
    }
    // Provenance is the adapter's, not whatever the payload claims.
    const level = adapter.kind === "official_portal" ? "OFFICIAL_PORTAL" : SAFE_LEVEL;
    l = {
      ...l,
      source: { ...l.source, sourceId: adapter.id, sourceKind: adapter.kind, capturedAt: l.source.capturedAt ?? at, lastPriceCheckAt: at },
      verification: { level, lastVerifiedAt: level === "OFFICIAL_PORTAL" ? at : null, availabilityConfirmedAt: null, verifiedBy: level === "OFFICIAL_PORTAL" ? `source:${adapter.id}` : null, checklist: [], signals: [] },
      status: "active",
    };

    const key = l.source.sourceListingId ? `${adapter.id}::${l.source.sourceListingId}` : null;
    const addr = `${addressKey(l.address.line1, l.address.unit, l.address.city)}::${l.pricing.basis}`;
    const dupKey = key ?? addr;
    if (seen.has(dupKey)) {
      res.rejected.push({ index, id: l.id, reason: "duplicate within batch" });
      return;
    }
    seen.add(dupKey);
    const prior = (key && bySourceId.get(key)) || byAddress.get(addr);

    if (prior) {
      l = { ...l, id: prior.id, source: { ...l.source, capturedAt: prior.source.capturedAt } };
      // Keep a human verification if the facts that were verified did not change.
      const priceChanged = prior.pricing.baseRentCents !== l.pricing.baseRentCents;
      if (prior.verification.level === "PROPERTY_MANAGER_VERIFIED" && !priceChanged) {
        l = { ...l, verification: prior.verification };
      }
      if (priceChanged) {
        res.checks.push({ listingId: prior.id, checkKind: "price_check", outcome: "changed", details: { fromCents: prior.pricing.baseRentCents, toCents: l.pricing.baseRentCents }, actorId: `source:${adapter.id}`, checkedAt: at });
      } else {
        res.checks.push({ listingId: prior.id, checkKind: "source_recheck", outcome: "pass", details: {}, actorId: `source:${adapter.id}`, checkedAt: at });
      }
    }

    const signals = detectAll(l, { others: [...o.existing, ...res.inserts], managers: o.managers ?? [], now });
    if (recommend(signals) === "hold_for_human_review") {
      l = { ...l, status: "pending_review", verification: { ...l.verification, level: "FLAGGED", signals } };
      res.checks.push({ listingId: l.id, checkKind: "risk_scan", outcome: "hold", details: { codes: signals.map((s) => s.code) }, actorId: "system:risk-scan", checkedAt: at });
    } else if (signals.length) {
      l = { ...l, verification: { ...l.verification, signals } };
    }

    if (!prior) res.inserts.push(l);
    else if (JSON.stringify({ ...prior, source: { ...prior.source, lastPriceCheckAt: null } }) === JSON.stringify({ ...l, source: { ...l.source, lastPriceCheckAt: null } })) res.unchanged.push(l.id);
    else res.updates.push(l);
  });

  return res;
}
