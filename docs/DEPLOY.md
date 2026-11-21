# Deploy

## 1. Supabase (Phase 3 onward)
1. Create a project (US West region is closest to the Bay Area). PostGIS: Database → Extensions → enable `postgis` (the migration also runs `create extension if not exists postgis`).
2. `supabase link --project-ref <ref>` → `supabase db push` (applies `supabase/migrations`).
3. Seed: `npm run seed:build && psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql`. This loads only sources and the 28 UNVERIFIED research leads.
4. Enable `pg_cron` and schedule `select expire_stale_listings();` hourly.
5. Storage: create a **private** bucket `evidence` (reviewers only; no public URLs).
6. Make your first reviewer: in SQL editor, `update user_profiles set role = 'admin' where id = '<your auth uid>';` (users cannot self-elevate under RLS).
7. Secrets: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=…`. Never put service-role keys in `EXPO_PUBLIC_*`.
8. Rate limits: the database caps reports (10/h) and appeals (3/h) per user. Also enable Supabase Auth rate limits and CAPTCHA on sign-up.

## 1b. Edge functions & schedules
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=… CRON_SECRET=$(openssl rand -hex 32) EXPO_ACCESS_TOKEN=…
supabase functions deploy ingest notify health photo-scan
# Optional, for listing photos: a malware-scanning service that returns {clean, dhash, detail}
# supabase secrets set PHOTO_SCANNER_URL=https://… PHOTO_SCANNER_TOKEN=…
# Then add a Storage webhook on bucket listing-photos-quarantine → POST /functions/v1/photo-scan {"photoId": …} with the x-cron-secret header.
```
`supabase/functions/deno.json` enables sloppy imports so functions can import `packages/core` directly. If your CLI version doesn't bundle files outside `supabase/functions`, copy `packages/core/src` into `supabase/functions/_core` in a pre-deploy step.

Schedule with pg_cron + pg_net:
```sql
select cron.schedule('expire-stale', '5 * * * *', $$select expire_stale_listings()$$);
select cron.schedule('notify', '*/15 * * * *', $$select net.http_post('https://<ref>.functions.supabase.co/notify', '{}'::jsonb, headers => jsonb_build_object('x-cron-secret', '<CRON_SECRET>'))$$);
```
Property-manager CSV imports: insert a `sources` row with `kind='property_manager'`, `can_ingest=true` and `consent_ref`. Then a reviewer POSTs `{adapterId, csv, dryRun:true}` to `/ingest`, checks the preview, and re-sends with `dryRun:false`.

## 2. Mobile (EAS)
```bash
cd apps/mobile
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform ios   # dev build (MapLibre is native)
npx eas-cli@latest build --profile production --platform all
```
Set `EXPO_PUBLIC_*` values as EAS environment variables. Set `EXPO_PUBLIC_DEMO_MODE=false` for store builds once real verified inventory exists. App Store privacy answers: approximate location (app functionality, not linked, not stored server-side); no tracking.

## 3. Web
```bash
npm run web:export          # → apps/mobile/dist (static SPA)
```
Host on any static host (Vercel, Netlify, Cloudflare Pages, S3+CloudFront):
- SPA fallback: route all paths to `index.html`.
- Serve `/maplibre/maplibre-gl-worker.mjs` with `Content-Type: text/javascript` (module worker).
- Recommended headers: `Content-Security-Policy` allowing your map-tile host and Supabase URL, `worker-src 'self' blob:`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: geolocation=(self)`.

## 4. Maps
OpenFreeMap is free and keyless but best-effort. For production traffic, use a licensed provider (MapTiler, Stadia Maps, or self-hosted Protomaps) and set `EXPO_PUBLIC_MAP_STYLE_URL`. Keep the OSM attribution visible.

## 5. Before public launch
- Legal review of every source's terms (see `DATA_SOURCES.md`) and of fair-housing language in listings.
- Written authorization before any automated use of Doorway data.
- Privacy policy covering location (approximate, not stored), accounts, reports and evidence retention.
- Turn off demo mode.
