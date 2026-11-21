# Roadmap

| Phase | Status | What shipped |
|---|---|---|
| 1 | ✅ | Repo inspection, architecture, source-terms research (Doorway = link-out only) |
| 2 | ✅ | Polished UI, map, trust labels, demo records, schema + RLS + trust triggers |
| 3 | ✅ | Read API (`listing_documents` view, `search_listings` RPC with PostGIS radius, `get_listing`), async repositories, email one-time-code sign-in, on-device → account sync, self-service data deletion, auto-profile on sign-up. **DB ↔ app contract test**: every API document must parse with the app's own zod schema. |
| 4 | ✅ | `ingestBatch` with legal gates (no ingest without API/partnership/consent reference), dedupe by source id + normalized address, price-change history, risk scan on import, property-manager CSV import (RFC 4180), link checker, `ingest` edge function (reviewer-only, dry-run preview) |
| 5 | ✅ | Reviewer queue (risk-ranked), six-check evidence form, `review_decide` / `appeal_decide` RPCs (reviewer-only, neutral-language guard, audited), local demo review mode |
| 6 | ✅ | Alert planner (saved-search matches, digests, 7/2/0-day deadline reminders, price drops, expiry), quiet hours + daily push cap, dedupe-keyed queue with `claim_notifications` (skip-locked), `notify` edge function (Expo Push), push tokens, in-app inbox |
| 7 | ✅ | Application tracker: status machine, history, next-step guidance with payment safety, follow-up reminders, urgency sorting, account sync |
| 8 | ✅ | "Can I afford & qualify?": 30%/50% cost burden (HUD), income-limit and minimum-income checks **only from the listing's own numbers**, move-in shortfall. Income/savings never leave the device. |
| 9 | ✅ | i18n framework + Spanish for navigation, Explore, cards and all trust labels; WCAG contrast tests (caught and fixed 2 failures); reduced-motion map; translation completeness tests |
| 10 | ✅ | "Is this message safe?" checker, perceptual image hash (dHash), Postgres rate limiter + anonymous search throttle, CSP/security headers, CI secret scan + dependency audit (fixed a high-severity zod advisory by upgrading to zod 4) |
| 11 | ✅ | Redacting logger, route error boundary, edge-function request logs, `health` endpoint + `ops_health()`, Deno typecheck in CI, Maestro native flows, e2e expanded to 19 browser checks |
| 12 | ✅ | Offline fallback (last 5 searches, re-validated and expiry-checked), `eas.json` profiles, release checklist, docs |

## Blocking items only you can unblock
1. **Supabase project**: URL + anon key in EAS env vars; service-role key + `CRON_SECRET` as function secrets. Everything is built and tested locally against Postgres 16 + PostGIS. It has **not** run against a live Supabase project yet.
2. **Doorway data agreement** with BAHFA/MTC. Until then Doorway stays link-out only.
3. **Expo project id** (`eas init`) for push notifications. A **native-speaker review** of the Spanish copy.
4. **A first reviewer**: promote your account with one SQL line (see DEPLOY.md).

## Next (Phase 13+)
- Licensed geocoder for street addresses and states outside California (store coarse results only)
- 511.org transit times instead of straight-line distance
- Image upload for manager listings (private bucket + dHash on upload)
- More languages: Chinese, Vietnamese, Tagalog. Translate remaining secondary screens.
- Optional Next.js listing pages if SEO matters

## Known limitations
- The native MapLibre map and push notifications are typechecked but haven't run on a device here. They need a dev build.
- The edge functions are Deno-typechecked but haven't been executed against a live project.
- Research leads expire around Nov 15, 2026 unless rechecked. This is by design.
- Spanish covers the core flow. Some secondary screens (filters, review, account) are still English.
