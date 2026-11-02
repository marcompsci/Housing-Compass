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
import { validateHeldDecision, validateLandlordDecision, type AuthorityCheckRecord, type HeldDecision, type LandlordDecision } from "@housing-compass/core";
import { useConversations } from "../state/conversations";

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

/** Unverified research leads still in play (not rejected), for the expiry countdown. */
export async function loadLeadQueue(mode: ReviewMode): Promise<Listing[]> {
  if (mode === "server") {
    const { data, error } = await supabase!.rpc("lead_expiry_queue");
    if (error) throw new Error(error.message);
    const out: Listing[] = [];
    for (const r of (data as Array<{ id: string }>) ?? []) {
      const l = await repository.get(r.id);
      if (l) out.push(l);
    }
    return out;
  }
  if (mode === "local-demo") {
    const all = await repository.candidates({} as never);
    return all.filter((l) => l.intake && l.intake.reviewStatus !== "rejected" && l.status === "active" && l.verification.level === "SOURCE_LISTED_UNVERIFIED");
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

// ───────── v0.14: held messages, landlord applications ─────────

export interface HeldItem {
  id: string;
  threadId: string;
  listingTitle: string;
  body: string;
  holdReasons: string[];
  fromRenter: boolean;
  at: string;
  demo: boolean;
}

export async function loadHeld(mode: ReviewMode): Promise<HeldItem[]> {
  if (mode === "server") {
    const { data, error } = await supabase!.from("held_messages").select("id,conversation_id,body,hold_reason,created_at,listing_title,from_renter").order("created_at").limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string, threadId: r.conversation_id as string, listingTitle: r.listing_title as string, body: r.body as string,
      holdReasons: r.hold_reason ? String(r.hold_reason).split(", ") : [], fromRenter: !!r.from_renter, at: r.created_at as string, demo: false,
    }));
  }
  if (mode === "local-demo") {
    return useConversations.getState().threads.filter((t) => t.demo).flatMap((t) =>
      t.messages.filter((m) => m.held && !m.review).map((m) => ({ id: m.id, threadId: t.id, listingTitle: t.title, body: m.body, holdReasons: m.holdReasons, fromRenter: m.mine, at: m.at, demo: true })),
    );
  }
  return [];
}

export async function decideHeld(mode: ReviewMode, item: HeldItem, decision: HeldDecision, reason: string): Promise<void> {
  const problem = validateHeldDecision(decision, reason);
  if (problem) throw new Error(problem);
  if (mode === "server") {
    const { error } = await supabase!.rpc("review_held_message", { p_message: item.id, p_decision: decision, p_reason: reason.trim() });
    if (error) throw new Error(error.message);
    return;
  }
  if (mode === "local-demo" && item.demo) useConversations.getState().reviewDemoHeld(item.threadId, item.id, decision);
}

export interface LandlordApp {
  id: string;
  companyName: string;
  officialWebsite: string | null;
  officialPhone: string | null;
  propertyAddresses: string[];
  status: "open" | "needs_info" | "approved" | "rejected";
  reviewerNotes: string | null;
  createdAt: string;
  demo: boolean;
}

const demoApps: LandlordApp[] = [
  { id: "demo-app-1", companyName: "DEMO Template Lane Rentals", officialWebsite: "https://templatelane.example", officialPhone: "(510) 555-0100", propertyAddresses: ["800 Template Ln, Oakland (fictional)"], status: "open", reviewerNotes: null, createdAt: "2026-11-01T17:00:00Z", demo: true },
];

export async function loadLandlordApps(mode: ReviewMode): Promise<LandlordApp[]> {
  if (mode === "server") {
    const { data, error } = await supabase!.from("landlord_applications").select("id,company_name,official_website,official_phone,property_addresses,status,reviewer_notes,created_at").in("status", ["open", "needs_info"]).order("created_at").limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string, companyName: r.company_name as string, officialWebsite: r.official_website as string | null, officialPhone: r.official_phone as string | null,
      propertyAddresses: (r.property_addresses as string[]) ?? [], status: r.status as LandlordApp["status"], reviewerNotes: r.reviewer_notes as string | null, createdAt: r.created_at as string, demo: false,
    }));
  }
  if (mode === "local-demo") return demoApps.filter((a) => a.status === "open" || a.status === "needs_info");
  return [];
}

export async function decideLandlordApp(mode: ReviewMode, app: LandlordApp, decision: LandlordDecision, checks: AuthorityCheckRecord[], notes: string): Promise<void> {
  const problem = validateLandlordDecision(decision, checks, notes);
  if (problem) throw new Error(problem);
  if (mode === "server") {
    const payload = Object.fromEntries(checks.map((c) => [c.check, { passed: c.passed, note: c.note.trim() }]));
    const rec = await supabase!.rpc("record_authority_checks", { p_application: app.id, p_checks: payload });
    if (rec.error) throw new Error(rec.error.message);
    const { error } =
      decision === "approve"
        ? await supabase!.rpc("approve_landlord", { p_application: app.id, p_manager_id: null, p_notes: notes.trim() })
        : await supabase!.rpc("decide_landlord", { p_application: app.id, p_decision: decision === "reject" ? "rejected" : "needs_info", p_notes: notes.trim() });
    if (error) throw new Error(error.message);
    return;
  }
  const a = demoApps.find((x) => x.id === app.id);
  if (a) Object.assign(a, { status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "needs_info", reviewerNotes: notes });
}
