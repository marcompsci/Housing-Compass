/**
 * Scheduled (pg_cron → net.http_post, every 15 min). Two steps:
 *  1. plan  — for users with alerts on, run core.planAlerts and enqueue drafts (dedupe-safe).
 *  2. send  — claim due notifications, deliver pushes via the Expo Push API, mark sent/failed.
 * Auth: requires the CRON_SECRET header so only the scheduler can trigger it.
 */
import { DEFAULT_ALERT_PREFS, normalizeAlertPrefs, parseDocuments, planAlerts } from "../../../packages/core/src/index.ts";
import { observed } from "../_shared/observe.ts";
import { adminClient, json } from "../_shared/auth.ts";

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

Deno.serve(
  observed("notify", async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "forbidden" }, 403);
  const db = adminClient();
  const now = new Date();
  let planned = 0;

  // ── plan
  const { data: searches } = await db.from("saved_searches").select("id,user_id,name,filters,alerts_enabled,last_alerted_at").eq("alerts_enabled", true).limit(5000);
  const users = [...new Set((searches ?? []).map((s) => s.user_id as string))];
  for (const userId of users) {
    const mine = (searches ?? []).filter((s) => s.user_id === userId);
    const [{ data: favs }, { data: apps }, { data: prof }] = await Promise.all([
      db.from("favorites").select("listing_id").eq("user_id", userId),
      db.from("applications").select("listing_id,deadline,status").eq("user_id", userId),
      db.from("user_profiles").select("quiet_start,quiet_end,utc_offset_minutes,max_push_per_day,alert_kinds").eq("id", userId).maybeSingle(),
    ]);
    const docs: unknown[] = [];
    for (const s of mine) {
      const f = s.filters as { category: string; includeUnverified?: boolean };
      const { data } = await db.rpc("search_listings", { p_category: f.category, p_include_unverified: !!f.includeUnverified });
      docs.push(...((data as unknown[]) ?? []));
    }
    const drafts = planAlerts({
      userId,
      savedSearches: mine.map((s) => ({ id: s.id, name: s.name, filters: s.filters, alertsEnabled: true, lastAlertedAt: s.last_alerted_at })),
      favorites: (favs ?? []).map((f) => f.listing_id),
      applications: (apps ?? []).map((a) => ({ listingId: a.listing_id, deadline: a.deadline, status: a.status })),
      listings: parseDocuments(docs).listings,
      priceChanges: [],
      prefs: prof ? normalizeAlertPrefs({ quietStart: prof.quiet_start, quietEnd: prof.quiet_end, utcOffsetMinutes: prof.utc_offset_minutes, maxPushPerDay: prof.max_push_per_day, kinds: prof.alert_kinds }) : DEFAULT_ALERT_PREFS,
      now,
    });
    if (drafts.length) {
      await db.from("notifications").upsert(
        drafts.map((d) => ({ user_id: d.userId, kind: d.kind, channel: d.channel, dedupe_key: d.dedupeKey, title: d.title, body: d.body, listing_id: d.listingId, scheduled_for: d.scheduledFor, payload: { listingId: d.listingId } })),
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      );
      planned += drafts.length;
    }
    await db.from("saved_searches").update({ last_alerted_at: now.toISOString() }).in("id", mine.map((s) => s.id));
  }

  // ── send
  const { data: batch } = await db.rpc("claim_notifications", { p_batch: 200 });
  let sent = 0, failed = 0;
  for (const n of (batch as Array<Record<string, unknown>>) ?? []) {
    if (n.channel !== "push") {
      await db.from("notifications").update({ status: "sent", sent_at: now.toISOString() }).eq("id", n.id);
      continue;
    }
    const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", n.user_id);
    if (!tokens?.length) {
      await db.from("notifications").update({ status: "sent", channel: "in_app", sent_at: now.toISOString() }).eq("id", n.id);
      continue;
    }
    const res = await fetch(EXPO_PUSH, {
      method: "POST",
      headers: { "content-type": "application/json", ...(Deno.env.get("EXPO_ACCESS_TOKEN") ? { authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` } : {}) },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: n.title, body: n.body, data: { listingId: n.listing_id }, sound: "default" }))),
    }).catch((e) => ({ ok: false, statusText: String(e) }) as Response);
    if (res.ok) {
      sent += 1;
      await db.from("notifications").update({ status: "sent", sent_at: now.toISOString() }).eq("id", n.id);
    } else {
      failed += 1;
      await db.from("notifications").update({ status: (n.attempts as number) >= 5 ? "failed" : "queued", last_error: res.statusText?.slice(0, 200) ?? "error", scheduled_for: new Date(now.getTime() + 5 * 60_000).toISOString() }).eq("id", n.id);
    }
  }
  return json({ planned, sent, failed });
}),
);
