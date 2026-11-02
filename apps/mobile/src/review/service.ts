/**
 * Reviewer workflow. With a backend, decisions go through the review_decide RPC (validated +
 * audited in Postgres). Without one, demo mode runs the same core state machine locally so the
 * dashboard can be exercised — clearly labeled, never persisted beyond this device.
 */
import { buildReviewQueue, clearFlag, flagForReview, markManagerVerified, type EvidenceEntry, type Listing, type ReviewDecision, type ReviewQueueItem } from "@housing-compass/core";
import { config, now } from "../config";
import { useListingCache } from "../data/hooks";
import { localOverrides, repository } from "../data/repository";
import { supabase } from "../data/supabase";
import { useStore } from "../state/store";

export type ReviewMode = "server" | "local-demo" | "none";

export async function reviewMode(): Promise<ReviewMode> {
  if (supabase) {
    const { data } = await supabase.rpc("is_reviewer");
    return data === true ? "server" : "none";
  }
  return config.demoMode ? "local-demo" : "none";
}

export async function loadQueue(mode: ReviewMode): Promise<ReviewQueueItem[]> {
  if (mode === "server") {
    const { data, error } = await supabase!.from("review_queue").select("id, open_reports, report_reasons, open_appeals").limit(200);
    if (error) throw new Error(error.message);
    const items: ReviewQueueItem[] = [];
    for (const row of data ?? []) {
      const l = await repository.get(row.id as string);
      if (l) items.push({ listing: l, openReports: row.open_reports as number, reportReasons: (row.report_reasons as string[]) ?? [], openAppeals: row.open_appeals as number, holdSignals: 0, priority: 0 });
    }
    return items;
  }
  if (mode === "local-demo") {
    const listings = await repository.candidates({} as never);
    const reports = useStore.getState().reports.map((r) => ({ listingId: r.listingId, reason: r.reason }));
    return buildReviewQueue(listings, reports, [], { managers: [], now: now() });
  }
  return [];
}

export async function decide(mode: ReviewMode, listing: Listing, decision: ReviewDecision, reason: string, evidence: EvidenceEntry[]): Promise<Listing> {
  if (mode === "server") {
    const uid = (await supabase!.auth.getUser()).data.user!.id;
    if (decision === "verify") {
      const { error } = await supabase!.from("verification_evidence").insert(
        evidence.map((e) => ({ listing_id: listing.id, check_type: e.check, passed: e.passed, evidence_kind: e.kind, independent_source: e.independentSource || null, notes: e.notes || null, collected_by: uid })),
      );
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase!.rpc("review_decide", { p_listing_id: listing.id, p_decision: decision, p_reason: reason });
    if (error) throw new Error(error.message);
    const fresh = (await repository.get(listing.id)) ?? listing;
    useListingCache.getState().put([fresh]);
    return fresh;
  }
  // local demo: same state machine as production — but never "verify" a real lead without a backend.
  if (decision === "verify" && !listing.isDemo) throw new Error("Without the server, only fictional demo listings can be verified.");
  const reviewer = { kind: "human", id: "demo-reviewer", role: "reviewer" } as const;
  const t = now();
  let next: Listing;
  if (decision === "verify") {
    next = markManagerVerified(
      listing,
      {
        checklist: evidence.map((e, i) => ({ check: e.check, passed: e.passed, evidenceIds: [`local-${listing.id}-${i}`], checkedAt: t.toISOString(), checkedBy: reviewer.id })),
        independentContact: { method: "phone", foundVia: "official_website", contactedAt: t.toISOString() },
      },
      reviewer,
      t,
    ).listing;
  } else if (decision === "clear_flag") {
    next = clearFlag(listing, reviewer, "SOURCE_LISTED_UNVERIFIED", reason, t).listing;
  } else if (decision === "expire") {
    next = { ...listing, status: "expired", verification: { ...listing.verification, level: "EXPIRED" } };
  } else {
    next = { ...flagForReview(listing, reviewer, reason, t).listing, status: "removed" };
  }
  localOverrides.set(listing.id, next);
  useListingCache.getState().put([next]);
  useStore.setState({ reports: useStore.getState().reports.filter((r) => r.listingId !== listing.id) });
  return next;
}

/** Research leads awaiting moderation (pending_review), newest region first. */
export async function loadLeadQueue(mode: ReviewMode): Promise<Listing[]> {
  if (mode === "server") {
    const { data } = await supabase!.from("listings").select("id").eq("intake->>reviewStatus", "pending_review").limit(200);
    const out: Listing[] = [];
    for (const r of data ?? []) {
      const l = await repository.get(r.id as string);
      if (l) out.push(l);
    }
    return out;
  }
  if (mode === "local-demo") {
    const all = await repository.candidates({} as never);
    return all.filter((l) => l.intake?.reviewStatus === "pending_review" && l.status === "active");
  }
  return [];
}

export async function decideLead(mode: ReviewMode, l: Listing, decision: "source_found" | "reject", reason: string): Promise<Listing> {
  if (mode === "server") {
    const { error } = await supabase!.rpc("lead_decide", { p_listing_id: l.id, p_decision: decision, p_reason: reason });
    if (error) throw new Error(error.message);
    const fresh = (await repository.get(l.id)) ?? l;
    useListingCache.getState().put([fresh]);
    return fresh;
  }
  const at = now().toISOString();
  const next: Listing = {
    ...l,
    status: decision === "reject" ? "removed" : l.status,
    source: decision === "source_found" ? { ...l.source, lastPriceCheckAt: at } : l.source,
    intake: l.intake ? { ...l.intake, reviewStatus: decision === "reject" ? "rejected" : "source_found" } : l.intake,
  };
  localOverrides.set(l.id, next);
  useListingCache.getState().put([next]);
  return next;
}
