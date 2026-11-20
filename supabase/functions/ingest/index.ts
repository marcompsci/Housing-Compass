/**
 * POST /functions/v1/ingest   (reviewers only)
 * body: { adapterId: string, csv?: string, records?: unknown[], dryRun?: boolean }
 *
 * Runs core.ingestBatch — the same legal gates and trust rules as the tests — then writes
 * listings, units, listing_checks and an audit trail with the service role. dryRun returns
 * the plan without writing, so a reviewer can preview an import.
 */
import { ADAPTERS, ingestBatch, listingToRows, managerCsvToListings, parseDocuments, IngestNotPermittedError } from "../../../packages/core/src/index.ts";
import { observed } from "../_shared/observe.ts";
import { adminClient, json, requireReviewer } from "../_shared/auth.ts";

Deno.serve(
  observed("ingest", async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const reviewer = await requireReviewer(req);
  if (!reviewer) return json({ error: "reviewer sign-in required" }, 403);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.adapterId !== "string") return json({ error: "adapterId required" }, 400);
  const db = adminClient();

  // Adapter capabilities come from code; authorization/consent references from the sources table.
  const base = ADAPTERS.find((a) => a.id === body.adapterId);
  const { data: src } = await db.from("sources").select("id,name,kind,can_ingest,authorization_ref,consent_ref").eq("id", body.adapterId).maybeSingle();
  if (!src) return json({ error: "unknown source" }, 404);
  const adapter = {
    ...(base ?? { id: src.id, name: src.name, kind: src.kind, homeUrl: "", legalBasis: "", ingestBlockedBy: null, termsUrl: null }),
    capabilities: { ingest: !!src.can_ingest, linkOut: false },
    authorizationRef: src.authorization_ref,
    consentRef: src.consent_ref,
  };

  const now = new Date();
  let records: unknown[] = body.records ?? [];
  let csvErrors: unknown[] = [];
  if (typeof body.csv === "string") {
    if (body.csv.length > 2_000_000) return json({ error: "CSV too large (2 MB max)" }, 413);
    const r = managerCsvToListings(body.csv, { sourceId: src.id, sourceName: src.name, now });
    records = r.listings;
    csvErrors = r.errors;
  }
  if (records.length > 5000) return json({ error: "max 5000 records per batch" }, 413);

  const { data: existingDocs } = await db.rpc("search_existing_for_source", { p_source_id: src.id });
  const existing = parseDocuments((existingDocs as unknown[]) ?? []).listings;

  let result;
  try {
    result = ingestBatch({ adapter, records, existing, now });
  } catch (e) {
    if (e instanceof IngestNotPermittedError) return json({ error: e.message }, 403);
    throw e;
  }
  const summary = { inserts: result.inserts.length, updates: result.updates.length, unchanged: result.unchanged.length, rejected: result.rejected, csvErrors };
  if (body.dryRun) return json({ dryRun: true, ...summary, checks: result.checks });

  for (const l of [...result.inserts, ...result.updates]) {
    const { listing, unit } = listingToRows(l);
    const { error } = await db.from("listings").upsert(listing, { onConflict: "id" });
    if (error) return json({ error: `listing ${l.id}: ${error.message}`, partial: summary }, 500);
    await db.from("units").delete().eq("listing_id", l.id);
    const { error: ue } = await db.from("units").insert(unit);
    if (ue) return json({ error: `unit ${l.id}: ${ue.message}`, partial: summary }, 500);
  }
  if (result.checks.length) {
    await db.from("listing_checks").insert(result.checks.map((c) => ({ listing_id: c.listingId, check_kind: c.checkKind, outcome: c.outcome, details: c.details, actor_kind: "system", actor_id: c.actorId, checked_at: c.checkedAt })));
  }
  // Row triggers log each change as "system"; this event ties the batch to the reviewer who ran it.
  await db.from("audit_events").insert({ entity: "source", entity_id: src.id, action: "ingest_batch", actor_kind: "human", actor_id: reviewer, reason: JSON.stringify({ inserts: summary.inserts, updates: summary.updates, rejected: result.rejected.length }) });
  return json({ ok: true, ...summary });
}),
);
