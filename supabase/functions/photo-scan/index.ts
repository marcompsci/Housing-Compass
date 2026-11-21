/**
 * POST /functions/v1/photo-scan  { "photoId": "<uuid>" }
 * Called by a Storage webhook after a manager uploads to the PRIVATE quarantine bucket.
 *  1. downloads the file with the service role (never public),
 *  2. sends it to the malware scanner configured in PHOTO_SCANNER_URL (e.g. a ClamAV REST service),
 *  3. records the result + the dHash supplied by the scanner via record_photo_scan().
 * With no scanner configured it refuses (503) and the photo simply stays quarantined —
 * nothing is ever published unscanned.
 * Auth: requires the CRON_SECRET header (the webhook sends it).
 */
import { adminClient, json } from "../_shared/auth.ts";
import { observed } from "../_shared/observe.ts";

const BUCKET = "listing-photos-quarantine";

Deno.serve(
  observed("photo-scan", async (req) => {
    if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "forbidden" }, 403);
    const scanner = Deno.env.get("PHOTO_SCANNER_URL");
    if (!scanner) return json({ error: "no scanner configured; photo stays quarantined" }, 503);
    const body = (await req.json().catch(() => null)) as { photoId?: string } | null;
    const photoId = body?.photoId ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(photoId)) return json({ error: "photoId required" }, 400);

    const db = adminClient();
    const { data: photo } = await db.from("listing_photos").select("id,storage_path,status,mime").eq("id", photoId).maybeSingle();
    if (!photo || photo.status !== "quarantined") return json({ error: "not awaiting a scan" }, 409);
    const file = await db.storage.from(BUCKET).download(photo.storage_path as string);
    if (file.error || !file.data) return json({ error: "file missing" }, 404);

    const res = await fetch(scanner, {
      method: "POST",
      headers: { "content-type": photo.mime as string, authorization: `Bearer ${Deno.env.get("PHOTO_SCANNER_TOKEN") ?? ""}` },
      body: file.data,
    });
    if (!res.ok) return json({ error: `scanner returned ${res.status}` }, 502);
    // Expected scanner response: { clean: boolean, dhash?: string (16 hex), detail?: string }
    const verdict = (await res.json()) as { clean?: unknown; dhash?: unknown; detail?: unknown };
    if (typeof verdict.clean !== "boolean") return json({ error: "unexpected scanner response" }, 502);
    const dhash = typeof verdict.dhash === "string" && /^[0-9a-f]{16}$/i.test(verdict.dhash) ? verdict.dhash : null;
    if (verdict.clean && !dhash) return json({ error: "scanner did not return a dHash; photo stays quarantined" }, 502);
    const { data, error } = await db.rpc("record_photo_scan", { p_photo: photoId, p_clean: verdict.clean, p_dhash: dhash, p_detail: String(verdict.detail ?? "") });
    if (error) return json({ error: error.message }, 409);
    return json({ ok: true, status: data });
  }),
);
