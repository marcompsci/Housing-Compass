/**
 * GET /functions/v1/health — for uptime monitors. Reports only aggregate numbers.
 * Returns 503 when the pipeline that keeps data honest is unhealthy:
 *  - stale listings still visible (expiry job not running),
 *  - notifications stuck in the queue,
 *  - open payment-related reports older than 24h (review backlog).
 */
import { adminClient, json } from "../_shared/auth.ts";
import { observed } from "../_shared/observe.ts";

Deno.serve(
  observed("health", async () => {
    const db = adminClient();
    const { data, error } = await db.rpc("ops_health");
    if (error) return json({ ok: false, error: "database unreachable" }, 503);
    const h = data as { stale_visible: number; queued_overdue: number; urgent_reports_over_24h: number };
    const ok = h.stale_visible === 0 && h.queued_overdue < 100 && h.urgent_reports_over_24h === 0;
    return json({ ok, ...h }, ok ? 200 : 503);
  }),
);
